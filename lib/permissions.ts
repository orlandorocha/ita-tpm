import type { UserRole } from "./types";

// ─── Permission Types ─────────────────────────────────────────────────────────

export type Permission =
  // OS Permissions
  | "os:create"
  | "os:edit"
  | "os:delete"
  | "os:view"
  | "os:view_own" // Manutentor/Operador só vê OS atribuídas
  | "os:approve_finish"
  | "os:start"
  | "os:pause"
  | "os:finish"
  // Time Control
  | "time:log"
  | "time:view_all"
  | "time:view_own"
  // Workers
  | "workers:create"
  | "workers:edit"
  | "workers:delete"
  | "workers:view"
  // Equipment
  | "equipment:create"
  | "equipment:edit"
  | "equipment:delete"
  | "equipment:view"
  // Reports
  | "reports:view"
  | "reports:costs"
  // Users
  | "users:create"
  | "users:edit"
  | "users:delete"
  | "users:view"
  // Settings
  | "settings:view"
  | "settings:edit";

// ─── Permission Matrix ────────────────────────────────────────────────────────

const permissionMatrix: Record<UserRole, Permission[]> = {
  Administrador: [
    // OS - controle total
    "os:create",
    "os:edit",
    "os:delete",
    "os:view",
    "os:approve_finish",
    "os:start",
    "os:pause",
    "os:finish",
    // Time
    "time:log",
    "time:view_all",
    // Workers
    "workers:create",
    "workers:edit",
    "workers:delete",
    "workers:view",
    // Equipment
    "equipment:create",
    "equipment:edit",
    "equipment:delete",
    "equipment:view",
    // Reports
    "reports:view",
    "reports:costs",
    // Users
    "users:create",
    "users:edit",
    "users:delete",
    "users:view",
    // Settings
    "settings:view",
    "settings:edit",
  ],
  Supervisor: [
    // OS - criar e editar, aprovar finalizações
    "os:create",
    "os:edit",
    "os:view",
    "os:approve_finish",
    "os:start",
    "os:pause",
    "os:finish",
    // Time
    "time:log",
    "time:view_all",
    // Workers - visualizar apenas
    "workers:view",
    // Equipment - visualizar apenas
    "equipment:view",
    // Reports - acesso total
    "reports:view",
    "reports:costs",
    // Settings - visualizar
    "settings:view",
  ],
  Manutentor: [
    // OS - visualizar atribuídas, apontar tempo, iniciar/pausar/finalizar
    "os:view_own",
    "os:start",
    "os:pause",
    "os:finish",
    // Time - apontar próprio tempo
    "time:log",
    "time:view_own",
    // Workers - não tem acesso
    // Equipment - não tem acesso
    // Reports - não tem acesso
    // Settings - visualizar próprio perfil
    "settings:view",
  ],
  Operador: [
    // Mesmo perfil funcional do Manutentor
    "os:view_own",
    "os:start",
    "os:pause",
    "os:finish",
    "time:log",
    "time:view_own",
    "settings:view",
  ],
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return permissionMatrix[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every((p) => hasPermission(role, p));
}

export function getPermissions(role: UserRole): Permission[] {
  return permissionMatrix[role] ?? [];
}

// ─── Page Access ──────────────────────────────────────────────────────────────

export const pagePermissions: Record<string, Permission[]> = {
  "/": [], // Manutenção ITA - todos podem acessar
  "/ordens": ["os:view", "os:view_own"],
  "/tempo": ["time:log"],
  "/manutentores": ["workers:view"],
  "/escalas": ["workers:view"],
  "/equipamentos": ["equipment:view"],
  "/relatorios": ["reports:view"],
  "/usuarios": ["users:view"],
  "/configuracoes": ["settings:view"],
};

export function canAccessPage(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;
  const requiredPermissions = pagePermissions[path];
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return hasAnyPermission(role, requiredPermissions);
}
