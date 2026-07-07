import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Product, type ProductCategory } from "@shared/schema";
import { ProductCard } from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId } from "@/lib/guest";
import { AlertCircle, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Only cards within this many positions of the visible one are fully mounted;
// the rest render as same-height shells so a 200-product feed stays light.
const RENDER_WINDOW = 2;

function FeedContent({ products, storageKey }: { products: Product[]; storageKey: string }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const previousProductCountRef = useRef<number>(products.length);
  const rafRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const key = `feedScroll:${storageKey}`;

  const handleScroll = useCallback(() => {
    // rAF-throttled: one state update + one sessionStorage write per frame max
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = feedRef.current;
      if (!el || el.clientHeight === 0) return;
      sessionStorage.setItem(key, String(el.scrollTop));
      const idx = Math.round(el.scrollTop / el.clientHeight);
      setCurrentIndex((prev) => (prev === idx ? prev : idx));
    });
  }, [key]);

  // Restore the last scroll position on mount (e.g. returning from a seller
  // profile). Runs before paint so there's no visible jump back to the top.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      el.scrollTop = Number(saved);
      if (el.clientHeight > 0) setCurrentIndex(Math.round(Number(saved) / el.clientHeight));
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [key, handleScroll]);

  // Auto-scroll to top only when NEW products arrive (not on remount)
  useEffect(() => {
    if (products.length > previousProductCountRef.current && feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: "smooth" });
      sessionStorage.setItem(key, "0");
    }
    previousProductCountRef.current = products.length;
  }, [products.length, key]);

  return (
    <div
      ref={feedRef}
      data-testid="product-feed"
      role="region"
      aria-label="Product feed"
      tabIndex={0}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/40"
    >
      {products.map((product, i) =>
        Math.abs(i - currentIndex) <= RENDER_WINDOW ? (
          <ProductCard key={product.id} product={product} />
        ) : (
          // Placeholder shell with identical sizing/snap so scroll geometry is stable
          <div
            key={product.id}
            className="h-full w-full snap-start snap-always flex-shrink-0 bg-neutral-900"
          />
        )
      )}
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

function DropsEmptyState() {
  return (
    <div
      data-testid="drops-empty-state"
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6"
    >
      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
        <span className="text-4xl" aria-hidden="true">🔥</span>
      </div>
      <h2 className="text-xl font-bold mb-2">No live drops right now</h2>
      <p className="text-white/70 text-center">
        Pre-order drops from bakers and makers will appear here — first come,
        first served.
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

type FeedMode = "forYou" | "following" | "drops";

function FeedTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-[15px] font-bold pb-1 border-b-2 transition-colors drop-shadow-md ${
        active ? "text-white border-white" : "text-white/60 border-transparent hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>("forYou");
  const { user } = useAuth();
  const followUserId = user?.id ? String(user.id) : getGuestId();

  // Guests roam freely; the login modal only appears when they attempt an
  // interaction (like/save/comment/follow) via promptLogin().

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSelectedCategory(null);
  };

  // Move focus into the search input when search mode opens, and back to the
  // search launcher when it closes, so keyboard/SR users aren't dropped on <body>.
  // The ref guard keeps it from stealing focus on initial page load.
  const wasSearchOpenRef = useRef(false);
  useEffect(() => {
    if (searchOpen === wasSearchOpenRef.current) return;
    wasSearchOpenRef.current = searchOpen;
    const selector = searchOpen ? '[data-testid="input-search"]' : '[data-testid="button-open-search"]';
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [searchOpen]);

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

  // Live pre-order drops: deadline still open (or none) with slots left,
  // soonest deadline first — derived from the main products list.
  const dropsProducts = useMemo(() => {
    const now = Date.now();
    return (forYouQuery.data ?? [])
      .filter(
        (p) =>
          p.isPreorder &&
          p.stockQuantity > 0 &&
          (!p.orderDeadline || new Date(p.orderDeadline).getTime() > now)
      )
      .sort((a, b) => {
        const da = a.orderDeadline ? new Date(a.orderDeadline).getTime() : Infinity;
        const db = b.orderDeadline ? new Date(b.orderDeadline).getTime() : Infinity;
        return da - db;
      });
  }, [forYouQuery.data]);

  const activeQuery = feedMode === "following" ? followingQuery : forYouQuery;
  const { isLoading, isError, refetch } = activeQuery;
  const products = feedMode === "drops" ? dropsProducts : activeQuery.data;

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
    content =
      feedMode === "following" ? <FollowingEmptyState />
      : feedMode === "drops" ? <DropsEmptyState />
      : <NoProductsState />;
  } else if (filteredProducts.length === 0) {
    content = <EmptyState />;
  } else {
    content = <FeedContent products={filteredProducts} storageKey={feedMode} />;
  }

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />

      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col">
        <h1 className="sr-only">
          SharpShop — {feedMode === "following" ? "Following" : feedMode === "drops" ? "Drops" : "For You"} feed
        </h1>

        {/* Minimal top chrome — TikTok style: centered feed tabs, search on the right */}
        <header className="absolute top-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
          <div className="space-y-3 pointer-events-auto">
            {searchOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchBar
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search products..."
                    />
                  </div>
                  <Button
                    data-testid="button-close-search"
                    size="icon"
                    variant="ghost"
                    onClick={closeSearch}
                    className="h-10 w-10 bg-white/10 border border-white/20 text-white backdrop-blur-md shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <CategoryFilter
                  selected={selectedCategory}
                  onSelect={setSelectedCategory}
                />

                {hasActiveFilters && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm">
                      {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""}
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
              </>
            ) : (
              <div className="relative flex items-center justify-center h-10">
                <div className="flex items-center gap-5">
                  <FeedTab active={feedMode === "following"} onClick={() => setFeedMode("following")}>
                    Following
                  </FeedTab>
                  <FeedTab active={feedMode === "forYou"} onClick={() => setFeedMode("forYou")}>
                    For You
                  </FeedTab>
                  <FeedTab active={feedMode === "drops"} onClick={() => setFeedMode("drops")}>
                    Drops 🔥
                  </FeedTab>
                </div>
                <button
                  data-testid="button-open-search"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search products"
                  className="absolute right-0 text-white/80 hover:text-white p-2"
                >
                  <Search className="w-6 h-6 drop-shadow-md" />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="absolute inset-0 z-0">
          {content}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
