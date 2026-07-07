import { useQuery } from "@tanstack/react-query";
import { type Product, type Trader } from "@shared/schema";
import NotFound from "@/pages/not-found";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import {
  ArrowLeft,
  MapPin,
  Share2,
  Star,
  UserPlus,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CustomerChat } from "@/components/CustomerChat";
import { useFollow } from "@/hooks/use-follow";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { shareLink } from "@/lib/share";
import { promptLogin } from "@/lib/auth-prompt";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function TraderProfile() {
  const [, setLocation] = useLocation();
  // Two routes reach this page: /trader/:traderId (by shop id) and /:phone
  // (vanity URL by the seller's phone number, e.g. sharpshop.app/08012345678).
  const params = useParams<{ traderId?: string; phone?: string }>();
  const phone = params.phone;
  // Only treat the catch-all segment as a phone if it actually looks like one,
  // so genuine typos (/setting, /abc) fall through to Not Found instead of a fetch.
  const phoneIsValid = !phone || /^\+?\d{7,15}$/.test(phone);
  const { toast } = useToast();
  const { user } = useAuth();

  // Resolve the shop by id or phone. traderId is only known after this resolves
  // when we arrived via the phone route.
  const {
    data: trader,
    isLoading: traderLoading,
    isError: traderError,
  } = useQuery<Trader>({
    queryKey: phone ? ["/api/traders/by-phone", phone] : ["/api/traders", params.traderId],
    enabled: !!((phone && phoneIsValid) || params.traderId),
  });

  const traderId = trader?.id ?? params.traderId;
  const { followerCount, isFollowing, toggleFollow } = useFollow(traderId);

  // Guests can view the shop but must sign in to follow
  const handleFollow = () => (user ? toggleFollow() : promptLogin());

  const handleShare = async () => {
    const result = await shareLink(window.location.href, {
      title: "SharpShop",
      text: "Check out this shop on SharpShop!",
    });
    if (result === "copied") {
      toast({ title: "Link copied!", description: "Shop link copied to clipboard." });
    } else if (result === "failed") {
      toast({ title: "Couldn't share", description: "Please copy the link from your address bar.", variant: "destructive" });
    }
  };

  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ["/api/products/trader", traderId],
    enabled: !!traderId,
  });

  const traderName = trader?.businessName || products?.[0]?.traderName || "Trader";
  const username = traderName.toLowerCase().replace(/\s+/g, '') + "_official";
  const bio = trader?.bio || "Quality products at affordable prices. 🇳🇬";
  const location = trader?.address || "Nigeria";
  const whatsapp = trader?.whatsappNumber;

  // A catch-all segment that isn't a phone number is just a bad URL.
  if (phone && !phoneIsValid) {
    return <NotFound />;
  }

  if (isLoading || traderLoading) {
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

  if (isError || traderError) {
    return (
      <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
        <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
        <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />

        <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-white/70 text-center mb-6">
            We couldn't load this trader's products. Please try again.
          </p>
          <Button
            data-testid="button-retry"
            onClick={() => refetch()}
            variant="outline"
            className="gap-2 bg-white/10 border-white/20 text-white"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, { offset }) => {
        if (offset.x > 50) {
          setLocation("/");
        }
      }}
    >
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
            <Button
              size="icon"
              variant="secondary"
              onClick={handleShare}
              className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border-none text-white hover:bg-black/60"
            >
              <Share2 className="w-5 h-5" />
            </Button>
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
                {username} • {formatCount(followerCount)} {followerCount === 1 ? "Follower" : "Followers"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            {whatsapp && (
              <Button
                onClick={() => window.open(`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`, '_blank')}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full h-10 text-base"
              >
                <Phone className="w-5 h-5 mr-2" />
                WhatsApp
              </Button>
            )}
            <Button
              onClick={handleFollow}
              className={`flex-1 font-bold rounded-full h-10 text-base transition-colors ${
                isFollowing
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              {isFollowing ? (
                <><UserCheck className="w-5 h-5 mr-2" />Following</>
              ) : (
                <><UserPlus className="w-5 h-5 mr-2" />Follow</>
              )}
            </Button>
          </div>

          {/* Info Buttons */}
          <div className="flex gap-3 mb-4 overflow-x-auto scrollbar-hide">
            <Button variant="outline" size="sm" className="rounded-full bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white h-8 text-xs">
              <MapPin className="w-3 h-3 mr-2" />
              {location}
            </Button>
          </div>

          {/* Bio */}
          <p className="text-white/90 mb-6 text-sm leading-relaxed">
            {bio}
          </p>

          {/* Tabs */}
          <Tabs defaultValue="stories" className="w-full flex-1 flex flex-col">
            <TabsList className="w-full bg-transparent border-b border-white/10 p-0 h-auto rounded-none shrink-0">
              <TabsTrigger
                value="stories"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 text-white/60 pb-3 font-bold text-sm uppercase tracking-wide"
              >
                Products
              </TabsTrigger>
              <TabsTrigger
                value="spotlight"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 text-white/60 pb-3 font-bold text-sm uppercase tracking-wide"
              >
                Spotlight
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stories" className="mt-0 flex-1">
              <div className="grid grid-cols-3 gap-0.5 pb-20">
                {products?.map((product) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    aria-label={`View ${product.name}`}
                  >
                    <div className="aspect-[3/4] relative bg-white/5 group cursor-pointer overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-[10px] font-bold truncate">{product.name}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                {/* Fill with placeholders if few products */}
                {Array.from({ length: Math.max(0, 9 - (products?.length || 0)) }).map((_, i) => (
                  <div key={`placeholder-${i}`} className="aspect-[3/4] bg-white/5" />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="spotlight" className="mt-0 flex-1">
              <div className="flex flex-col items-center justify-center py-12 text-white/50 h-full">
                <Star className="w-12 h-12 mb-4 opacity-20" />
                <p>No spotlight content yet</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Customer Assistant Chat */}
      {traderId && <CustomerChat traderId={traderId} traderName={traderName} />}
    </motion.div>
  );
}
