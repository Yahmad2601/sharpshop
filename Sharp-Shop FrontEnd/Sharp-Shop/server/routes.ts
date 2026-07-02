import type { Express, Request } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  insertCommentSchema,
  insertFavoriteSchema,
  insertLikeSchema,
} from "@shared/schema";

// Guests are identified by a client-generated "guest_*" id; authenticated users
// must act as themselves — never trust a userId from the body when logged in.
function effectiveUserId(req: Request, bodyUserId: unknown): string {
  if (req.isAuthenticated()) return String(req.user!.id);
  return typeof bodyUserId === "string" ? bodyUserId : "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.patch("/api/products/:id/stock", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { quantity } = req.body;
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      // Only the trader who owns the product may change its stock
      const trader = await storage.getTraderByUserId(req.user!.id);
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (!trader || existing.traderId !== trader.id) {
        return res.status(403).json({ message: "You don't own this product" });
      }

      const product = await storage.updateProductStock(req.params.id, quantity);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update stock" });
    }
  });

  app.get("/api/products/trader/:traderId", async (req, res) => {
    try {
      const products = await storage.getProductsByTrader(req.params.traderId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trader products" });
    }
  });

  // Adopt a guest browsing identity into the logged-in account so
  // likes/favorites/comments made before signup aren't lost.
  app.post("/api/user/merge-guest", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { guestId } = req.body;
      if (typeof guestId !== "string" || !guestId.startsWith("guest_")) {
        return res.status(400).json({ message: "Invalid guest id" });
      }
      await storage.mergeGuestData(guestId, String(req.user!.id), req.user!.username);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to merge guest data" });
    }
  });

  // Trader routes
  app.get("/api/trader/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const trader = await storage.getTraderByUserId(req.user!.id);
      if (!trader) {
        return res.status(404).json({ message: "Trader profile not found" });
      }
      res.json(trader);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trader profile" });
    }
  });

  app.get("/api/traders/:traderId", async (req, res) => {
    try {
      const trader = await storage.getTrader(req.params.traderId);
      if (!trader) {
        return res.status(404).json({ message: "Trader not found" });
      }
      res.json(trader);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trader" });
    }
  });

  // Comment routes
  // NOTE: must be registered before /api/comments/:productId so "counts"
  // isn't captured as a product id.
  app.get("/api/comments/counts", async (_req, res) => {
    try {
      const counts = await storage.getCommentCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comment counts" });
    }
  });

  app.get("/api/comments/:productId", async (req, res) => {
    try {
      const comments = await storage.getCommentsByProduct(req.params.productId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", async (req, res) => {
    try {
      const parsed = insertCommentSchema.safeParse({
        ...req.body,
        userId: effectiveUserId(req, req.body?.userId),
        // Logged-in users comment under their own name
        userName: req.isAuthenticated() ? req.user!.username : req.body?.userName,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid comment", errors: parsed.error.flatten().fieldErrors });
      }
      if (!parsed.data.content.trim() || parsed.data.content.length > 1000) {
        return res.status(400).json({ message: "Comment must be 1-1000 characters" });
      }

      const comment = await storage.createComment(parsed.data);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const comment = await storage.getComment(req.params.id);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      if (comment.userId !== String(req.user!.id)) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }

      await storage.deleteComment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Favorite routes
  app.get("/api/favorites/:userId", async (req, res) => {
    try {
      // Guest ids are unguessable client tokens; real account ids may only be
      // read by their owner.
      const targetId = req.params.userId;
      if (!targetId.startsWith("guest_") &&
          (!req.isAuthenticated() || String(req.user!.id) !== targetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const favorites = await storage.getFavoritesByUser(targetId);
      res.json(favorites);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const parsed = insertFavoriteSchema.safeParse({
        ...req.body,
        userId: effectiveUserId(req, req.body?.userId),
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid favorite" });
      }

      // Idempotent: favoriting twice returns the existing state
      if (await storage.isFavorite(parsed.data.productId, parsed.data.userId)) {
        return res.status(200).json(parsed.data);
      }

      const favorite = await storage.createFavorite(parsed.data);
      res.status(201).json(favorite);
    } catch (error) {
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites", async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = effectiveUserId(req, req.body?.userId);
      if (typeof productId !== "string" || !userId) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const success = await storage.deleteFavorite(productId, userId);
      if (!success) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get("/api/favorites/check/:productId/:userId", async (req, res) => {
    try {
      const isFavorite = await storage.isFavorite(req.params.productId, req.params.userId);
      res.json({ isFavorite });
    } catch (error) {
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Like routes
  app.get("/api/likes/counts", async (_req, res) => {
    try {
      const counts = await storage.getLikeCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch like counts" });
    }
  });

  app.get("/api/likes/user/:userId", async (req, res) => {
    try {
      const targetId = req.params.userId;
      if (!targetId.startsWith("guest_") &&
          (!req.isAuthenticated() || String(req.user!.id) !== targetId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const productIds = await storage.getLikedProductIds(targetId);
      res.json(productIds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch liked products" });
    }
  });

  app.get("/api/likes/count/:productId", async (req, res) => {
    try {
      const count = await storage.getLikeCount(req.params.productId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch like count" });
    }
  });

  app.get("/api/likes/check/:productId/:userId", async (req, res) => {
    try {
      const isLiked = await storage.isLiked(req.params.productId, req.params.userId);
      res.json({ isLiked });
    } catch (error) {
      res.status(500).json({ message: "Failed to check like status" });
    }
  });

  app.post("/api/likes", async (req, res) => {
    try {
      const parsed = insertLikeSchema.safeParse({
        ...req.body,
        userId: effectiveUserId(req, req.body?.userId),
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid like" });
      }

      // Idempotent: double-tap must not create duplicate rows and inflate counts
      if (await storage.isLiked(parsed.data.productId, parsed.data.userId)) {
        return res.status(200).json(parsed.data);
      }

      const like = await storage.createLike(parsed.data);
      res.status(201).json(like);
    } catch (error) {
      res.status(500).json({ message: "Failed to add like" });
    }
  });

  app.delete("/api/likes", async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = effectiveUserId(req, req.body?.userId);
      if (typeof productId !== "string" || !userId) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const success = await storage.deleteLike(productId, userId);
      if (!success) {
        return res.status(404).json({ message: "Like not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove like" });
    }
  });

  return httpServer;
}
