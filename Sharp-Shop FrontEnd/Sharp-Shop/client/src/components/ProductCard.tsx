import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Heart, MessageCircle, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { type Product } from "@shared/schema";
import { StockIndicator } from "./StockIndicator";
import { ActionButtons } from "./ActionButtons";
import { useToast } from "@/hooks/use-toast";
import { CHAT_API_BASE } from "@/lib/api";
import { useFavorites } from "@/hooks/use-favorites";
import { useLikes } from "@/hooks/use-likes";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentSection } from "./CommentSection";
import { SiWhatsapp } from "react-icons/si";
import { ProductChatModal } from "./ProductChatModal";

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

export function ProductCard({ product }: ProductCardProps) {
  const [, setLocation] = useLocation();
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
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
    const API_BASE = CHAT_API_BASE;

    try {
      // Show loading toast
      toast({
        title: "Processing...",
        description: "Setting up payment",
      });

      // Create order and get checkout config
      const response = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trader_id: product.traderId,
          product_id: product.id,
          customer_email: user?.email || "customer@sharpshop.app",
          customer_name: user?.fullName || user?.username || "SharpShop Customer",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      const data = await response.json();
      
      // Open Flutterwave inline modal
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
          callback: async function(response: { status: string; transaction_id: string }) {
            if (response.status !== "successful") return;
            // Confirm with the backend (it verifies amount/currency with
            // Flutterwave) rather than trusting the client-side status.
            try {
              const verifyRes = await fetch(
                `${API_BASE}/api/payment/verify?order_id=${encodeURIComponent(data.order_id)}`
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
          onclose: function() {
            console.log("Payment modal closed");
          },
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

  const handleLikeToggle = () => {
    toggleLike();
    // Sync like status with favorites
    if (!isLiked) {
      // If liking, add to favorites
      if (!isProductFavorite) {
        toggleFavorite(product.id);
      }
    } else {
      // If unliking, remove from favorites
      if (isProductFavorite) {
        toggleFavorite(product.id);
      }
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

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

      <div className="absolute bottom-56 right-4 z-20 flex flex-col gap-6 items-center">
        {/* WhatsApp Upload Button for Sellers */}
        {user?.role === "seller" && (
          <div className="flex flex-col items-center gap-1">
            <Button
              data-testid="button-whatsapp-upload"
              variant="ghost"
              onClick={() => window.open("https://wa.me/14155238886?text=Hi,%20I%20want%20to%20add%20a%20product", "_blank")}
              className="h-auto w-auto hover:bg-transparent p-0 [&_svg]:size-auto relative group"
            >
              <div className="relative flex items-center justify-center w-[45px] h-[45px] rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg group-hover:scale-110 transition-transform duration-200 border-2 border-white/20">
                <SiWhatsapp className="!w-[24px] !h-[24px] text-white drop-shadow-md" />
                <div className="absolute -top-1 -right-1 bg-white text-emerald-600 rounded-full p-0.5 shadow-sm">
                  <Plus className="w-3 h-3" strokeWidth={3} />
                </div>
              </div>
            </Button>
            <span className="text-white text-xs drop-shadow-md font-medium">Upload</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1">
          <Button
            data-testid={`button-like-${product.id}`}
            variant="ghost"
            onClick={handleLikeToggle}
            className="h-auto w-auto hover:bg-transparent p-0 [&_svg]:size-auto"
          >
            <Heart
              className={`!w-[35px] !h-[35px] transition-all ${
                isLiked ? "fill-red-500 text-red-500 scale-110" : "fill-white text-white"
              }`}
              strokeWidth={0}
            />
          </Button>
          <span className="text-white text-xs drop-shadow-md font-semibold">
            {likeCount > 0 ? likeCount.toLocaleString() : ''}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <CommentSection 
            productId={product.id}
            trigger={(count) => (
              <div className="flex flex-col items-center gap-1 cursor-pointer">
                <Button
                  data-testid={`button-comment-${product.id}`}
                  variant="ghost"
                  className="h-auto w-auto hover:bg-transparent p-0 [&_svg]:size-auto"
                >
                  <MessageCircle className="!w-[35px] !h-[35px] fill-white text-white" strokeWidth={0} />
                </Button>
                <span className="text-white text-xs drop-shadow-md">{count}</span>
              </div>
            )}
          />
        </div>
      </div>

      <div className="relative z-10 p-6 pb-20 md:pb-8 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          
          <Link href={`/trader/${product.traderId}`}>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar className="h-7 w-7 border border-white/20">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${product.traderName}`} />
                <AvatarFallback className="bg-primary text-white text-[10px]">{product.traderName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-white font-semibold text-sm drop-shadow-md">
                {product.traderName}
              </span>
            </div>
          </Link>
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            {product.category}
          </Badge>
        </div>

        <div className="flex flex-col gap-0">
          <h2
            data-testid={`text-product-name-${product.id}`}
            className="text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-lg"
          >
            {product.name}
          </h2>

          <p
            data-testid={`text-product-price-${product.id}`}
            className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg"
          >
            {formatPrice(product.price)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <StockIndicator quantity={product.stockQuantity} />
        </div>

        <div className="space-y-1">
          <motion.div
            initial={false}
            animate={{ height: isDescExpanded ? "auto" : "1.7rem" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden relative"
            onAnimationComplete={() => {
              if (!isDescExpanded) {
                setShowFullText(false);
              }
            }}
          >
            <p
              data-testid={`text-product-description-${product.id}`}
              className={`text-sm md:text-base text-white/90 leading-relaxed cursor-pointer ${
                !showFullText ? "line-clamp-1" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isDescExpanded) {
                  setIsDescExpanded(false);
                } else {
                  setShowFullText(true);
                  setIsDescExpanded(true);
                }
              }}
            >
              {product.description}
            </p>
          </motion.div>
        </div>

        <div className="pt-2">
          <ActionButtons
            productName={product.name}
            whatsappNumber={product.whatsappNumber}
            isSoldOut={isSoldOut}
            onBuyClick={handleBuyClick}
            onChatClick={() => setIsChatOpen(true)}
            userRole={user?.role}
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
}
