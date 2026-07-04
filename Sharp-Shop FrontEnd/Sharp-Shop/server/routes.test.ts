import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

// Builds the API app exactly like index.ts, minus vite/static and listen().
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  setupAuth(app);
  registerRoutes(createServer(app), app);
  return app;
}

const app = buildApp();

// Register a seller and return a logged-in supertest agent + the created user/trader.
async function registerSeller(businessName: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/register").send({
    username: businessName,
    password: "password123",
    role: "seller",
    businessName,
    whatsappNumber: "+2348000000000",
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  const trader = await storage.getTraderByUserId(res.body.id);
  return { agent, user: res.body, trader: trader! };
}

async function seedProduct(traderId: string, name = "Test Product") {
  return storage.createProduct({
    traderId,
    traderName: "Test Shop",
    name,
    price: 5000,
    description: "A test product",
    imageUrl: "https://example.com/p.jpg",
    category: "Electronics",
    stockQuantity: 3,
    isActive: true,
    whatsappNumber: "+2348000000000",
  } as any);
}

describe("auth response hygiene", () => {
  it("never returns the password hash on register", async () => {
    const { user } = await registerSeller("HygieneShop");
    expect(user).not.toHaveProperty("password");
    expect(user.username).toBe("HygieneShop");
  });

  it("rejects duplicate usernames", async () => {
    await registerSeller("DupeShop");
    const res = await request(app).post("/api/register").send({
      username: "DupeShop", password: "password123", role: "buyer",
    });
    expect(res.status).toBe(400);
  });

  it("enforces a minimum password length", async () => {
    const res = await request(app).post("/api/register").send({
      username: "ShortPw", password: "123", role: "buyer",
    });
    expect(res.status).toBe(400);
  });
});

describe("unauthenticated writes are blocked", () => {
  it("PATCH /api/products/:id/stock -> 401", async () => {
    const res = await request(app).patch("/api/products/whatever/stock").send({ quantity: 0 });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/products/:id -> 401", async () => {
    const res = await request(app).patch("/api/products/whatever").send({ price: 1 });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/products/:id -> 401", async () => {
    const res = await request(app).delete("/api/products/whatever");
    expect(res.status).toBe(401);
  });

  it("GET /api/orders/me -> 401", async () => {
    const res = await request(app).get("/api/orders/me");
    expect(res.status).toBe(401);
  });

  it("PATCH /api/trader/me -> 401", async () => {
    const res = await request(app).patch("/api/trader/me").send({ bio: "x" });
    expect(res.status).toBe(401);
  });
});

describe("product ownership", () => {
  it("lets a seller edit their own product", async () => {
    const { agent, trader } = await registerSeller("OwnerShop");
    const product = await seedProduct(trader.id);
    const res = await agent.patch(`/api/products/${product.id}`).send({ price: 9999 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(9999);
  });

  it("blocks a seller from editing someone else's product (403)", async () => {
    const owner = await registerSeller("OwnerShop2");
    const product = await seedProduct(owner.trader.id);
    const attacker = await registerSeller("AttackerShop");
    const res = await attacker.agent.patch(`/api/products/${product.id}`).send({ price: 1 });
    expect(res.status).toBe(403);
  });

  it("blocks unauthorized stock changes (403 for non-owner)", async () => {
    const owner = await registerSeller("OwnerShop3");
    const product = await seedProduct(owner.trader.id);
    const attacker = await registerSeller("AttackerShop2");
    const res = await attacker.agent.patch(`/api/products/${product.id}/stock`).send({ quantity: 0 });
    expect(res.status).toBe(403);
  });

  it("validates edit input (rejects non-positive price)", async () => {
    const { agent, trader } = await registerSeller("ValidatorShop");
    const product = await seedProduct(trader.id);
    const res = await agent.patch(`/api/products/${product.id}`).send({ price: -5 });
    expect(res.status).toBe(400);
  });
});

describe("guest social writes are blocked (login required)", () => {
  it.each([
    ["POST", "/api/likes"],
    ["DELETE", "/api/likes"],
    ["POST", "/api/favorites"],
    ["DELETE", "/api/favorites"],
    ["POST", "/api/follows"],
    ["DELETE", "/api/follows"],
    ["POST", "/api/comments"],
  ] as const)("%s %s -> 401 for guests", async (method, path) => {
    const res = await (method === "POST"
      ? request(app).post(path)
      : request(app).delete(path)
    ).send({ productId: "x", traderId: "x", userId: "guest_abc", userName: "G", content: "hi" });
    expect(res.status).toBe(401);
  });

  it("logged-in users can still like", async () => {
    const { agent, trader } = await registerSeller("SocialShop");
    const product = await seedProduct(trader.id);
    const res = await agent.post("/api/likes").send({ productId: product.id });
    expect([200, 201]).toContain(res.status);
  });

  it("guest reads still work (counts + feed)", async () => {
    const counts = await request(app).get("/api/likes/counts");
    expect(counts.status).toBe(200);
    const feed = await request(app).get("/api/feed/following/guest_reader");
    expect(feed.status).toBe(200);
  });
});

describe("follow feed identity guard", () => {
  it("blocks reading another account's following feed", async () => {
    const res = await request(app).get("/api/feed/following/some-real-account-id");
    expect(res.status).toBe(403);
  });

  it("allows a guest feed id", async () => {
    const res = await request(app).get("/api/feed/following/guest_abc");
    expect(res.status).toBe(200);
  });
});
