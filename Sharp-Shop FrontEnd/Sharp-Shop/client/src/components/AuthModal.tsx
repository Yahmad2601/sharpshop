import { useState } from "react";
import { Mail, Lock, User, Store, Phone, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { useToast } from "../hooks/use-toast";
import { WhatsAppConnect } from "./WhatsAppConnect";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
}

export function AuthModal({ isOpen, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [isLoading, setIsLoading] = useState(false);
  const [showWhatsAppConnect, setShowWhatsAppConnect] = useState(false);
  const [registeredBusinessName, setRegisteredBusinessName] = useState("");
  const { login, register } = useAuth();
  const { toast } = useToast();

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    businessName: "",
    whatsappNumber: "",
    phone: "",
    address: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginData.username, loginData.password);
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Normalize a Nigerian number to international format (+234…)
      const normalizeNgPhone = (raw: string) => {
        let n = raw.replace(/[\s-]/g, "");
        if (!n) return n;
        if (n.startsWith("0")) n = "+234" + n.slice(1);
        if (!n.startsWith("+")) n = "+" + n;
        return n;
      };

      const normalizedWhatsApp =
        role === "seller" && signupData.whatsappNumber
          ? normalizeNgPhone(signupData.whatsappNumber)
          : signupData.whatsappNumber;

      const normalizedBuyerPhone =
        role === "buyer" && signupData.phone
          ? normalizeNgPhone(signupData.phone)
          : undefined;

      await register({
        username: role === "seller" ? signupData.businessName : signupData.username,
        email: signupData.email || undefined,
        password: signupData.password,
        role,
        fullName: signupData.fullName || undefined,
        businessName: role === "seller" ? signupData.businessName : undefined,
        whatsappNumber: role === "seller" ? normalizedWhatsApp : undefined,
        phone: role === "buyer" ? normalizedBuyerPhone : undefined,
        address: role === "buyer" ? signupData.address || undefined : signupData.address,
      });
      
      // For sellers, show WhatsApp connect modal
      if (role === "seller") {
        setRegisteredBusinessName(signupData.businessName);
        setShowWhatsAppConnect(true);
      } else {
        toast({
          title: "Account created!",
          description: "Welcome to SharpShop!",
        });
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-md w-[calc(100vw-2rem)] p-0 bg-transparent border-none shadow-none overflow-visible"
        >
            <div className="relative w-full">
              {/* Decorative background blobs */}
              <div aria-hidden="true" className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
              <div aria-hidden="true" className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl animate-pulse delay-1000" />

              <div className="relative bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-8 pb-0">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        {mode === "login" ? "Welcome Back" : "Join SharpShop"}
                      </DialogTitle>
                      <p className="text-white/60 mt-2">
                        {mode === "login" ? "Enter your details to continue" : "Create an account to get started"}
                      </p>
                    </div>
                  </div>

                  {/* Mode Switcher */}
                  <div className="flex p-1 bg-black/20 rounded-xl mb-8">
                    <button
                      onClick={() => setMode("login")}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        mode === "login"
                          ? "bg-white/10 text-white shadow-lg"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setMode("signup")}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        mode === "signup"
                          ? "bg-white/10 text-white shadow-lg"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="px-8 pb-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {mode === "login" ? (
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-username" className="text-white/80">Username or Email</Label>
                        <div className="relative group">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                          <Input
                            id="login-username"
                            type="text"
                            autoComplete="username"
                            placeholder="Enter username or email"
                            className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                            value={loginData.username}
                            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-white/80">Password</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                          <Input
                            id="login-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-12 text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10" 
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleSignup} className="space-y-5">
                      {/* Role Selection */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRole("buyer")}
                          aria-pressed={role === "buyer"}
                          className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                            role === "buyer"
                              ? "bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/10"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <div className={`font-bold text-lg ${role === "buyer" ? "text-blue-400" : "text-white/80"}`}>Buy</div>
                          <div className="text-xs text-white/40 mt-1">Browse & shop</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("seller")}
                          aria-pressed={role === "seller"}
                          className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                            role === "seller"
                              ? "bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <div className={`font-bold text-lg ${role === "seller" ? "text-purple-400" : "text-white/80"}`}>Sell</div>
                          <div className="text-xs text-white/40 mt-1">List products</div>
                        </button>
                      </div>

                      <div className="space-y-4">
                        {role === "buyer" ? (
                          <div className="space-y-2">
                            <Label htmlFor="signup-username" className="text-white/80">Username *</Label>
                            <div className="relative group">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                              <Input
                                id="signup-username"
                                type="text"
                                autoComplete="username"
                                placeholder="Choose a username"
                                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                                value={signupData.username}
                                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="signup-business" className="text-white/80">Business Name *</Label>
                            <div className="relative group">
                              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                              <Input
                                id="signup-business"
                                type="text"
                                autoComplete="organization"
                                placeholder="Your business/shop name"
                                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                                value={signupData.businessName}
                                onChange={(e) => setSignupData({ ...signupData, businessName: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="signup-email" className="text-white/80">Email</Label>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                            <Input
                              id="signup-email"
                              type="email"
                              autoComplete="email"
                              placeholder="your@email.com"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                              value={signupData.email}
                              onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                            />
                          </div>
                        </div>

                        {role === "buyer" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="signup-fullname" className="text-white/80">Full Name</Label>
                              <Input
                                id="signup-fullname"
                                type="text"
                                autoComplete="name"
                                placeholder="Your full name"
                                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                                value={signupData.fullName}
                                onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signup-phone" className="text-white/80">Phone Number</Label>
                              <div className="relative group">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                                <Input
                                  id="signup-phone"
                                  type="tel"
                                  autoComplete="tel"
                                  placeholder="e.g., 08012345678"
                                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                                  value={signupData.phone}
                                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                                />
                              </div>
                              <p className="text-xs text-white/40">Used to reach you about orders and to speed up checkout.</p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signup-delivery" className="text-white/80">Delivery Address</Label>
                              <div className="relative group">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                                <Input
                                  id="signup-delivery"
                                  type="text"
                                  autoComplete="shipping street-address"
                                  placeholder="Where should orders be delivered?"
                                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                                  value={signupData.address}
                                  onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {role === "seller" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="signup-whatsapp" className="text-white/80">WhatsApp Number</Label>
                              <div className="relative group">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                                <Input
                                  id="signup-whatsapp"
                                  type="tel"
                                  autoComplete="tel"
                                  placeholder="e.g., 2348123456789"
                                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-purple-500/50 focus:ring-purple-500/20 rounded-xl transition-all"
                                  value={signupData.whatsappNumber}
                                  onChange={(e) => setSignupData({ ...signupData, whatsappNumber: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="signup-address" className="text-white/80">Business Address</Label>
                              <div className="relative group">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                                <Input
                                  id="signup-address"
                                  type="text"
                                  autoComplete="street-address"
                                  placeholder="Your business location"
                                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-purple-500/50 focus:ring-purple-500/20 rounded-xl transition-all"
                                  value={signupData.address}
                                  onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="signup-password" className="text-white/80">Password *</Label>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                            <Input
                              id="signup-password"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Create a password"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                              value={signupData.password}
                              onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm" className="text-white/80">Confirm Password *</Label>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                            <Input
                              id="signup-confirm"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Confirm your password"
                              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:bg-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                              value={signupData.confirmPassword}
                              onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-12 text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10" 
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Connect Modal for Sellers */}
      <WhatsAppConnect
        isOpen={showWhatsAppConnect}
        onClose={() => {
          setShowWhatsAppConnect(false);
          onClose();
        }}
        businessName={registeredBusinessName}
      />
    </>
  );
}
