import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { CHAT_API_BASE } from "@/lib/api";

type VerifyState = "verifying" | "paid" | "pending" | "error";

export default function PayCallback() {
  const [state, setState] = useState<VerifyState>("verifying");
  const orderId = new URLSearchParams(window.location.search).get("order_id");

  const verify = useCallback(async () => {
    if (!orderId) {
      setState("error");
      return;
    }
    setState("verifying");
    try {
      const res = await fetch(
        `${CHAT_API_BASE}/api/payment/verify?order_id=${encodeURIComponent(orderId)}`
      );
      if (!res.ok) throw new Error(`Verify failed: ${res.status}`);
      const data = await res.json();
      if (data.status === "paid") setState("paid");
      else if (data.status === "pending") setState("pending");
      else setState("error");
    } catch (err) {
      console.error("Payment verification failed:", err);
      setState("error");
    }
  }, [orderId]);

  useEffect(() => {
    verify();
  }, [verify]);

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
      <div className="absolute inset-0 hidden md:block backdrop-blur-sm bg-black/60" />

      <div className="relative w-full h-full md:max-w-[430px] md:h-[90vh] md:max-h-[900px] md:rounded-2xl md:overflow-hidden md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 bg-black flex flex-col items-center justify-center p-6 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-500 mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Confirming your payment…</h2>
            <p className="text-white/70">This usually takes a few seconds.</p>
          </>
        )}

        {state === "paid" && (
          <>
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Payment confirmed! 🎉</h2>
            <p className="text-white/70 mb-6">
              Your order has been placed and the seller has been notified.
              {orderId && (
                <span className="block mt-2 text-white/50 text-xs">Order ID: {orderId}</span>
              )}
            </p>
            <Link href="/">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Continue Shopping
              </Button>
            </Link>
          </>
        )}

        {state === "pending" && (
          <>
            <Clock className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Payment not confirmed yet</h2>
            <p className="text-white/70 mb-6">
              We haven't seen your payment land yet. Bank transfers can take a
              minute — try checking again shortly.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={verify}
                variant="outline"
                className="gap-2 bg-white/10 border-white/20 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Check Again
              </Button>
              <Link href="/">
                <Button variant="ghost" className="text-white/70">
                  Back to Shop
                </Button>
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              {orderId ? "Couldn't verify your payment" : "Missing order reference"}
            </h2>
            <p className="text-white/70 mb-6">
              {orderId
                ? "Something went wrong while confirming your payment. If you were charged, don't worry — your payment is safe. Try again or contact the seller."
                : "This page needs an order reference to verify a payment."}
            </p>
            <div className="flex gap-3">
              {orderId && (
                <Button
                  onClick={verify}
                  variant="outline"
                  className="gap-2 bg-white/10 border-white/20 text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              )}
              <Link href="/">
                <Button variant="ghost" className="text-white/70">
                  Back to Shop
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
