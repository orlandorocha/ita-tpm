import type { OSStatus, OSPriority, OSType, WorkerStatus } from "./types";

function parseDateForDisplay(value: string): Date {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }

  return new Date(value);
}

function getLocalDateKey(reference: Date): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(iso: string): string {
  const d = parseDateForDisplay(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getOSStatusColor(status: OSStatus): string {
  switch (status) {
    case "Aberta":
      return "text-status-warning bg-status-warning/10 border-status-warning/30";
    case "Em andamento":
      return "text-status-info bg-status-info/10 border-status-info/30";
    case "Pausada":
      return "text-status-muted bg-status-muted/10 border-status-muted/30";
    case "Atrasada":
      return "text-status-danger bg-status-danger/10 border-status-danger/30";
    case "Finalizada":
      return "text-status-ok bg-status-ok/10 border-status-ok/30";
  }
}

export function isServiceOrderOverdue(dueDate?: string, status?: OSStatus, referenceDate = new Date()): boolean {
  if (!dueDate || status === "Finalizada") {
    return false;
  }

  return dueDate < getLocalDateKey(referenceDate);
}

export function getOSPriorityColor(priority: OSPriority): string {
  switch (priority) {
    case "Baixa":
      return "text-status-ok bg-status-ok/10 border-status-ok/30";
    case "Média":
      return "text-status-warning bg-status-warning/10 border-status-warning/30";
    case "Alta":
      return "text-status-danger bg-status-danger/10 border-status-danger/20";
    case "Crítica":
      return "text-status-critical bg-status-critical/10 border-status-critical/30 animate-pulse";
  }
}

export function getOSTypeColor(type: OSType): string {
  switch (type) {
    case "Corretiva":
      return "text-status-danger bg-status-danger/10 border-status-danger/30";
    case "Preventiva":
      return "text-status-info bg-status-info/10 border-status-info/30";
    case "Preditiva":
      return "text-status-warning bg-status-warning/10 border-status-warning/30";
    case "Opa":
      return "text-emerald-700 bg-emerald-500/10 border-emerald-500/30";
    case "Guemba":
      return "text-fuchsia-700 bg-fuchsia-500/10 border-fuchsia-500/30";
  }
}

export function getWorkerStatusColor(status: WorkerStatus): string {
  switch (status) {
    case "Disponível":
      return "text-status-ok bg-status-ok/10 border-status-ok/30";
    case "Em serviço":
      return "text-status-info bg-status-info/10 border-status-info/30";
    case "Em pausa":
      return "text-status-warning bg-status-warning/10 border-status-warning/30";
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (mins > 0) return `há ${mins}min`;
  return "agora";
}

export function elapsedHours(startIso: string, endIso?: string): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return (end - start) / 3600000;
}
