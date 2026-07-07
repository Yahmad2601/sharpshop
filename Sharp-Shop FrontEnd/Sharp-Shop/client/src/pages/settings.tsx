import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { type Trader } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { promptLogin } from "@/lib/auth-prompt";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { BuyerDetailsModal } from "@/components/BuyerDetailsModal";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  Store,
  LogOut,
  LogIn,
  ExternalLink,
  LayoutDashboard,
  MapPin,
} from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
        {title}
      </h2>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Row({
  onClick,
  children,
  destructive,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left transition-colors hover:bg-muted/50 ${
        destructive ? "text-red-500" : "text-card-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingBuyerDetails, setIsEditingBuyerDetails] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { data: trader } = useQuery<Trader>({
    queryKey: ["/api/trader/me"],
    enabled: user?.role === "seller",
  });

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-background flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />

      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-border bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 p-4 border-b border-border shrink-0">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Go back"
            onClick={() => (window.history.length > 1 ? window.history.back() : setLocation("/"))}
            className="h-9 w-9 rounded-full text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {/* Account */}
          <Section title="Account">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar className="h-10 w-10">
                    <AvatarImage alt="" src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username)}`} />
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground truncate">{user.username}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                </div>
                {user.role === "seller" && (
                  <>
                    <Row onClick={() => setIsEditingProfile(true)}>
                      <Store className="w-4 h-4 shrink-0" />
                      Edit shop profile
                    </Row>
                    <Row onClick={() => setLocation("/seller/dashboard")}>
                      <LayoutDashboard className="w-4 h-4 shrink-0" />
                      Seller dashboard
                    </Row>
                  </>
                )}
                {user.role === "buyer" && (
                  <Row onClick={() => setIsEditingBuyerDetails(true)}>
                    <MapPin className="w-4 h-4 shrink-0" />
                    Delivery details
                  </Row>
                )}
              </>
            ) : (
              <Row onClick={promptLogin}>
                <LogIn className="w-4 h-4 shrink-0" />
                Sign in or create an account
              </Row>
            )}
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <div className="p-4 space-y-3">
              <p className="text-sm text-card-foreground font-medium">Theme</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-colors ${
                      theme === value
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The product feed stays dark for the best viewing experience —
                your theme applies to settings, dashboard, and dialogs.
              </p>
            </div>
          </Section>

          {/* About */}
          <Section title="About">
            <a
              href="https://sharpshop.app"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-card-foreground hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              sharpshop.app
            </a>
            <div className="px-4 py-3.5 text-sm text-muted-foreground">
              SharpShop — TikTok-style shopping for Nigerian traders.
            </div>
          </Section>

          {user && (
            <Section title="Session">
              <Row destructive onClick={() => setShowLogoutConfirm(true)}>
                <LogOut className="w-4 h-4 shrink-0" />
                Log out
              </Row>
            </Section>
          )}
        </main>
      </div>

      {user?.role === "seller" && (
        <ProfileEditModal
          trader={trader}
          isOpen={isEditingProfile}
          onClose={() => setIsEditingProfile(false)}
        />
      )}
      {user?.role === "buyer" && (
        <BuyerDetailsModal
          isOpen={isEditingBuyerDetails}
          onClose={() => setIsEditingBuyerDetails(false)}
        />
      )}
      <LogoutConfirmDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm} />
    </div>
  );
}
