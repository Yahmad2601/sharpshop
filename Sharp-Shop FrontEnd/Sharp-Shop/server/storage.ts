import { type User, type InsertUser, type Product, type InsertProduct, type Comment, type InsertComment, type Favorite, type InsertFavorite, type Like, type InsertLike, type Trader, type InsertTrader, type OrderWithProduct, type Follow, type InsertFollow } from "@shared/schema";
import { randomUUID } from "crypto";
import { supabase } from "./supabase";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  sessionStore: session.Store;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  
  createTrader(trader: InsertTrader): Promise<Trader>;
  getTrader(id: string): Promise<Trader | undefined>;
  getTraderByUserId(userId: string): Promise<Trader | undefined>;
  updateTrader(id: string, updates: Partial<InsertTrader>): Promise<Trader | undefined>;
  
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByTrader(traderId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStock(id: string, quantity: number): Promise<Product | undefined>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Comments
  getComment(id: string): Promise<Comment | undefined>;
  getCommentsByProduct(productId: string): Promise<Comment[]>;
  getCommentCounts(): Promise<Record<string, number>>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;

  // Favorites
  getFavoritesByUser(userId: string): Promise<Favorite[]>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  deleteFavorite(productId: string, userId: string): Promise<boolean>;
  isFavorite(productId: string, userId: string): Promise<boolean>;

  // Likes
  getLikeCount(productId: string): Promise<number>;
  getLikeCounts(): Promise<Record<string, number>>;
  getLikedProductIds(userId: string): Promise<string[]>;
  isLiked(productId: string, userId: string): Promise<boolean>;
  createLike(like: InsertLike): Promise<Like>;
  deleteLike(productId: string, userId: string): Promise<boolean>;

  // Orders (written by the Python payment service; read for the dashboard)
  getOrdersByTrader(traderId: string): Promise<OrderWithProduct[]>;

  // Follows
  getFollowerCount(traderId: string): Promise<number>;
  isFollowing(traderId: string, userId: string): Promise<boolean>;
  createFollow(follow: InsertFollow): Promise<Follow>;
  deleteFollow(traderId: string, userId: string): Promise<boolean>;
  getFollowedTraderIds(userId: string): Promise<string[]>;

  // Guest -> account data migration on login
  mergeGuestData(guestId: string, userId: string, userName: string): Promise<void>;
}

// Helper function to convert Supabase snake_case to camelCase
function toCamelCase(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  
  const converted: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    converted[camelKey] = obj[key];
  }
  return converted;
}

// Helper function to convert camelCase to snake_case for Supabase
function toSnakeCase(obj: any): any {
  if (!obj) return obj;
  
  const converted: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    converted[snakeKey] = obj[key];
  }
  return converted;
}

