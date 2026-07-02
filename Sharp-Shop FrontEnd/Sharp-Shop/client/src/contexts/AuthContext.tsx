import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiClient } from "@/lib/api";
import { peekGuestId, clearGuestId } from "@/lib/guest";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  role: "buyer" | "seller";
  fullName?: string;
  businessName?: string;
  whatsappNumber?: string;
  address?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    checkAuth();
  }, []);

  // Adopt guest likes/favorites/comments into the account so nothing the
  // user did before signing in disappears. Best-effort — a failure here
  // must not block login.
  const mergeGuestData = async () => {
    const guestId = peekGuestId();
    if (!guestId) return;
    try {
      const response = await apiClient.fetch("/api/user/merge-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (response.ok) {
        clearGuestId();
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
        queryClient.invalidateQueries({ queryKey: ["likes"] });
        queryClient.invalidateQueries({ queryKey: ["comments"] });
      }
    } catch (error) {
      console.error("Guest data merge failed:", error);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await apiClient.fetch("/api/user");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await apiClient.fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const userData = await response.json();
    setUser(userData);
    await mergeGuestData();
  };

  const register = async (data: RegisterData) => {
    const response = await apiClient.fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Registration failed");
    }

    const userData = await response.json();
    setUser(userData);
    await mergeGuestData();
  };

  const logout = async () => {
    await apiClient.fetch("/api/logout", {
      method: "POST",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
