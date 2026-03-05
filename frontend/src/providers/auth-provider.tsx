"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getCurrentUser,
  login as loginApi,
  type User,
  type LoginCredentials,
} from "@/lib/api/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ["/login"];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  } catch {
    // Silent fail
  }
}

function removeTokens(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  } catch {
    // Silent fail
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = user !== null;

  const fetchUser = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch {
      removeTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  React.useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!isAuthenticated && !isPublicPath) {
      router.replace("/login");
    } else if (isAuthenticated && isPublicPath) {
      if (user?.role === "client") {
        router.replace("/portal/dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, user]);

  const login = React.useCallback(
    async (credentials: LoginCredentials) => {
      const response = await loginApi(credentials);
      setTokens(response.access_token, response.refresh_token);
      const userData = await getCurrentUser();
      setUser(userData);
      if (userData.role === "client") {
        router.replace("/portal/dashboard");
      } else {
        router.replace("/");
      }
    },
    [router]
  );

  const logout = React.useCallback(() => {
    removeTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = React.useMemo(
    () => ({ user, isLoading, isAuthenticated, login, logout }),
    [user, isLoading, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