const mockProducts: Product[] = [
  {
    id: "prod_001",
    traderId: "trader_001",
    traderName: "SneakerHub NG",
    name: "Nike Air Max 97",
    price: 85000,
    description: "Brand new Nike Air Max 97 in Silver Bullet colorway. Size 42 available. Original box and receipt included. Perfect for sneaker enthusiasts looking for authentic footwear.",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    category: "Footwear",
    stockQuantity: 5,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_002",
    traderId: "trader_001",
    traderName: "SneakerHub NG",
    name: "iPhone 14 Pro Max",
    price: 750000,
    description: "Factory unlocked iPhone 14 Pro Max, 256GB Deep Purple. Battery health 100%. Comes with charger and case. No scratches or dents.",
    imageUrl: "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&q=80",
    category: "Electronics",
    stockQuantity: 2,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_003",
    traderId: "trader_002",
    traderName: "VintageVibes Lagos",
    name: "Vintage Denim Jacket",
    price: 25000,
    description: "Classic oversized vintage denim jacket. Unisex, fits M-XL. Slight distressing for that authentic vintage look. Perfect for layering.",
    imageUrl: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&q=80",
    category: "Fashion",
    stockQuantity: 8,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_004",
    traderId: "trader_002",
    traderName: "VintageVibes Lagos",
    name: "MacBook Pro M2",
    price: 1200000,
    description: "Apple MacBook Pro 14-inch M2 Pro chip, 16GB RAM, 512GB SSD. Space Gray. Used for only 3 months, in pristine condition with AppleCare+.",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
    category: "Electronics",
    stockQuantity: 1,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_005",
    traderId: "trader_003",
    traderName: "LuxeAccessories",
    name: "Designer Sunglasses",
    price: 45000,
    description: "Ray-Ban Aviator Classic sunglasses. Gold frame with green G-15 lenses. Comes with original case and cleaning cloth. 100% authentic.",
    imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80",
    category: "Accessories",
    stockQuantity: 0,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_006",
    traderId: "trader_003",
    traderName: "LuxeAccessories",
    name: "Sony WH-1000XM5",
    price: 180000,
    description: "Sony WH-1000XM5 wireless noise-canceling headphones in Black. Industry-leading ANC, 30-hour battery life. Barely used, with all accessories.",
    imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80",
    category: "Electronics",
    stockQuantity: 3,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_007",
    traderId: "trader_001",
    traderName: "SneakerHub NG",
    name: "Adidas Yeezy Boost 350",
    price: 120000,
    description: "Authentic Adidas Yeezy Boost 350 V2 'Zebra'. Size 44. Deadstock with tags. Verified through CheckCheck app.",
    imageUrl: "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&q=80",
    category: "Footwear",
    stockQuantity: 2,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
  {
    id: "prod_008",
    traderId: "trader_004",
    traderName: "TimePiece Gallery",
    name: "Luxury Watch Collection",
    price: 350000,
    description: "Premium automatic watch with sapphire crystal. Swiss movement, stainless steel case. Water resistant to 100m. Perfect gift.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
    category: "Accessories",
    stockQuantity: 4,
    isActive: true,
    whatsappNumber: "2348174930608",
  },
];

// Supabase Storage Implementation
export class SupabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return toCamelCase(data);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log('Looking up user:', username);
    // Try finding by username first
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    console.log('Username query result:', { hasData: !!data, error });
    
    // If not found by username, try finding by email
    if (!data && !error) {
      const emailResult = await supabase
        .from('users')
        .select('*')
        .eq('email', username)
        .maybeSingle();
      
      data = emailResult.data;
      error = emailResult.error;
      console.log('Email query result:', { hasData: !!data, error });
    }
    
    if (error) {
      console.error('getUserByUsername error:', error);
      return undefined;
    }
    return data ? toCamelCase(data) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) return undefined;
    return toCamelCase(data);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert([toSnakeCase(insertUser)])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteUser(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    return !error;
  }

  async createTrader(insertTrader: InsertTrader): Promise<Trader> {
    const id = randomUUID();
    const { data, error } = await supabase
      .from('traders')
      .insert([toSnakeCase({ ...insertTrader, id })])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async getTraderByUserId(userId: string): Promise<Trader | undefined> {
    const { data, error } = await supabase
      .from('traders')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) return undefined;
    return toCamelCase(data);
  }

  async getTrader(id: string): Promise<Trader | undefined> {
    const { data, error } = await supabase
      .from('traders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return undefined;
    return toCamelCase(data);
  }

  async updateTrader(id: string, updates: Partial<InsertTrader>): Promise<Trader | undefined> {
    const { data, error } = await supabase
      .from('traders')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return toCamelCase(data);
  }

  async getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    
    return data ? data.map(toCamelCase) : [];
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return toCamelCase(data);
  }

  async getProductsByTrader(traderId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('trader_id', traderId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching trader products:', error);
      return [];
    }
    
    return data ? data.map(toCamelCase) : [];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const productData = {
      ...insertProduct,
      traderName: insertProduct.traderName ?? "SharpShop Trader",
      category: insertProduct.category ?? "Electronics",
      stockQuantity: insertProduct.stockQuantity ?? 0,
      isActive: insertProduct.isActive ?? true,
      whatsappNumber: insertProduct.whatsappNumber ?? null,
    };

    const { data, error } = await supabase
      .from('products')
      .insert([toSnakeCase(productData)])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async updateProductStock(id: string, quantity: number): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .update({ stock_quantity: quantity })
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return toCamelCase(data);
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return toCamelCase(data);
  }

  async deleteProduct(id: string): Promise<boolean> {
    // Soft delete — keeps the row so existing orders still resolve the product
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    return !error;
  }

  // Comments methods
  async getComment(id: string): Promise<Comment | undefined> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return undefined;
    return toCamelCase(data);
  }

  async getCommentsByProduct(productId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
    
    return data ? data.map(toCamelCase) : [];
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert([toSnakeCase(insertComment)])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async getCommentCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('comments')
      .select('product_id');

    if (error) {
      console.error('Error fetching comment counts:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.product_id] = (counts[row.product_id] || 0) + 1;
    }
    return counts;
  }

  async deleteComment(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    return !error;
  }

  // Favorites methods
  async getFavoritesByUser(userId: string): Promise<Favorite[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
    
    return data ? data.map(toCamelCase) : [];
  }

  async createFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const { data, error } = await supabase
      .from('favorites')
      .insert([toSnakeCase(insertFavorite)])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteFavorite(productId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', userId);
    
    return !error;
  }

  async isFavorite(productId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('product_id', productId)
      .eq('user_id', userId)
      .single();
    
    return !!data && !error;
  }

  // Likes methods
  async getLikeCount(productId: string): Promise<number> {
    const { count, error } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);
    
    if (error) {
      console.error('Error fetching like count:', error);
      return 0;
    }
    
    return count || 0;
  }

  async getLikeCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('likes')
      .select('product_id');

    if (error) {
      console.error('Error fetching like counts:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.product_id] = (counts[row.product_id] || 0) + 1;
    }
    return counts;
  }

  async getLikedProductIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('likes')
      .select('product_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching liked products:', error);
      return [];
    }
    return (data || []).map((row) => row.product_id);
  }

  async isLiked(productId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('product_id', productId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  }

  async createLike(insertLike: InsertLike): Promise<Like> {
    const { data, error } = await supabase
      .from('likes')
      .insert([toSnakeCase(insertLike)])
      .select()
      .single();
    
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteLike(productId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', userId);

    return !error;
  }

  async getOrdersByTrader(traderId: string): Promise<OrderWithProduct[]> {
    // products(...) is a PostgREST embed via the orders.product_id FK
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(name, image_url)')
      .eq('trader_id', traderId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }

    return (data || []).map((row: any) => {
      const { products, ...order } = row;
      return {
        ...toCamelCase(order),
        productName: products?.name ?? null,
        productImageUrl: products?.image_url ?? null,
      };
    });
  }

  async getFollowerCount(traderId: string): Promise<number> {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('trader_id', traderId);

    if (error) {
      console.error('Error fetching follower count:', error);
      return 0;
    }
    return count || 0;
  }

  async isFollowing(traderId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('trader_id', traderId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  }

  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const { data, error } = await supabase
      .from('follows')
      .insert([toSnakeCase(insertFollow)])
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteFollow(traderId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('trader_id', traderId)
      .eq('user_id', userId);

    return !error;
  }

  async getFollowedTraderIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('trader_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching followed traders:', error);
      return [];
    }
    return (data || []).map((row) => row.trader_id);
  }

  async mergeGuestData(guestId: string, userId: string, userName: string): Promise<void> {
    // Reassign guest rows to the account; where the account already has the
    // same product (unique constraint), drop the guest duplicate instead.
    const guestFavorites = await this.getFavoritesByUser(guestId);
    for (const fav of guestFavorites) {
      if (await this.isFavorite(fav.productId, userId)) {
        await supabase.from('favorites').delete().eq('id', fav.id);
      } else {
        await supabase.from('favorites').update({ user_id: userId }).eq('id', fav.id);
      }
    }

    const { data: guestLikes } = await supabase
      .from('likes')
      .select('id, product_id')
      .eq('user_id', guestId);
    for (const like of guestLikes || []) {
      if (await this.isLiked(like.product_id, userId)) {
        await supabase.from('likes').delete().eq('id', like.id);
      } else {
        await supabase.from('likes').update({ user_id: userId }).eq('id', like.id);
      }
    }

    // Comments keep their content but take on the account identity
    await supabase
      .from('comments')
      .update({ user_id: userId, user_name: userName })
      .eq('user_id', guestId);

    const { data: guestFollows } = await supabase
      .from('follows')
      .select('id, trader_id')
      .eq('user_id', guestId);
    for (const follow of guestFollows || []) {
      if (await this.isFollowing(follow.trader_id, userId)) {
        await supabase.from('follows').delete().eq('id', follow.id);
      } else {
        await supabase.from('follows').update({ user_id: userId }).eq('id', follow.id);
      }
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private traders: Map<string, Trader>;
  private products: Map<string, Product>;
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.users = new Map();
    this.traders = new Map();
    this.products = new Map();
    
    mockProducts.forEach((product) => {
      this.products.set(product.id, product);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username || user.email === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      role: insertUser.role || 'buyer', 
      email: insertUser.email || null, 
      fullName: insertUser.fullName || null,
      businessName: insertUser.businessName || null,
      createdAt: new Date().toISOString()
    };
    this.users.set(id, user);
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async createTrader(insertTrader: InsertTrader): Promise<Trader> {
    const id = randomUUID();
    const trader: Trader = { 
      ...insertTrader,
      id,
      whatsappNumber: insertTrader.whatsappNumber || null,
      address: insertTrader.address || null,
      bio: insertTrader.bio || null,
      createdAt: new Date().toISOString()
    };
    this.traders.set(id, trader);
    return trader;
  }

  async getTraderByUserId(userId: string): Promise<Trader | undefined> {
    return Array.from(this.traders.values()).find(
      (trader) => trader.userId === userId,
    );
  }

  async getTrader(id: string): Promise<Trader | undefined> {
    return this.traders.get(id);
  }

  async updateTrader(id: string, updates: Partial<InsertTrader>): Promise<Trader | undefined> {
    const trader = this.traders.get(id);
    if (!trader) return undefined;
    const updated = { ...trader, ...updates } as Trader;
    this.traders.set(id, updated);
    return updated;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => p.isActive);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductsByTrader(traderId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (p) => p.traderId === traderId && p.isActive
    );
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      ...insertProduct,
      id,
      traderName: insertProduct.traderName ?? "SharpShop Trader",
      category: insertProduct.category ?? "Electronics",
      stockQuantity: insertProduct.stockQuantity ?? 0,
      isActive: insertProduct.isActive ?? true,
      whatsappNumber: insertProduct.whatsappNumber ?? null,
    };
    this.products.set(id, product);
    return product;
  }

  async updateProductStock(id: string, quantity: number): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updated = { ...product, stockQuantity: quantity };
    this.products.set(id, updated);
    return updated;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updated = { ...product, ...updates } as Product;
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const product = this.products.get(id);
    if (!product) return false;
    this.products.set(id, { ...product, isActive: false });
    return true;
  }

  // Comments methods (in-memory stubs)
  async getComment(id: string): Promise<Comment | undefined> {
    return undefined;
  }

  async getCommentsByProduct(productId: string): Promise<Comment[]> {
    return [];
  }

  async getCommentCounts(): Promise<Record<string, number>> {
    return {};
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const newComment: Comment = {
      id: randomUUID(),
      ...comment,
      userAvatar: comment.userAvatar || null,
      emojiReaction: comment.emojiReaction || null,
      createdAt: new Date().toISOString(),
    };
    return newComment;
  }

  async deleteComment(id: string): Promise<boolean> {
    return true;
  }

  // Favorites methods (in-memory stubs)
  async getFavoritesByUser(userId: string): Promise<Favorite[]> {
    return [];
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const newFavorite: Favorite = {
      id: randomUUID(),
      ...favorite,
      createdAt: new Date().toISOString(),
    };
    return newFavorite;
  }

  async deleteFavorite(productId: string, userId: string): Promise<boolean> {
    return true;
  }

  async isFavorite(productId: string, userId: string): Promise<boolean> {
    return false;
  }

  // Likes methods (in-memory stubs)
  async getLikeCount(productId: string): Promise<number> {
    return 0;
  }

  async getLikeCounts(): Promise<Record<string, number>> {
    return {};
  }

  async getLikedProductIds(userId: string): Promise<string[]> {
    return [];
  }

  async isLiked(productId: string, userId: string): Promise<boolean> {
    return false;
  }

  async createLike(like: InsertLike): Promise<Like> {
    const newLike: Like = {
      id: randomUUID(),
      ...like,
      createdAt: new Date().toISOString(),
    };
    return newLike;
  }

  async deleteLike(productId: string, userId: string): Promise<boolean> {
    return true;
  }

  async getOrdersByTrader(traderId: string): Promise<OrderWithProduct[]> {
    return [];
  }

  async getFollowerCount(traderId: string): Promise<number> {
    return 0;
  }

  async isFollowing(traderId: string, userId: string): Promise<boolean> {
    return false;
  }

  async createFollow(follow: InsertFollow): Promise<Follow> {
    return { id: randomUUID(), ...follow, createdAt: new Date().toISOString() };
  }

  async deleteFollow(traderId: string, userId: string): Promise<boolean> {
    return true;
  }

  async getFollowedTraderIds(userId: string): Promise<string[]> {
    return [];
  }

  async mergeGuestData(guestId: string, userId: string, userName: string): Promise<void> {
    // No-op: MemStorage doesn't persist likes/favorites/comments/follows
  }
}

// Use Supabase storage if credentials are available, otherwise use in-memory storage
const USE_SUPABASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

console.log('Storage backend:', USE_SUPABASE ? 'Supabase' : 'In-Memory');
if (USE_SUPABASE) {
  console.log('Supabase URL:', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
}

export const storage: IStorage = USE_SUPABASE ? new SupabaseStorage() : new MemStorage();
