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
  completeOperationalAuth: (equipmentId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const SESSION_STORAGE_KEY = "manutencontrol.current-user-id";
const OPERATIONAL_AUTH_KEY = "manutencontrol.operational-auth";

// Perfis que requerem autenticação operacional
const OPERATIONAL_AUTH_ROLES: UserRole[] = ["Manutentor", "Operador"];

function requiresOperationalAuth(role: UserRole | undefined): boolean {
  return role ? OPERATIONAL_AUTH_ROLES.includes(role) : false;
}

interface OperationalAuthData {
  completed: boolean;
  equipmentId?: string;
  timestamp?: string;
}

function getOperationalAuthFromStorage(): OperationalAuthData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(OPERATIONAL_AUTH_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as OperationalAuthData;
  } catch {
    return null;
  }
}

function setOperationalAuthToStorage(data: OperationalAuthData | null) {
  if (typeof window === "undefined") return;
  if (data) {
    window.localStorage.setItem(OPERATIONAL_AUTH_KEY, JSON.stringify(data));
  } else {
    window.localStorage.removeItem(OPERATIONAL_AUTH_KEY);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    currentUser: null,
    isAuthenticated: false,
    isHydrating: true,
    operationalAuthRequired: false,
    operationalAuthCompleted: false,
    scannedEquipmentId: undefined,
  });

  const setCurrentUser = useCallback((user: User | null) => {
    if (typeof window !== "undefined") {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, user.id);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        // Limpa auth operacional ao fazer logout
        setOperationalAuthToStorage(null);
      }
    }

    const needsOperationalAuth = requiresOperationalAuth(user?.role);
    const storedAuth = getOperationalAuthFromStorage();

    setState({
      currentUser: user,
      isAuthenticated: Boolean(user),
      isHydrating: false,
      operationalAuthRequired: needsOperationalAuth,
      operationalAuthCompleted: needsOperationalAuth ? (storedAuth?.completed ?? false) : true,
      scannedEquipmentId: storedAuth?.equipmentId,
    });
  }, []);

  const completeOperationalAuth = useCallback((equipmentId: string) => {
    const authData: OperationalAuthData = {
      completed: true,
      equipmentId,
      timestamp: new Date().toISOString(),
    };
    setOperationalAuthToStorage(authData);

    setState(prev => ({
      ...prev,
      operationalAuthCompleted: true,
      scannedEquipmentId: equipmentId,
    }));
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
        operationalAuthRequired: false,
        operationalAuthCompleted: false,
        scannedEquipmentId: undefined,
      });
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
      setState({
        currentUser: null,
        isAuthenticated: false,
        isHydrating: false,
        operationalAuthRequired: false,
        operationalAuthCompleted: false,
        scannedEquipmentId: undefined,
      });
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

      // Limpa auth operacional anterior ao fazer novo login
      setOperationalAuthToStorage(null);

      const mappedUser = mapUserRow(data);
      const needsOperationalAuth = requiresOperationalAuth(mappedUser.role);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_STORAGE_KEY, mappedUser.id);
      }

      setState({
        currentUser: mappedUser,
        isAuthenticated: true,
        isHydrating: false,
        operationalAuthRequired: needsOperationalAuth,
        operationalAuthCompleted: !needsOperationalAuth, // Já completo se não precisa
        scannedEquipmentId: undefined,
      });

      return true;
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
            operationalAuthRequired: false,
            operationalAuthCompleted: false,
            scannedEquipmentId: undefined,
          });
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
            setState({
              currentUser: null,
              isAuthenticated: false,
              isHydrating: false,
              operationalAuthRequired: false,
              operationalAuthCompleted: false,
              scannedEquipmentId: undefined,
            });
          } else {
            const mappedUser = mapUserRow(data);
            const needsOperationalAuth = requiresOperationalAuth(mappedUser.role);
            const storedAuth = getOperationalAuthFromStorage();

            setState({
              currentUser: mappedUser,
              isAuthenticated: true,
              isHydrating: false,
              operationalAuthRequired: needsOperationalAuth,
              operationalAuthCompleted: needsOperationalAuth ? (storedAuth?.completed ?? false) : true,
              scannedEquipmentId: storedAuth?.equipmentId,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setState({
            currentUser: null,
            isAuthenticated: false,
            isHydrating: false,
            operationalAuthRequired: false,
            operationalAuthCompleted: false,
            scannedEquipmentId: undefined,
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
    completeOperationalAuth,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
