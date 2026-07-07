import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle } from "lucide-react";

interface ActionButtonsProps {
  isSoldOut: boolean;
  /** CTA label when purchasable (default "Buy Now"; drops use "Pre-order") */
  buyLabel?: string;
  /** Label when disabled (default "Sold Out"; drops use "Drop Closed") */
  soldOutLabel?: string;
  onBuyClick: () => void;
  onChatClick?: () => void;
}

export function ActionButtons({
  isSoldOut,
  buyLabel = "Buy Now",
  soldOutLabel = "Sold Out",
  onBuyClick,
  onChatClick,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <Button
        data-testid="button-buy-now"
        onClick={onBuyClick}
        disabled={isSoldOut}
        className="flex-1 h-11 text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-2 rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        <ShoppingBag className="w-5 h-5" />
        {isSoldOut ? soldOutLabel : buyLabel}
      </Button>

      {/* Ask the shop's AI assistant about this product */}
      {onChatClick && (
        <Button
          data-testid="button-chat"
          onClick={onChatClick}
          size="icon"
          variant="ghost"
          className="h-11 w-11 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white rounded-xl shrink-0"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
