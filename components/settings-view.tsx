"use client";

import { useEquipments } from "@/hooks/useEquipments";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useWorkers } from "@/hooks/useWorkers";
import { useApp } from "@/lib/app-context";
import type { UserRole } from "@/lib/types";
import { CheckCircle2, Eye, LogOut, Shield, User, XCircle } from "lucide-react";

const ROLE_COLORS: Record<UserRole, string> = {
  Administrador: "text-status-critical bg-status-critical/10 border-status-critical/30",
  Supervisor: "text-status-warning bg-status-warning/10 border-status-warning/30",
  Manutentor: "text-status-ok bg-status-ok/10 border-status-ok/30",
  Operador: "text-status-info bg-status-info/10 border-status-info/30",
};

const ROLE_PERMISSIONS: Record<UserRole, { text: string; allowed: boolean }[]> = {
  Administrador: [
    { text: "Criar, editar e excluir OS", allowed: true },
    { text: "Gerenciar manutentores e equipamentos", allowed: true },
    { text: "Acessar relatórios e custos", allowed: true },
    { text: "Gerenciar usuários e perfis", allowed: true },
    { text: "Controle total do sistema", allowed: true },
  ],
  Supervisor: [
    { text: "Criar e editar OS", allowed: true },
    { text: "Visualizar manutentores e equipamentos", allowed: true },
    { text: "Acessar relatórios", allowed: true },
    { text: "Aprovar finalizações de OS", allowed: true },
    { text: "Gestão de usuários", allowed: false },
  ],
  Manutentor: [
    { text: "Visualizar OS atribuídas", allowed: true },
    { text: "Apontar tempo nas OS", allowed: true },
    { text: "Iniciar, pausar e finalizar atividades", allowed: true },
    { text: "Relatórios administrativos", allowed: false },
    { text: "Gestão de equipe", allowed: false },
  ],
  Operador: [
    { text: "Visualizar OS atribuídas", allowed: true },
    { text: "Apontar tempo nas OS", allowed: true },
    { text: "Iniciar, pausar e finalizar atividades", allowed: true },
    { text: "Relatórios administrativos", allowed: false },
    { text: "Gestão de equipe", allowed: false },
  ],
};

export function SettingsView() {
  const { state, logout } = useApp();
  const { serviceOrders } = useServiceOrders();
  const { workers } = useWorkers();
  const { equipments } = useEquipments();
  const currentUser = state.currentUser;

  if (!currentUser) return null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-foreground font-semibold text-sm">Meu Perfil</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary font-bold text-2xl">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-semibold text-lg">{currentUser.name}</p>
            <p className="text-muted-foreground text-sm">{currentUser.email}</p>
            <span className={`text-xs px-2 py-0.5 rounded border font-semibold mt-1 inline-block ${ROLE_COLORS[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-foreground font-semibold text-sm">Minhas Permissões</h3>
        </div>
        <div className="space-y-2">
          {ROLE_PERMISSIONS[currentUser.role].map((permission, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 p-2 rounded border ${
                permission.allowed ? "bg-status-ok/5 border-status-ok/20" : "bg-status-danger/5 border-status-danger/20"
              }`}
            >
              {permission.allowed ? (
                <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-status-danger shrink-0" />
              )}
              <span className={`text-sm ${permission.allowed ? "text-foreground" : "text-muted-foreground"}`}>
                {permission.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-foreground font-semibold text-sm">Matriz de Permissões</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["Administrador", "Supervisor", "Manutentor", "Operador"] as UserRole[]).map((role) => (
            <div key={role} className={`border rounded-lg p-4 ${role === currentUser.role ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded border font-semibold ${ROLE_COLORS[role]}`}>{role}</span>
                {role === currentUser.role && <span className="text-[10px] text-primary font-medium">(Você)</span>}
              </div>
              <ul className="space-y-1.5">
                {ROLE_PERMISSIONS[role].map((permission, index) => (
                  <li
                    key={index}
                    className={`flex items-start gap-2 text-xs ${permission.allowed ? "text-foreground/80" : "text-muted-foreground line-through"}`}
                  >
                    {permission.allowed ? (
                      <CheckCircle2 className="w-3 h-3 text-status-ok mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-status-danger mt-0.5 shrink-0" />
                    )}
                    {permission.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-foreground font-semibold text-sm">Informações do Sistema</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Versão", value: "1.0.0" },
            { label: "OS Cadastradas", value: serviceOrders.length },
            { label: "Manutentores", value: workers.length },
            { label: "Equipamentos", value: equipments.length },
          ].map((info) => (
            <div key={info.label} className="bg-muted/20 rounded-lg px-4 py-3">
              <p className="text-muted-foreground text-xs">{info.label}</p>
              <p className="text-foreground font-bold text-lg mt-0.5">{info.value}</p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs mt-4">
          Manutenção — Sistema de Gerenciamento de Manutenção Industrial. Dados persistidos no Supabase.
        </p>
      </div>
    </div>
  );
}