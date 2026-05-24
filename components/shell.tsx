"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { hasPermission, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Timer,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { href: "/", label: "Manutenção ITA", icon: LayoutDashboard },
  { href: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/tempo", label: "Controle de Tempo", icon: Timer, permission: "time:log" },
  { href: "/manutentores", label: "Manutentores", icon: Users, permission: "workers:view" },
  { href: "/escalas", label: "Escalas", icon: CalendarDays, permission: "workers:view" },
  { href: "/equipamentos", label: "Equipamentos", icon: Wrench, permission: "equipment:view" },
  { href: "/equipamentos/scan", label: "Leitor QR", icon: Camera, permission: "equipment:view" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports:view" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, permission: "users:view" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function getPageTitle(pathname: string) {
  const matchedItem = [...navItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find(({ href }) => (href === "/" ? pathname === "/" : pathname.startsWith(href)));

  return matchedItem?.label ?? "Manutenção ITA";
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { state, logout } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(state.currentUser?.role, item.permission);
      }),
    [state.currentUser?.role]
  );

  function handleNavigate() {
    onMobileClose();
  }

  function handleLogout() {
    onMobileClose();
    logout();
  }

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white px-2 shrink-0">
          <Image
            src="/pepsico-logo.png"
            alt="PepsiCo"
            width={72}
            height={20}
            className="h-auto"
            style={{ width: "100%", height: "auto" }}
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sidebar-foreground font-semibold text-sm leading-none tracking-wide truncate">
            Manutenção
          </p>
          <p className="text-sidebar-foreground/40 text-[10px] mt-0.5 tracking-widest uppercase">
            Industrial
          </p>
        </div>
        <button
          onClick={onMobileClose}
          className="md:hidden text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto hidden md:inline-flex text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={handleNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors group",
                    active
                      ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "md:hidden")}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {state.currentUser && (
        <div className="border-t border-sidebar-border px-3 py-3 shrink-0">
          <div className={cn("flex items-center gap-3", collapsed && "md:justify-center")}>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {state.currentUser.name.charAt(0)}
            </div>
            <div className={cn("flex-1 min-w-0", collapsed && "md:hidden")}>
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {state.currentUser.name}
              </p>
              <p className="text-sidebar-foreground/40 text-[10px] truncate">
                {state.currentUser.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className={cn(
                "text-sidebar-foreground/40 hover:text-destructive transition-colors",
                collapsed && "md:hidden"
              )}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {collapsed && (
            <button
              onClick={handleLogout}
              className="hidden md:flex w-full mt-2 items-center justify-center text-sidebar-foreground/40 hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex md:flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 h-screen sticky top-0 shrink-0",
          collapsed ? "md:w-16" : "md:w-60"
        )}
      >
        {navContent}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(85vw,20rem)] flex-col bg-sidebar border-r border-sidebar-border shadow-2xl transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}

export function TopBar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { state } = useApp();

  return (
    <header className="h-14 border-b border-border flex items-center px-4 sm:px-6 gap-4 bg-card shrink-0 sticky top-0 z-30">
      <button
        className="md:hidden text-muted-foreground hover:text-foreground"
        onClick={onMenuClick}
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-foreground font-semibold text-sm sm:text-base truncate">{title}</h1>
      {state.currentUser && (
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">
              {state.currentUser.name}
            </p>
            <p className="text-xs text-muted-foreground">{state.currentUser.role}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {state.currentUser.name.charAt(0)}
          </div>
        </div>
      )}
    </header>
  );
}