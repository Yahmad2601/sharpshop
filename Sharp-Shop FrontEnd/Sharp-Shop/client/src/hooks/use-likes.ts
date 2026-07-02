import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId } from "@/lib/guest";

/**
 * Likes for one product, backed by two app-wide caches:
 *   ["likes", "counts"]        — one request for every product's count
 *   ["likes", "mine", userId]  — one request for the viewer's liked ids
 *
 * Realtime invalidation happens centrally in use-realtime-sync; toggles are
 * optimistic so the heart responds instantly.
 */
export function useLikes(productId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : getGuestId();

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["likes", "counts"],
    queryFn: async () => {
      const res = await fetch("/api/likes/counts");
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: likedIds = [] } = useQuery<string[]>({
    queryKey: ["likes", "mine", userId],
    queryFn: async () => {
      const res = await fetch(`/api/likes/user/${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const likeCount = counts[productId] ?? 0;
  const isLiked = likedIds.includes(productId);

  const toggleLikeMutation = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      const res = await fetch("/api/likes", {
        method: currentlyLiked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, userId }),
      });
      // 404 on unlike means it was already gone — treat as success
      if (!res.ok && res.status !== 404) {
        throw new Error("Failed to toggle like");
      }
    },
    onMutate: async (currentlyLiked) => {
      await queryClient.cancelQueries({ queryKey: ["likes"] });
      const prevCounts = queryClient.getQueryData<Record<string, number>>(["likes", "counts"]);
      const prevMine = queryClient.getQueryData<string[]>(["likes", "mine", userId]);

      queryClient.setQueryData<Record<string, number>>(["likes", "counts"], (old = {}) => ({
        ...old,
        [productId]: Math.max(0, (old[productId] ?? 0) + (currentlyLiked ? -1 : 1)),
      }));
      queryClient.setQueryData<string[]>(["likes", "mine", userId], (old = []) =>
        currentlyLiked ? old.filter((id) => id !== productId) : [...old, productId]
      );

      return { prevCounts, prevMine };
    },
    onError: (_err, _liked, context) => {
      if (context?.prevCounts) queryClient.setQueryData(["likes", "counts"], context.prevCounts);
      if (context?.prevMine) queryClient.setQueryData(["likes", "mine", userId], context.prevMine);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["likes"] });
    },
  });

  const toggleLike = () => {
    if (!toggleLikeMutation.isPending) toggleLikeMutation.mutate(isLiked);
  };

  return {
    likeCount,
    isLiked,
    toggleLike,
  };
}
