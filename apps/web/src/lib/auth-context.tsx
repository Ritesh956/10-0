import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { getAuthToken, setAuthToken } from "../api/client";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  playAsGuest: (displayName: string) => Promise<void>;
  upgradeAccount: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORED_USER_KEY = "futbol_user";

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORED_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (getAuthToken() ? loadStoredUser() : null));

  const persist = useCallback((token: string, authUser: AuthUser) => {
    setAuthToken(token);
    localStorage.setItem(STORED_USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api.register(email, password, displayName);
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  /** No email/password needed — the only thing required to start playing. */
  const playAsGuest = useCallback(
    async (displayName: string) => {
      const res = await api.guest(displayName);
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  /** Attaches email/password to the current guest session so its history is saved. */
  const upgradeAccount = useCallback(
    async (email: string, password: string) => {
      const res = await api.upgradeAccount(email, password);
      persist(res.accessToken, res.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(STORED_USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, login, register, playAsGuest, upgradeAccount, logout }),
    [user, login, register, playAsGuest, upgradeAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
