import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId } from "@/lib/guest";

/**
 * Follow state for one trader. Optimistic toggle, guest-aware (guest follows
 * are merged into the account on login via /api/user/merge-guest).
 */
export function useFollow(traderId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : getGuestId();

  const { data } = useQuery({
    queryKey: ["follows", traderId, userId],
    queryFn: async () => {
      const [countRes, statusRes] = await Promise.all([
        fetch(`/api/follows/count/${traderId}`),
        fetch(`/api/follows/check/${traderId}/${userId}`),
      ]);
      const count = await countRes.json();
      const status = await statusRes.json();
      return {
        followerCount: count.count ?? 0,
        isFollowing: status.isFollowing ?? false,
      };
    },
    enabled: !!traderId,
  });

  const followerCount = data?.followerCount ?? 0;
  const isFollowing = data?.isFollowing ?? false;

  const toggleMutation = useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      const res = await fetch("/api/follows", {
        method: currentlyFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traderId, userId }),
      });
      if (!res.ok && res.status !== 404) throw new Error("Failed to toggle follow");
    },
    onMutate: async (currentlyFollowing) => {
      await queryClient.cancelQueries({ queryKey: ["follows", traderId, userId] });
      const prev = queryClient.getQueryData(["follows", traderId, userId]);
      queryClient.setQueryData(["follows", traderId, userId], {
        followerCount: Math.max(0, followerCount + (currentlyFollowing ? -1 : 1)),
        isFollowing: !currentlyFollowing,
      });
      return { prev };
    },
    onError: (_err, _v, context) => {
      if (context?.prev) queryClient.setQueryData(["follows", traderId, userId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["follows", traderId, userId] });
    },
  });

  const toggleFollow = () => {
    if (traderId && !toggleMutation.isPending) toggleMutation.mutate(isFollowing);
  };

  return { followerCount, isFollowing, toggleFollow, isPending: toggleMutation.isPending };
}
