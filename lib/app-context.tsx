"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { mapUserRow } from "./supabase-mappers";
import { supabase } from "./supabaseClient";
import type { AuthState, User } from "./types";

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
      setState({ currentUser: null, isAuthenticated: false, isHydrating: false });
      return null;
    }

    try {
      // Add timeout to prevent infinite loading (2 seconds max)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 2000)
      );

      const fetchPromise = supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .eq("active", true)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error || !data) {
        setCurrentUser(null);
        return null;
      }

      const mappedUser = mapUserRow(data);
      setCurrentUser(mappedUser);
      return mappedUser;
    } catch (err) {
      // If any error occurs (including timeout), reset hydration state
      setState({ currentUser: null, isAuthenticated: false, isHydrating: false });
      return null;
    }
  }, [setCurrentUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .eq("active", true)
        .single();

      if (error || !data) {
        return false;
      }

      setCurrentUser(mapUserRow(data));
      return true;
    },
    [setCurrentUser]
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
          setState({ currentUser: null, isAuthenticated: false, isHydrating: false });
        }
        return;
      }

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000)
        );

        const fetchPromise = supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .eq("active", true)
          .single();

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (isMounted) {
          if (error || !data) {
            setState({ currentUser: null, isAuthenticated: false, isHydrating: false });
          } else {
            const mappedUser = mapUserRow(data);
            setState({
              currentUser: mappedUser,
              isAuthenticated: true,
              isHydrating: false,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setState({ currentUser: null, isAuthenticated: false, isHydrating: false });
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
