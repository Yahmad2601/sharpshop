import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Product, type ProductCategory } from "@shared/schema";
import { ProductCard } from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AuthModal } from "@/components/AuthModal";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId } from "@/lib/guest";
import { AlertCircle, RefreshCw, Search, Heart, User, LogOut, LayoutDashboard, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function FeedContent({ products, storageKey }: { products: Product[]; storageKey: string }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const previousProductCountRef = useRef<number>(products.length);
  const key = `feedScroll:${storageKey}`;

  // Restore the last scroll position on mount (e.g. returning from a seller
  // profile) and keep it saved as the user scrolls. Runs before paint so there's
  // no visible jump back to the top.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(key);
    if (saved) el.scrollTop = Number(saved);
    const onScroll = () => sessionStorage.setItem(key, String(el.scrollTop));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  // Auto-scroll to top only when NEW products arrive (not on remount)
  useEffect(() => {
    if (products.length > previousProductCountRef.current && feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      sessionStorage.setItem(key, "0");
    }
    previousProductCountRef.current = products.length;
  }, [products.length, key]);

  return (
    <div
      ref={feedRef}
      data-testid="product-feed"
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      <ProductSkeleton />
      <ProductSkeleton />
      <ProductSkeleton />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="error-state"
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6"
    >
      <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-white/70 text-center mb-6">
        We couldn't load the products. Please try again.
      </p>
      <Button
        data-testid="button-retry"
        onClick={onRetry}
        variant="outline"
        className="gap-2 bg-white/10 border-white/20 text-white"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty-state"
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6"
    >
      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
        <Search className="w-10 h-10 text-white/50" />
      </div>
      <h2 className="text-xl font-bold mb-2">No products found</h2>
      <p className="text-white/70 text-center">
        Try adjusting your search or filter to find what you're looking for.
      </p>
    </div>
  );
}

function NoProductsState() {
  return (
    <div
      data-testid="no-products-state"
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6"
    >
      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
        <Search className="w-10 h-10 text-white/50" />
      </div>
      <h2 className="text-xl font-bold mb-2">No products yet</h2>
      <p className="text-white/70 text-center">
        Check back soon for amazing deals!
      </p>
    </div>
  );
}

function FollowingEmptyState() {
  return (
    <div
      data-testid="following-empty-state"
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6"
    >
      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
        <UserPlus className="w-10 h-10 text-white/50" />
      </div>
      <h2 className="text-xl font-bold mb-2">Your Following feed is empty</h2>
      <p className="text-white/70 text-center">
        Follow shops you love and their latest products will show up here.
      </p>
    </div>
  );
}

type FeedMode = "forYou" | "following";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>("forYou");
  const { count: favoritesCount } = useFavorites();
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const followUserId = user?.id ? String(user.id) : getGuestId();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Show auth modal if user is not logged in and auth check is done
  useEffect(() => {
    if (!isAuthLoading && !user) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [isAuthLoading, user]);

  // Realtime updates come from the app-level subscription (use-realtime-sync);
  // the slow poll is only a fallback in case the websocket drops.
  const forYouQuery = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchInterval: 60_000,
  });

  const followingQuery = useQuery<Product[]>({
    queryKey: ["/api/feed/following", followUserId],
    enabled: feedMode === "following",
  });

  const { data: products, isLoading, isError, refetch } =
    feedMode === "following" ? followingQuery : forYouQuery;

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((product) => {
      const matchesSearch = searchQuery === "" || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === null || 
        product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const hasActiveFilters = searchQuery !== "" || selectedCategory !== null;

  let content;
  if (isLoading) {
    content = <LoadingState />;
  } else if (isError) {
    content = <ErrorState onRetry={() => refetch()} />;
  } else if (!products || products.length === 0) {
    content = feedMode === "following" ? <FollowingEmptyState /> : <NoProductsState />;
  } else if (filteredProducts.length === 0) {
    content = <EmptyState />;
  } else {
    content = <FeedContent products={filteredProducts} storageKey={feedMode} />;
  }

  return (
    <div className="h-screen h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />
      
      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="space-y-3 pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar 
                  value={searchQuery} 
                  onChange={setSearchQuery}
                  placeholder="Search products..."
                />
              </div>
              <Link href="/favorites">
                <Button
                  data-testid="button-favorites"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 bg-white/10 border border-white/20 text-white relative backdrop-blur-md"
                >
                  <Heart className="w-5 h-5" />
                  {favoritesCount > 0 && (
                    <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-0.5 rounded-full flex items-center justify-center border border-black/20 shadow-sm">
                      {favoritesCount}
                    </div>
                  )}
                </Button>
              </Link>

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 bg-white/10 border border-white/20 text-white backdrop-blur-md"
                    >
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-semibold">{user.username}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {user.role}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.role === "seller" && (
                      <>
                        <Link href="/seller/dashboard">
                          <DropdownMenuItem className="cursor-pointer">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Dashboard
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            
            {/* For You / Following toggle */}
            <div className="flex items-center justify-center gap-6">
              <button
                data-testid="tab-for-you"
                onClick={() => setFeedMode("forYou")}
                className={`text-sm font-bold pb-1 border-b-2 transition-colors ${
                  feedMode === "forYou"
                    ? "text-white border-white"
                    : "text-white/50 border-transparent hover:text-white/80"
                }`}
              >
                For You
              </button>
              <button
                data-testid="tab-following"
                onClick={() => setFeedMode("following")}
                className={`text-sm font-bold pb-1 border-b-2 transition-colors ${
                  feedMode === "following"
                    ? "text-white border-white"
                    : "text-white/50 border-transparent hover:text-white/80"
                }`}
              >
                Following
              </button>
            </div>

            <CategoryFilter
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm">
                  {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                </span>
                <Button
                  data-testid="button-clear-filters"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory(null);
                  }}
                  className="text-white/70 text-sm h-auto py-1 px-2"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          {content}
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
}
