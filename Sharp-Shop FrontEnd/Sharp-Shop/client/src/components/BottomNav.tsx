import { useState } from "react";
import { Home, Heart, Plus, User, LayoutDashboard, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { promptLogin } from "@/lib/auth-prompt";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NavButton({
  active,
  label,
  children,
  onClick,
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
        active ? "text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {children}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

/**
 * TikTok-style bottom navigation. Lives inside the phone frame (absolute, not
 * fixed) so it works in the desktop frame too.
 */
export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { count: favoritesCount } = useFavorites();
  const { toast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleUpload = () => {
    if (user?.role === "seller") {
      window.open(
        "https://wa.me/14155238886?text=Hi,%20I%20want%20to%20add%20a%20product",
        "_blank"
      );
    } else if (!user) {
      promptLogin();
    } else {
      toast({
        title: "Sellers only",
        description: "Sign up as a seller to list products on SharpShop.",
      });
    }
  };

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 h-14 bg-black/85 backdrop-blur-md border-t border-white/10 flex items-stretch">
      <NavButton active={location === "/"} label="Home" onClick={() => setLocation("/")}>
        <Home className="w-5 h-5" />
      </NavButton>

      <NavButton
        active={location === "/favorites"}
        label="Saved"
        onClick={() => setLocation("/favorites")}
      >
        <div className="relative">
          <Heart className="w-5 h-5" />
          {favoritesCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center">
              {favoritesCount}
            </span>
          )}
        </div>
      </NavButton>

      {/* Center + button — TikTok's create button, here: list a product */}
      <button
        onClick={handleUpload}
        aria-label="Add product"
        className="flex items-center justify-center flex-1"
      >
        <div className="w-11 h-7 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5 text-white" strokeWidth={3} />
        </div>
      </button>

      {user?.role === "seller" ? (
        <NavButton
          active={location === "/seller/dashboard"}
          label="Shop"
          onClick={() => setLocation("/seller/dashboard")}
        >
          <LayoutDashboard className="w-5 h-5" />
        </NavButton>
      ) : (
        <div className="flex-1" />
      )}

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account"
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-white/50 hover:text-white/80"
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">Me</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 mb-2">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user.username}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.role === "seller" && (
              <Link href="/seller/dashboard">
                <DropdownMenuItem className="cursor-pointer">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
              </Link>
            )}
            <DropdownMenuItem
              onClick={() => setShowLogoutConfirm(true)}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <NavButton label="Sign in" onClick={promptLogin}>
          <User className="w-5 h-5" />
        </NavButton>
      )}

      <LogoutConfirmDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm} />
    </nav>
  );
}
