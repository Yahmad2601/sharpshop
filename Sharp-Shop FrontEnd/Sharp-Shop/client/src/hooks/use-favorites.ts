import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId } from "@/lib/guest";

// Migrate old localStorage favorites to database
const migrateLocalStorageFavorites = async (userId: string) => {
  const FAVORITES_KEY = "sharpshop_favorites";
  const MIGRATION_KEY = "sharpshop_favorites_migrated";
  
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) return;
  
  const stored = localStorage.getItem(FAVORITES_KEY);
  if (!stored) {
    localStorage.setItem(MIGRATION_KEY, "true");
    return;
  }
  
  try {
    const oldFavorites = JSON.parse(stored) as string[];
    
    // Add each favorite to the database
    for (const productId of oldFavorites) {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, userId }),
      });
    }
    
    // Mark as migrated
    localStorage.setItem(MIGRATION_KEY, "true");
    localStorage.removeItem(FAVORITES_KEY);
  } catch (error) {
    console.error('Failed to migrate favorites:', error);
  }
};

export function useFavorites() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : getGuestId();
  const migrated = useRef(false);

  // Migrate old favorites once
  useEffect(() => {
    if (!migrated.current) {
      migrateLocalStorageFavorites(userId);
      migrated.current = true;
    }
  }, [userId]);

  // Fetch favorites from API
  const { data: favoritesData = [] } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: async () => {
      const res = await fetch(`/api/favorites/${userId}`);
      if (!res.ok) return [];
      return res.json() as Promise<{ id: string; productId: string; userId: string; createdAt: string }[]>;
    },
  });

  const favorites = favoritesData.map(f => f.productId);

  // Add favorite mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, userId }),
      });
      if (!res.ok) throw new Error('Failed to add favorite');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, userId }),
      });
      if (!res.ok) throw new Error('Failed to remove favorite');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });

  const toggleFavorite = (productId: string) => {
    if (favorites.includes(productId)) {
      removeFavoriteMutation.mutate(productId);
    } else {
      addFavoriteMutation.mutate(productId);
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const clearFavorites = async () => {
    // Delete all favorites for this user
    for (const productId of favorites) {
      await removeFavoriteMutation.mutateAsync(productId);
    }
  };

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    count: favorites.length,
  };
}
