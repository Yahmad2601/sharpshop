import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { type Product } from "@shared/schema";
import { ProductCard } from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";

/**
 * Full-screen view of a single product — the same card used in the feed,
 * reached by tapping a product tile on a shop page (or a shared link).
 */
export default function ProductPage() {
  const params = useParams<{ productId: string }>();
  const [, setLocation] = useLocation();

  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ["/api/products", params.productId],
    enabled: !!params.productId,
  });

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />

      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col">
        {/* Back button overlay */}
        <div className="absolute top-4 left-4 z-30">
          <Button
            size="icon"
            variant="secondary"
            aria-label="Go back"
            onClick={goBack}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border-none text-white hover:bg-black/60"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </div>

        <main className="absolute inset-0 z-0 overflow-hidden">
          {isLoading ? (
            <ProductSkeleton />
          ) : isError || !product ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-white p-6">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h1 className="text-xl font-bold mb-2">Product not found</h1>
              <p className="text-white/70 text-center mb-6">
                This product may have been removed or the link is wrong.
              </p>
              <Button
                onClick={() => setLocation("/")}
                variant="outline"
                className="bg-white/10 border-white/20 text-white"
              >
                Browse Products
              </Button>
            </div>
          ) : (
            <ProductCard product={product} />
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
