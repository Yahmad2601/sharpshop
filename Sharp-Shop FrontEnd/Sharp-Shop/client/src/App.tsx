import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthPromptHost } from "@/components/AuthPromptHost";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Favorites from "@/pages/favorites";
import TraderProfile from "@/pages/trader";
import SellerDashboard from "@/pages/seller-dashboard";
import PayCallback from "@/pages/pay-callback";
import ProductPage from "@/pages/product";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/trader/:traderId" component={TraderProfile} />
      <Route path="/product/:productId" component={ProductPage} />
      <Route path="/seller/dashboard" component={SellerDashboard} />
      <Route path="/pay/callback" component={PayCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Needs to live inside QueryClientProvider to reach the query cache
function RealtimeSync() {
  useRealtimeSync();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RealtimeSync />
          <Toaster />
          <AuthPromptHost />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
