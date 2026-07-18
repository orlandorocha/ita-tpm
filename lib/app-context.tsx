"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { mapUserRow } from "./supabase-mappers";
import { supabase } from "./supabaseClient";
import type { AuthState, User, UserRole } from "./types";

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentUser: (user: User | null) => void;
  refreshCurrentUser: () => Promise<User | null>;
}

const AppContext = createContext<AppContextValue | null>(null);
const SESSION_STORAGE_KEY = "manutencontrol.current-user-id";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    currentUser: null,
    isAuthenticated: false,
    isHydrating: true,
  });

  const setCurrentUser = useCallback((user: User | null) => {
    if (typeof window !== "undefined") {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, user.id);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    setState({
      currentUser: user,
      isAuthenticated: Boolean(user),
      isHydrating: false,
    });
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const userId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SESSION_STORAGE_KEY)
        : null;

    if (!userId) {
      setState({
        currentUser: null,
        isAuthenticated: false,
        isHydrating: false,
      });
      return null;
    }

    try {
      console.log("[v0] Refreshing user:", userId);

      const response = await fetch(`/api/auth/refresh?userId=${userId}`);

      if (!response.ok) {
        console.log("[v0] User refresh failed with status:", response.status);
        setCurrentUser(null);
        return null;
      }

      const result = await response.json();
      if (!result.success || !result.user) {
        console.log("[v0] User refresh response invalid");
        setCurrentUser(null);
        return null;
      }

      console.log("[v0] User refreshed successfully:", result.user.id);

      const mappedUser = mapUserRow(result.user);
      setCurrentUser(mappedUser);
      return mappedUser;
    } catch (err) {
      console.error("[v0] User refresh error:", err);
      setState({
        currentUser: null,
        isAuthenticated: false,
        isHydrating: false,
      });
      return null;
    }
  }, [setCurrentUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        console.log("[v0] Login attempt for email:", email);

        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          console.log("[v0] Login failed with status:", response.status);
          return false;
        }

        const result = await response.json();
        if (!result.success || !result.user) {
          console.log("[v0] Login response invalid");
          return false;
        }

        console.log("[v0] Login successful for user:", result.user.id);

        const mappedUser = mapUserRow(result.user);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(SESSION_STORAGE_KEY, mappedUser.id);
        }

        setState({
          currentUser: mappedUser,
          isAuthenticated: true,
          isHydrating: false,
        });

        return true;
      } catch (err) {
        console.error("[v0] Login error:", err);
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, [setCurrentUser]);

  useEffect(() => {
    // Only run on mount to avoid infinite loops
    let isMounted = true;

    const initializeAuth = async () => {
      const userId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(SESSION_STORAGE_KEY)
          : null;

      if (!userId) {
        if (isMounted) {
          setState({
            currentUser: null,
            isAuthenticated: false,
            isHydrating: false,
          });
        }
        return;
      }

      try {
        console.log("[v0] Initializing auth for user:", userId);

        const response = await fetch(`/api/auth/refresh?userId=${userId}`);

        if (isMounted) {
          if (!response.ok) {
            console.log("[v0] Init auth fetch failed with status:", response.status);
            setState({
              currentUser: null,
              isAuthenticated: false,
              isHydrating: false,
            });
          } else {
            const result = await response.json();
            if (!result.success || !result.user) {
              console.log("[v0] Init auth response invalid");
              setState({
                currentUser: null,
                isAuthenticated: false,
                isHydrating: false,
              });
            } else {
              const mappedUser = mapUserRow(result.user);
              console.log("[v0] Init auth successful for user:", mappedUser.id);

              setState({
                currentUser: mappedUser,
                isAuthenticated: true,
                isHydrating: false,
              });
            }
          }
        }
      } catch (err) {
        console.error("[v0] Init auth error:", err);
        if (isMounted) {
          setState({
            currentUser: null,
            isAuthenticated: false,
            isHydrating: false,
          });
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const value: AppContextValue = {
    state,
    login,
    logout,
    setCurrentUser,
    refreshCurrentUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
