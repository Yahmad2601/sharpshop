import { useState, memo, forwardRef } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Bookmark, Share2, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { type Product } from "@shared/schema";
import { StockIndicator } from "./StockIndicator";
import { ActionButtons } from "./ActionButtons";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/use-favorites";
import { useLikes } from "@/hooks/use-likes";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentSection } from "./CommentSection";
import { ProductChatModal } from "./ProductChatModal";
import { CHAT_API_BASE } from "@/lib/api";
import { shareLink } from "@/lib/share";

interface ProductCardProps {
  product: Product;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(price)
    .replace("NGN", "₦");
}

/** One button in the TikTok-style right action rail.
 * forwardRef + prop spreading so it also works as a Radix `asChild` trigger
 * (the comments DrawerTrigger clones onClick/ref onto it). */
interface RailButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string | number;
  testId?: string;
}

const RailButton = forwardRef<HTMLButtonElement, RailButtonProps>(
  ({ label, children, testId, ...rest }, ref) => (
    <button
      ref={ref}
      data-testid={testId}
      {...rest}
      className="flex flex-col items-center gap-1"
    >
      {children}
      <span className="text-white text-xs font-semibold drop-shadow-md min-h-[14px]">
        {label ?? ""}
      </span>
    </button>
  )
);
RailButton.displayName = "RailButton";

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const [, setLocation] = useLocation();
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { toast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { likeCount, isLiked, toggleLike } = useLikes(product.id);
  const { user } = useAuth();

  const isSoldOut = product.stockQuantity === 0;
  const isProductFavorite = isFavorite(product.id);

  const handleBuyClick = async () => {
    try {
      toast({ title: "Processing...", description: "Setting up payment" });

      const response = await fetch(`${CHAT_API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trader_id: product.traderId,
          product_id: product.id,
          customer_email: user?.email || "customer@sharpshop.app",
          customer_name: user?.fullName || user?.username || "SharpShop Customer",
        }),
      });

      if (!response.ok) throw new Error("Failed to create order");

      const data = await response.json();

      // @ts-ignore - FlutterwaveCheckout is loaded via script tag
      if (window.FlutterwaveCheckout) {
        // @ts-ignore
        window.FlutterwaveCheckout({
          public_key: data.public_key,
          tx_ref: data.tx_ref,
          amount: data.amount,
          currency: data.currency,
          payment_options: "card, banktransfer, ussd",
          customer: {
            email: data.customer_email,
            phone_number: data.customer_phone,
            name: data.customer_name,
          },
          customizations: {
            title: "SharpShop",
            description: `Payment for ${data.product_name}`,
            logo: window.location.origin + "/favicon.svg",
          },
          callback: async function (response: { status: string; transaction_id: string }) {
            if (response.status !== "successful") return;
            // Confirm with the backend (it verifies amount/currency with
            // Flutterwave) rather than trusting the client-side status.
            try {
              const verifyRes = await fetch(
                `${CHAT_API_BASE}/api/payment/verify?order_id=${encodeURIComponent(data.order_id)}`
              );
              const verify = await verifyRes.json();
              if (verify.status === "paid") {
                toast({
                  title: "Payment Successful! 🎉",
                  description: "Your order has been placed and the seller notified.",
                });
                return;
              }
            } catch (verifyErr) {
              console.error("Payment verification failed:", verifyErr);
            }
            toast({
              title: "Payment received",
              description: "We're confirming it with the payment provider — check back shortly.",
            });
          },
          onclose: function () {},
        });
      } else {
        throw new Error("Payment system not loaded");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: "Failed to open payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    const result = await shareLink(window.location.href, {
      title: product.name,
      text: `Check out ${product.name} on SharpShop!`,
    });
    if (result === "copied") {
      toast({ title: "Link copied!", description: "Product link copied to clipboard." });
    } else if (result === "failed") {
      toast({ title: "Couldn't share", description: "Please copy the link from your address bar.", variant: "destructive" });
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, { offset }) => {
        if (offset.x < -50) {
          setLocation(`/trader/${product.traderId}`);
        }
      }}
      data-testid={`card-product-${product.id}`}
      className="h-full min-h-screen md:min-h-full w-full snap-start snap-always relative flex flex-col justify-end overflow-hidden flex-shrink-0"
    >
      {!imageError ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900" />
      )}

      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 animate-pulse" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

      {/* Right action rail — TikTok style */}
      <div className="absolute bottom-40 right-2 z-20 flex flex-col gap-4 items-center">
        {/* Seller avatar with the follow "+" — tap to open the shop */}
        <Link href={`/trader/${product.traderId}`}>
          <div className="relative cursor-pointer mb-1" data-testid={`rail-avatar-${product.id}`}>
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(product.traderName)}`} />
              <AvatarFallback className="bg-primary text-white text-sm">{product.traderName[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-500 rounded-full p-0.5 border-2 border-black/40">
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </div>
        </Link>

        <RailButton
          testId={`button-like-${product.id}`}
          label={likeCount > 0 ? likeCount.toLocaleString() : ""}
          onClick={toggleLike}
        >
          <Heart
            className={`w-8 h-8 drop-shadow-md transition-all ${
              isLiked ? "fill-red-500 text-red-500 scale-110" : "fill-white text-white"
            }`}
            strokeWidth={0}
          />
        </RailButton>

        <CommentSection
          productId={product.id}
          trigger={(count) => (
            <RailButton testId={`button-comment-${product.id}`} label={count > 0 ? count : ""}>
              <MessageCircle className="w-8 h-8 fill-white text-white drop-shadow-md" strokeWidth={0} />
            </RailButton>
          )}
        />

        <RailButton
          testId={`button-favorite-${product.id}`}
          onClick={() => toggleFavorite(product.id)}
        >
          <Bookmark
            className={`w-8 h-8 drop-shadow-md transition-all ${
              isProductFavorite ? "fill-yellow-400 text-yellow-400" : "fill-white text-white"
            }`}
            strokeWidth={0}
          />
        </RailButton>

        <RailButton testId={`button-share-${product.id}`} onClick={handleShare}>
          <Share2 className="w-7 h-7 text-white drop-shadow-md" />
        </RailButton>
      </div>

      {/* Bottom info + CTA */}
      <div className="relative z-10 p-4 pb-20 pr-20 space-y-2">
        <Link href={`/trader/${product.traderId}`}>
          <span className="text-white font-bold text-[15px] drop-shadow-md cursor-pointer hover:underline">
            @{product.traderName}
          </span>
        </Link>

        <div className="flex items-baseline gap-3 flex-wrap">
          <h2
            data-testid={`text-product-name-${product.id}`}
            className="text-xl md:text-2xl font-bold text-white tracking-tight drop-shadow-lg"
          >
            {product.name}
          </h2>
          <p
            data-testid={`text-product-price-${product.id}`}
            className="text-2xl md:text-3xl font-extrabold text-emerald-400 drop-shadow-lg"
          >
            {formatPrice(product.price)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm text-[11px]">
            {product.category}
          </Badge>
          <StockIndicator quantity={product.stockQuantity} />
        </div>

        <p
          data-testid={`text-product-description-${product.id}`}
          onClick={() => setIsDescExpanded(!isDescExpanded)}
          className={`text-sm text-white/85 leading-relaxed cursor-pointer drop-shadow-md ${
            isDescExpanded ? "" : "line-clamp-1"
          }`}
        >
          {product.description}
        </p>

        <div className="pt-2 pr-0 -mr-16">
          <ActionButtons
            isSoldOut={isSoldOut}
            onBuyClick={handleBuyClick}
            onChatClick={() => setIsChatOpen(true)}
          />
        </div>
      </div>

      {/* Chat Modal */}
      <ProductChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        traderId={product.traderId}
        traderName={product.traderName}
        productName={product.name}
      />
    </motion.div>
  );
});
