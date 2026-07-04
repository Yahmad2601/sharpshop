import { useQuery } from "@tanstack/react-query";
import { type Product } from "@shared/schema";
import { ProductCard } from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { useFavorites } from "@/hooks/use-favorites";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Favorites() {
  const { favorites } = useFavorites();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const favoriteProducts = products?.filter((p) => favorites.includes(p.id)) || [];

  if (isLoading) {
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

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />
      
      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link href="/">
              <Button
                data-testid="button-back"
                size="icon"
                variant="ghost"
                className="h-10 w-10 bg-white/10 border border-white/20 text-white backdrop-blur-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-md">My Favorites</h1>
              <p className="text-sm text-white/80 drop-shadow-md">{favoriteProducts.length} saved items</p>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          {favoriteProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center pt-20">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
                <Heart className="w-10 h-10 text-white/50" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No favorites yet</h2>
              <p className="text-white/70 mb-6">
                Tap the heart on products you love to save them here
              </p>
              <Link href="/">
                <Button
                  data-testid="button-browse"
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white"
                >
                  Browse Products
                </Button>
              </Link>
            </div>
          ) : (
            <div
              data-testid="favorites-feed"
              className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
            >
              {favoriteProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
