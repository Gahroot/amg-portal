"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getCurrentUser,
  login as loginApi,
} from "@/lib/api/auth";
import {
  getAccessToken,
  setTokens,
  removeTokens,
} from "@/lib/token-storage";
import api from "@/lib/api";
import type { User, LoginCredentials } from "@/types/user";

export class MFARequiredError extends Error {
  mfaRequired = true;
  constructor() {
    super("MFA code required");
    this.name = "MFARequiredError";
  }
}

export class MFASetupRequiredError extends Error {
  mfaSetupRequired = true;
  constructor() {
    super("MFA setup required");
    this.name = "MFASetupRequiredError";
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<
  AuthContextType | undefined
>(undefined);

const PUBLIC_PATHS = [
  "/login",
  "/mfa-setup",
  "/forgot-password",
  "/reset-password",
];

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = user !== null;

  const fetchUser = React.useCallback(async () => {
    const token = getAccessToken();
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

  // Listen for session-invalidation events dispatched by the axios
  // interceptor so that React state stays in sync without hard reloads.
  React.useEffect(() => {
    const handleLogout = () => {
      removeTokens();
      setUser(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  React.useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!isAuthenticated && !isPublicPath) {
      router.replace("/login");
    } else if (isAuthenticated && isPublicPath) {
      // Don't redirect away from /mfa-setup if the user still needs to
      // complete MFA enrollment (grace-period tokens are valid but MFA
      // is not yet enabled).
      if (pathname === "/mfa-setup" && !user?.mfa_enabled) {
        return;
      }
      if (user?.role === "client") {
        router.replace("/portal/dashboard");
      } else if (user?.role === "partner") {
        router.replace("/partner");
      } else {
        router.replace("/");
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, user]);

  const login = React.useCallback(
    async (credentials: LoginCredentials) => {
      const response = await loginApi(credentials);

      if (response.mfa_required) {
        throw new MFARequiredError();
      }

      if (response.mfa_setup_required) {
        if (response.access_token) {
          // Grace-period: real tokens issued, MFA setup encouraged but not blocking.
          setTokens(response.access_token, response.refresh_token);
          const userData = await getCurrentUser();
          setUser(userData);
          if (userData.role === "client") {
            router.replace("/portal/dashboard");
          } else if (userData.role === "partner") {
            router.replace("/partner");
          } else {
            router.replace("/");
          }
          return;
        }
        // Hard enforcement: no real tokens — surface the setup requirement.
        throw new MFASetupRequiredError();
      }

      setTokens(response.access_token, response.refresh_token);
      const userData = await getCurrentUser();
      setUser(userData);
      if (userData.role === "client") {
        router.replace("/portal/dashboard");
      } else if (userData.role === "partner") {
        router.replace("/partner");
      } else {
        router.replace("/");
      }
    },
    [router]
  );

  const logout = React.useCallback(() => {
    // Clear httpOnly cookies on the server
    api.post("/api/v1/auth/logout").catch(() => {});
    removeTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const refreshUser = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch {
      removeTokens();
      setUser(null);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, isAuthenticated, login, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }
  return context;
}
