import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("buyer"), // 'buyer' or 'seller'
  fullName: text("full_name"),
  businessName: text("business_name"), // Only for sellers
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
  fullName: true,
  businessName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const traders = pgTable("traders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Link to users table (UUID)
  businessName: text("business_name").notNull(),
  whatsappNumber: text("whatsapp_number"),
  address: text("address"),
  bio: text("bio"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertTraderSchema = createInsertSchema(traders).omit({
  id: true,
  createdAt: true,
});

export type InsertTrader = z.infer<typeof insertTraderSchema>;
export type Trader = typeof traders.$inferSelect;

export const PRODUCT_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Footwear",
  "Accessories",
  "Home & Living",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traderId: varchar("trader_id").notNull(),
  traderName: text("trader_name").notNull().default("SharpShop Trader"),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull().default("Electronics"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  whatsappNumber: text("whatsapp_number"),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Comments schema
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  emojiReaction: text("emoji_reaction"),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Favorites schema
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// Orders schema — written by the Python payment service, read here for the
// seller dashboard. Must stay in sync with supabase_migration.sql.
export const ORDER_STATUSES = ["pending", "paid", "failed", "fulfilled"] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey(),
  traderId: text("trader_id").notNull(),
  productId: varchar("product_id").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("NGN"),
  fulfillmentType: text("fulfillment_type"),
  deliveryDetails: jsonb("delivery_details").$type<Record<string, string> | null>(),
  status: text("status").notNull().default("pending"),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export type Order = typeof orders.$inferSelect;

// Order enriched with product info for the dashboard list
export type OrderWithProduct = Order & {
  productName: string | null;
  productImageUrl: string | null;
};

// Likes schema
export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likes.$inferSelect;

// Follows schema — a user (or guest) following a trader/shop
export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traderId: text("trader_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").default(sql`(current_timestamp)`),
});

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof follows.$inferSelect;
