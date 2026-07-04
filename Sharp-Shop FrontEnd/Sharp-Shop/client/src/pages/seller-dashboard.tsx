import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Product, Trader, OrderWithProduct } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { ProductEditModal } from "@/components/ProductEditModal";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Settings, 
  ChevronDown, 
  Star,
  Plus,
  Package,
  TrendingUp,
  Users,
  Edit,
  LogOut,
  Trash2,
  Phone
} from "lucide-react";

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  fulfilled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function formatOrderTime(raw: string): string {
  const date = new Date(raw);
  if (isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

function OrderRow({ order }: { order: OrderWithProduct }) {
  const details = order.deliveryDetails;
  return (
    <div className="bg-[#1E1E1E] rounded-2xl border border-white/5 p-3 flex gap-3">
      <div className="w-14 h-14 rounded-xl bg-white/5 overflow-hidden shrink-0">
        {order.productImageUrl ? (
          <img src={order.productImageUrl} alt={order.productName ?? "Product"} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Package className="w-full h-full p-3 text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-sm font-semibold truncate">{order.productName ?? "Unknown product"}</p>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${ORDER_STATUS_STYLES[order.status] ?? "bg-white/10 text-white/60 border-white/10"}`}>
            {order.status}
          </span>
        </div>
        <p className="text-emerald-400 text-sm font-bold">₦{Number(order.amount).toLocaleString()}</p>
        <p className="text-white/60 text-[11px]">
          {order.fulfillmentType === "pickup" ? "Pickup" : "Delivery"} • {formatOrderTime(order.createdAt)}
        </p>
        {details && (details.name || details.phone || details.address) && (
          <p className="text-white/60 text-[11px] mt-1 truncate">
            {[details.name, details.phone, details.address].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "seller")) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const { data: trader, isLoading: traderLoading } = useQuery<Trader>({
    queryKey: ["/api/trader/me"],
    enabled: !!user,
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/trader", trader?.id],
    enabled: !!trader?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/products") });
      toast({ title: "Product removed" });
      setDeletingProduct(null);
    },
    onError: () => {
      toast({ title: "Couldn't delete product", variant: "destructive" });
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithProduct[]>({
    queryKey: ["/api/orders/me"],
    enabled: !!trader?.id,
  });

  if (authLoading || traderLoading || productsLoading) {
    return (
      <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
        <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
        <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />
        
        <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black">
          <ProductSkeleton />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "seller") return null;

  const traderName = trader?.businessName || user.username;
  const username = traderName.toLowerCase().replace(/\s+/g, '') + "_official";
  const bio = trader?.bio || "No bio added yet.";
  const location = trader?.address || "Location not set";
  const whatsapp = trader?.whatsappNumber;

  // Real inventory stats derived from the product list
  const productCount = products?.length || 0;
  const totalStock = products?.reduce((sum, p) => sum + p.stockQuantity, 0) || 0;
  const outOfStock = products?.filter((p) => p.stockQuantity === 0).length || 0;
  const inventoryValue = products?.reduce((sum, p) => sum + p.price * p.stockQuantity, 0) || 0;

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />
      
      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-[#121212] flex flex-col overflow-y-auto scrollbar-hide">
        
        {/* Header Image & Nav */}
        <div className="relative h-48 w-full shrink-0">
            {/* Background Image */}
            <div className="absolute inset-0 bg-neutral-800">
                <img 
                    src={products?.[0]?.imageUrl || "https://images.unsplash.com/photo-1557683316-973673baf926"} 
                    alt="Cover" 
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#121212]" />
            </div>

            {/* Top Nav */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
                <Link href="/">
                    <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border-none text-white hover:bg-black/60">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border-none text-white hover:bg-black/60"
                      onClick={() => setIsEditingProfile(true)}
                    >
                        <Settings className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Log out"
                      className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border-none text-red-500 hover:bg-red-500/20"
                      onClick={() => setShowLogoutConfirm(true)}
                    >
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>

        {/* Profile Info */}
        <div className="px-4 -mt-12 relative z-10 flex-1 flex flex-col">
            <div className="flex items-end gap-4 mb-4">
                <Avatar className="w-24 h-24 border-4 border-[#121212] shadow-xl">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${traderName}`} />
                    <AvatarFallback className="bg-primary text-white text-2xl">{traderName[0]}</AvatarFallback>
                </Avatar>
                <div className="pb-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-white truncate">{traderName}</h1>
                        <div className="bg-emerald-500 rounded-full p-0.5">
                            <Star className="w-3 h-3 fill-white text-white" />
                        </div>
                    </div>
                    <p className="text-xs text-white/60 line-clamp-1">
                        {username}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
                <Button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full h-10 text-base border border-white/10"
                >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                </Button>
                
                <Button 
                    size="icon" 
                    variant="secondary" 
                    className={`h-10 w-10 rounded-full bg-white/10 border-none text-white hover:bg-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <ChevronDown className="w-6 h-6" />
                </Button>
            </div>

            {/* Stats Expansion Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden mb-4"
                    >
                        <div className="py-2">
                            <p className="text-base font-semibold text-white mb-3 px-1">Inventory Overview</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-white/60">
                                        <Package className="w-4 h-4 text-purple-500" />
                                        <span className="text-xs font-medium">Products</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{productCount}</p>
                                </div>
                                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-white/60">
                                        <Users className="w-4 h-4 text-blue-500" />
                                        <span className="text-xs font-medium">Units in Stock</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{totalStock}</p>
                                </div>
                                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-white/60">
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                        <span className="text-xs font-medium">Stock Value</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">₦{inventoryValue.toLocaleString()}</p>
                                </div>
                                <div className="bg-[#1E1E1E] p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-white/60">
                                        <Star className="w-4 h-4 text-red-500" />
                                        <span className="text-xs font-medium">Out of Stock</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{outOfStock}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info Buttons */}
            <div className="flex gap-3 mb-4 overflow-x-auto scrollbar-hide">
                <Button variant="outline" size="sm" className="rounded-full bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white h-8 text-xs">
                    <MapPin className="w-3 h-3 mr-2" />
                    {location}
                </Button>
                {whatsapp ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white h-8 text-xs"
                    onClick={() => window.open(`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`, '_blank')}
                  >
                      <Phone className="w-3 h-3 mr-2" />
                      {whatsapp}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="rounded-full bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white h-8 text-xs">
                      <Mail className="w-3 h-3 mr-2" />
                      No Contact Info
                  </Button>
                )}
            </div>

            {/* Bio */}
            <p className="text-white/90 mb-6 text-sm leading-relaxed">
                {bio}
            </p>

            {/* Tabs */}
            <Tabs defaultValue="products" className="w-full flex-1 flex flex-col">
                <TabsList className="w-full bg-transparent border-b border-white/10 p-0 h-auto rounded-none shrink-0">
                    <TabsTrigger 
                        value="products" 
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 text-white/60 pb-3 font-bold text-sm uppercase tracking-wide"
                    >
                        My Products
                    </TabsTrigger>
                    <TabsTrigger
                        value="orders"
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 text-white/60 pb-3 font-bold text-sm uppercase tracking-wide"
                    >
                        Orders{orders && orders.length > 0 ? ` (${orders.length})` : ""}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="mt-0 flex-1">
                    <div className="grid grid-cols-3 gap-0.5 pb-20">
                        {products?.map((product) => (
                            <div key={product.id} className="aspect-[3/4] relative bg-white/5 group overflow-hidden">
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 w-8 p-0 rounded-full bg-white text-black hover:bg-white/90"
                                        onClick={() => setEditingProduct(product)}
                                        aria-label={`Edit ${product.name}`}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-8 w-8 p-0 rounded-full"
                                        onClick={() => setDeletingProduct(product)}
                                        aria-label={`Delete ${product.name}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                    <p className="text-white text-[10px] font-bold truncate">{product.name}</p>
                                    <p className="text-white/70 text-[9px]">₦{product.price.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                        
                        {/* Fill with placeholders if few products */}
                        {Array.from({ length: Math.max(0, 9 - (products?.length || 0)) }).map((_, i) => (
                            <div key={`placeholder-${i}`} className="aspect-[3/4] bg-white/5" />
                        ))}
                    </div>
                </TabsContent>
                
                <TabsContent value="orders" className="mt-0 flex-1">
                    {ordersLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/40">
                            <p className="text-sm">Loading orders…</p>
                        </div>
                    ) : orders && orders.length > 0 ? (
                        <div className="space-y-3 pt-3 pb-20">
                            {orders.map((order) => (
                                <OrderRow key={order.id} order={order} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-white/40">
                            <Package className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm">No orders yet</p>
                            <p className="text-xs mt-1 text-white/50">Paid orders will appear here automatically</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
      </div>

      <ProductEditModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
      />

      <ProfileEditModal
        trader={trader}
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
      />

      <LogoutConfirmDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm} />

      <AlertDialog open={!!deletingProduct} onOpenChange={(o) => !o && setDeletingProduct(null)}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this product?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              "{deletingProduct?.name}" will be hidden from your shop. This can't be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProduct && deleteMutation.mutate(deletingProduct.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
