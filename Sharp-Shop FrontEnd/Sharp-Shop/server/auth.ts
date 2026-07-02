import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Never send the bcrypt hash to the client (or the response logger)
function sanitizeUser(user: SelectUser | Express.User) {
  const { password, ...safe } = user as SelectUser;
  return safe;
}

const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(200),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["buyer", "seller"]),
  fullName: z.string().max(100).optional(),
  businessName: z.string().max(100).optional(),
  whatsappNumber: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
});

// Minimal fixed-window login rate limiter (per IP) — no extra dependency
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();

  if (loginAttempts.size > 10_000) {
    loginAttempts.forEach((entry, key) => {
      if (now > entry.resetAt) loginAttempts.delete(key);
    });
  }

  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Too many login attempts. Please try again in a few minutes." });
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production — session cookies are forgeable without it");
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret || "sharpshop_dev_only_secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1); // trust first proxy
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      // Strip the hash here so req.user is safe everywhere downstream
      done(null, user ? (sanitizeUser(user) as Express.User) : undefined);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0];
        return res.status(400).send(`${firstError.path.join(".")}: ${firstError.message}`);
      }
      const input = parsed.data;

      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Only pass fields that belong to the users table
      const user = await storage.createUser({
        username: input.username,
        email: input.email || undefined,
        password: hashedPassword,
        role: input.role,
        fullName: input.fullName,
        businessName: input.businessName,
      });

      // If user is a seller, create trader profile
      if (user.role === 'seller') {
        try {
          await storage.createTrader({
            userId: user.id,
            businessName: input.businessName || user.username,
            whatsappNumber: input.whatsappNumber,
            address: input.address,
          });
        } catch (traderErr) {
          // Roll back the user row so we don't strand a seller account
          // that has no trader profile (dashboard would 404 forever).
          console.error("Trader creation failed after user creation:", traderErr);
          await storage.deleteUser(user.id).catch((cleanupErr) =>
            console.error("Failed to roll back user after trader creation failure:", cleanupErr));
          return res.status(500).send("Registration failed while creating the seller profile. Please try again.");
        }
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", loginRateLimiter, passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user!));
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user!));
  });
}
