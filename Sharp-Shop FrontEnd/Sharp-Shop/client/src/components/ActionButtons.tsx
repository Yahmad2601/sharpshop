import { Button } from "@/components/ui/button";
import { ShoppingBag, Share2, MessageCircle } from "lucide-react";
import { shareLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface ActionButtonsProps {
  productName: string;
  productUrl?: string;
  whatsappNumber?: string | null;
  isSoldOut: boolean;
  onBuyClick: () => void;
  onChatClick?: () => void;
  userRole?: string | null;
}

export function ActionButtons({
  productName,
  productUrl,
  isSoldOut,
  onBuyClick,
  onChatClick,
}: ActionButtonsProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const result = await shareLink(productUrl || window.location.href, {
      title: productName,
      text: `Check out ${productName} on SharpShop!`,
    });
    if (result === "copied") {
      toast({ title: "Link copied!", description: "Product link copied to clipboard." });
    } else if (result === "failed") {
      toast({ title: "Couldn't share", description: "Please copy the link from your address bar.", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-3 w-full">
      <Button
        data-testid="button-buy-now"
        onClick={onBuyClick}
        disabled={isSoldOut}
        className="flex-1 h-12 text-base font-semibold bg-white/20 backdrop-blur-md border border-white/30 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        variant="ghost"
      >
        <ShoppingBag className="w-5 h-5" />
        {isSoldOut ? "Sold Out" : "Buy Now"}
      </Button>

      {/* Chat with AI Assistant */}
      {onChatClick && (
        <Button
          data-testid="button-chat"
          onClick={onChatClick}
          size="icon"
          variant="ghost"
          className="h-12 w-12 bg-black/90 hover:bg-neutral-900 backdrop-blur-md border border-white/20 text-white"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      )}

      <Button
        data-testid="button-share"
        onClick={handleShare}
        size="icon"
        variant="ghost"
        className="h-12 w-12 bg-white/10 backdrop-blur-md border border-white/20 text-white"
      >
        <Share2 className="w-5 h-5" />
      </Button>
    </div>
  );
}
