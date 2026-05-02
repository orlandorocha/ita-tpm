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

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("active", true)
      .single();

    if (error || !data) {
      setCurrentUser(null);
      return null;
    }

    const mappedUser = mapUserRow(data);
    setCurrentUser(mappedUser);
    return mappedUser;
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
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

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
