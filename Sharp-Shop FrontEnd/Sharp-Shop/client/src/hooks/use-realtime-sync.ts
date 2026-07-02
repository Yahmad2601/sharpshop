import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * One realtime channel for the whole app.
 *
 * Previously every ProductCard opened its own likes channel and comments
 * channel (2 subscriptions + several fetches per card), which hits Supabase's
 * per-client channel limit at ~50 products. This hook subscribes once and
 * invalidates the relevant query caches from the change payloads.
 *
 * Mount exactly once, inside the QueryClientProvider (see App.tsx).
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("app-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          // Covers ["/api/products"] and ["/api/products/trader", id]
          queryClient.invalidateQueries({
            predicate: (q) => String(q.queryKey[0]).startsWith("/api/products"),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["likes"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        (payload: { new?: { product_id?: string }; old?: { product_id?: string } }) => {
          queryClient.invalidateQueries({ queryKey: ["comments", "counts"] });
          const productId = payload.new?.product_id ?? payload.old?.product_id;
          if (productId) {
            queryClient.invalidateQueries({ queryKey: ["comments", productId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
