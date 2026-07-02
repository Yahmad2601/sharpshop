import type { Express, Request } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  type Product,
  insertCommentSchema,
  insertFavoriteSchema,
  insertLikeSchema,
  insertFollowSchema,
} from "@shared/schema";

const PRODUCT_UPDATABLE_FIELDS = ["name", "price", "description", "category", "stockQuantity", "isActive"] as const;

// Guests are identified by a client-generated "guest_*" id; authenticated users
// must act as themselves — never trust a userId from the body when logged in.
function effectiveUserId(req: Request, bodyUserId: unknown): string {
  if (req.isAuthenticated()) return String(req.user!.id);
  return typeof bodyUserId === "string" ? bodyUserId : "";
}

// Resolves the product and confirms the logged-in seller owns it.
// Returns an HTTP status + message on failure, or the product on success.
async function requireProductOwner(req: Request):
  Promise<{ ok: true; product: Product } | { ok: false; status: number; message: string }> {
  if (!req.isAuthenticated()) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const trader = await storage.getTraderByUserId(req.user!.id);
  const product = await storage.getProduct(req.params.id);
  if (!product) {
    return { ok: false, status: 404, message: "Product not found" };
  }
  if (!trader || product.traderId !== trader.id) {
    return { ok: false, status: 403, message: "You don't own this product" };
  }
  return { ok: true, product };
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
    try {
      const { quantity } = req.body;
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      const owner = await requireProductOwner(req);
      if (!owner.ok) {
        return res.status(owner.status).json({ message: owner.message });
      }

      const product = await storage.updateProductStock(req.params.id, quantity);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update stock" });
    }
  });

  // Full product edit (seller only, own products)
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const owner = await requireProductOwner(req);
      if (!owner.ok) {
        return res.status(owner.status).json({ message: owner.message });
      }

      const updates: Record<string, unknown> = {};
      for (const field of PRODUCT_UPDATABLE_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (typeof updates.name === "string" && !updates.name.trim()) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      if (updates.price !== undefined &&
          (typeof updates.price !== "number" || updates.price <= 0)) {
        return res.status(400).json({ message: "Price must be greater than 0" });
      }
      if (updates.stockQuantity !== undefined &&
          (typeof updates.stockQuantity !== "number" || !Number.isInteger(updates.stockQuantity) || updates.stockQuantity < 0)) {
        return res.status(400).json({ message: "Stock must be a non-negative integer" });
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const product = await storage.updateProduct(req.params.id, updates);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Soft-delete a product (seller only, own products)
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const owner = await requireProductOwner(req);
      if (!owner.ok) {
        return res.status(owner.status).json({ message: owner.message });
      }
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
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

  app.patch("/api/trader/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const trader = await storage.getTraderByUserId(req.user!.id);
      if (!trader) {
        return res.status(404).json({ message: "Trader profile not found" });
      }

      const allowed = ["businessName", "whatsappNumber", "address", "bio"] as const;
      const updates: Record<string, unknown> = {};
      for (const field of allowed) {
        if (typeof req.body[field] === "string") updates[field] = req.body[field];
      }
      if (updates.businessName !== undefined && !(updates.businessName as string).trim()) {
        return res.status(400).json({ message: "Business name cannot be empty" });
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updated = await storage.updateTrader(trader.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
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

  // Follow routes
  app.get("/api/follows/count/:traderId", async (req, res) => {
    try {
      const count = await storage.getFollowerCount(req.params.traderId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch follower count" });
    }
  });

  app.get("/api/follows/check/:traderId/:userId", async (req, res) => {
    try {
      const isFollowing = await storage.isFollowing(req.params.traderId, req.params.userId);
      res.json({ isFollowing });
    } catch (error) {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  app.post("/api/follows", async (req, res) => {
    try {
      const parsed = insertFollowSchema.safeParse({
        ...req.body,
        userId: effectiveUserId(req, req.body?.userId),
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid follow" });
      }
      // Idempotent
      if (await storage.isFollowing(parsed.data.traderId, parsed.data.userId)) {
        return res.status(200).json(parsed.data);
      }
      const follow = await storage.createFollow(parsed.data);
      res.status(201).json(follow);
    } catch (error) {
      res.status(500).json({ message: "Failed to follow" });
    }
  });

  app.delete("/api/follows", async (req, res) => {
    try {
      const { traderId } = req.body;
      const userId = effectiveUserId(req, req.body?.userId);
      if (typeof traderId !== "string" || !userId) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const success = await storage.deleteFollow(traderId, userId);
      if (!success) {
        return res.status(404).json({ message: "Follow not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to unfollow" });
    }
  });

  // Orders for the logged-in seller (identity comes from the session,
  // so a seller can only ever see their own orders)
  app.get("/api/orders/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const trader = await storage.getTraderByUserId(req.user!.id);
      if (!trader) {
        return res.status(404).json({ message: "Trader profile not found" });
      }
      const orders = await storage.getOrdersByTrader(trader.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
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
