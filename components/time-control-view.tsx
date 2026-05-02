"use client";

import { useEffect, useMemo, useState } from "react";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useWorkSchedules } from "@/hooks/useWorkSchedules";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useWorkers } from "@/hooks/useWorkers";
import { useApp } from "@/lib/app-context";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatDateTime, formatHours, getOSStatusColor, getWorkerStatusColor, isServiceOrderOverdue } from "@/lib/format";
import { getScheduledWorkerDayStatus, resolveScheduledWorkers } from "@/lib/work-schedules";
import { resolveCurrentUserWorkerId } from "@/lib/utils";
import type { ActivityType, ServiceOrder, TimeEntry, Worker } from "@/lib/types";
import { Play, Pause, Square, Activity } from "lucide-react";

function LiveTimer({ startIso }: { startIso: string }) {
  const [elapsed, setElapsed] = useState(() => (Date.now() - new Date(startIso).getTime()) / 1000);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setElapsed((Date.now() - new Date(startIso).getTime()) / 1000);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [startIso]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = Math.floor(elapsed % 60);

  return (
    <span className="font-mono text-status-info text-sm tabular-nums">
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function WorkerTimeCard({
  worker,
  orders,
  entries,
  isDayOffToday,
  hasDayOffConflict,
  onStart,
  onPause,
  onFinish,
}: {
  worker: Worker;
  orders: ServiceOrder[];
  entries: TimeEntry[];
  isDayOffToday: boolean;
  hasDayOffConflict: boolean;
  onStart: (workerId: string, serviceOrderId: string, activityType: ActivityType) => Promise<void>;
  onPause: (entryId: string, workerId: string) => Promise<void>;
  onFinish: (entryId: string, workerId: string) => Promise<void>;
}) {
  const activeEntry = entries.find((entry) => !entry.endTime);
  const availableOrders = orders
    .filter(
      (order) => order.status === "Em andamento" || order.status === "Aberta" || order.status === "Atrasada"
    )
    .sort((left, right) => {
      const leftDueDate = left.dueDate ?? "9999-12-31";
      const rightDueDate = right.dueDate ?? "9999-12-31";
      if (leftDueDate !== rightDueDate) {
        return leftDueDate.localeCompare(rightDueDate);
      }

      return new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime();
    });

  const [selectedOS, setSelectedOS] = useState(availableOrders[0]?.id ?? "");
  const [activityType, setActivityType] = useState<ActivityType>("Execução");

  useEffect(() => {
    if (!selectedOS && availableOrders[0]) {
      setSelectedOS(availableOrders[0].id);
    }
  }, [availableOrders, selectedOS]);

  const totalHours = entries.reduce((accumulator, entry) => {
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
  }, 0);

  const productiveHours = entries.reduce((accumulator, entry) => {
    if (entry.activityType !== "Execução" && entry.activityType !== "Setup") {
      return accumulator;
    }
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
  }, 0);

  const productivity = totalHours > 0 ? (productiveHours / totalHours) * 100 : 0;
  const activeOrder = activeEntry ? orders.find((order) => order.id === activeEntry.osId) : null;
  const overdueOrders = availableOrders.filter(
    (order) => order.dueDate && isServiceOrderOverdue(order.dueDate, order.status)
  );
  const hasOverdueAlert = overdueOrders.length > 0;
  const activeOrderIsOverdue = activeOrder?.dueDate
    ? isServiceOrderOverdue(activeOrder.dueDate, activeOrder.status)
    : false;

  return (
    <div
      className={`bg-card border rounded-lg p-5 flex flex-col gap-4 ${
        hasDayOffConflict || hasOverdueAlert || activeOrderIsOverdue
          ? "border-status-danger/40 bg-status-danger/5"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
          {worker.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-semibold text-sm truncate">{worker.name}</p>
          <p className="text-muted-foreground text-xs">{worker.role} · {worker.registration}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`text-[10px] px-2 py-1 rounded border font-semibold ${getWorkerStatusColor(worker.status)}`}>
            {worker.status}
          </span>
          {isDayOffToday && (
            <span className="text-[10px] px-2 py-1 rounded border font-semibold border-status-warning/30 bg-status-warning/10 text-status-warning">
              De folga hoje
            </span>
          )}
        </div>
      </div>

      {hasDayOffConflict && (
        <div className="rounded border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
          Este manutentor está apontado como Em serviço em um dia configurado como folga.
        </div>
      )}

      {hasOverdueAlert && (
        <div className="rounded border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
          {overdueOrders.length} OS atribuída(s) com prazo vencido. Priorize essas execuções antes das demais tarefas.
        </div>
      )}

      {isDayOffToday && !activeEntry && (
        <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          O início de trabalho está bloqueado hoje porque a escala indica folga.
        </div>
      )}

      {activeEntry && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-status-info/10 border border-status-info/30 rounded px-3 py-2">
          <div>
            <p className="text-status-info text-xs font-medium">Em execução</p>
            <p className="text-muted-foreground text-[10px]">
              {activeOrder?.number ?? "—"} · {activeEntry.activityType}
            </p>
            {activeOrder?.dueDate && (
              <p className={`text-[10px] ${activeOrderIsOverdue ? "text-status-danger" : "text-muted-foreground"}`}>
                Prazo {formatDate(activeOrder.dueDate)}
              </p>
            )}
          </div>
          <LiveTimer startIso={activeEntry.startTime} />
        </div>
      )}

      {!activeEntry ? (
        <div className="space-y-2">
          <select
            value={selectedOS}
            onChange={(event) => setSelectedOS(event.target.value)}
            className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground"
          >
            {availableOrders.length === 0 && <option value="">Nenhuma OS disponível</option>}
            {availableOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.number} — {order.sector}{order.dueDate ? ` · prazo ${formatDate(order.dueDate)}` : ""}
              </option>
            ))}
          </select>
          {selectedOS && (() => {
            const selectedOrder = availableOrders.find((order) => order.id === selectedOS);
            if (!selectedOrder?.dueDate) {
              return null;
            }

            const selectedOrderIsOverdue = isServiceOrderOverdue(selectedOrder.dueDate, selectedOrder.status);
            return (
              <div className={`rounded border px-3 py-2 text-[11px] ${selectedOrderIsOverdue ? "border-status-danger/30 bg-status-danger/10 text-status-danger" : "border-status-info/30 bg-status-info/10 text-status-info"}`}>
                Prazo da OS selecionada: {formatDate(selectedOrder.dueDate)}
              </div>
            );
          })()}
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
            className="w-full bg-input border border-border rounded px-3 py-2 text-xs text-foreground"
          >
            {(["Execução", "Espera", "Deslocamento", "Setup"] as ActivityType[]).map((activity) => (
              <option key={activity}>{activity}</option>
            ))}
          </select>
          <button
            onClick={() => void onStart(worker.id, selectedOS, activityType)}
            disabled={!selectedOS || isDayOffToday}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-status-ok/20 border border-status-ok/40 text-status-ok text-sm font-medium hover:bg-status-ok/30 transition-colors disabled:opacity-40"
          >
            <Play className="w-4 h-4 fill-current" /> Iniciar Trabalho
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => void onPause(activeEntry.id, worker.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded bg-status-warning/20 border border-status-warning/30 text-status-warning text-xs font-medium hover:bg-status-warning/30 transition-colors"
          >
            <Pause className="w-3.5 h-3.5" /> Pausar
          </button>
          <button
            onClick={() => void onFinish(activeEntry.id, worker.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded bg-destructive/20 border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/30 transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> Finalizar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border">
        <div className="text-center">
          <p className="text-foreground font-semibold text-xs">{formatHours(totalHours)}</p>
          <p className="text-muted-foreground text-[10px]">Total</p>
        </div>
        <div className="text-center">
          <p className="text-status-ok font-semibold text-xs">{formatHours(productiveHours)}</p>
          <p className="text-muted-foreground text-[10px]">Produtivo</p>
        </div>
        <div className="text-center">
          <p
            className={`font-semibold text-xs ${
              productivity >= 70
                ? "text-status-ok"
                : productivity >= 50
                ? "text-status-warning"
                : "text-status-danger"
            }`}
          >
            {productivity.toFixed(0)}%
          </p>
          <p className="text-muted-foreground text-[10px]">Produtividade</p>
        </div>
      </div>
    </div>
  );
}

export function TimeControlView() {
  const { state } = useApp();
  const { workers, update: updateWorker, loading: workersLoading, error: workersError } = useWorkers();
  const { schedules, overrides, cycleOverrides } = useWorkSchedules();
  const {
    serviceOrders,
    setWorkers,
    changeStatus,
    loading: ordersLoading,
    error: ordersError,
  } = useServiceOrders();
  const {
    timeEntries,
    create,
    pause,
    finish,
    loading: timeLoading,
    error: timeError,
  } = useTimeEntries();

  const userRole = state.currentUser?.role;
  const currentUserName = state.currentUser?.name ?? "Sistema";
  const canViewAll = hasPermission(userRole, "time:view_all");
  const currentWorkerId = resolveCurrentUserWorkerId(state.currentUser, workers);
  const today = new Date();

  const dayStatusByWorkerId = useMemo(() => {
    const scheduledWorkers = resolveScheduledWorkers(workers, schedules);

    return new Map(
      scheduledWorkers
        .filter((worker) => worker.id)
        .map(
          (worker) =>
            [worker.id as string, getScheduledWorkerDayStatus(today, worker, overrides, cycleOverrides)] as const
        )
    );
  }, [cycleOverrides, overrides, schedules, workers]);

  const visibleWorkers = canViewAll
    ? workers
    : workers.filter((worker) => worker.id === currentWorkerId);

  const visibleOrders = canViewAll
    ? serviceOrders
    : serviceOrders.filter((order) => currentWorkerId && order.workerIds.includes(currentWorkerId));

  const visibleTimeEntries = canViewAll
    ? timeEntries
    : timeEntries.filter((entry) => entry.workerId === currentWorkerId);
  const overdueOrdersCount = visibleOrders.filter(
    (order) => order.dueDate && isServiceOrderOverdue(order.dueDate, order.status)
  ).length;

  const loading = workersLoading || ordersLoading || timeLoading;
  const error = workersError || ordersError || timeError;

  async function handleStartWork(workerId: string, serviceOrderId: string, activityType: ActivityType) {
    if (!serviceOrderId) return;

    const todayStatus = dayStatusByWorkerId.get(workerId);
    if (todayStatus === "rest") return;

    const order = serviceOrders.find((item) => item.id === serviceOrderId);
    if (!order) return;

    const createdEntry = await create({
      workerId,
      serviceOrderId,
      activityType,
      startTime: new Date().toISOString(),
    });
    if (!createdEntry) return;

    await updateWorker(workerId, { status: "Em serviço" });
    await setWorkers(serviceOrderId, Array.from(new Set([...order.workerIds, workerId])), currentUserName);
    if (order.status === "Aberta") {
      await changeStatus(serviceOrderId, "Em andamento", currentUserName);
    }
  }

  async function handlePause(entryId: string, workerId: string) {
    const pausedEntry = await pause(entryId);
    if (!pausedEntry) return;

    await updateWorker(workerId, { status: "Em pausa" });
  }

  async function handleFinish(entryId: string, workerId: string) {
    const finishedEntry = await finish(entryId);
    if (!finishedEntry) return;

    await updateWorker(workerId, { status: "Disponível" });
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-foreground font-semibold">Controle de Tempo</h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {canViewAll
              ? "Apontamento de horas em tempo real por colaborador de campo"
              : "Seu apontamento de horas em tempo real"}
          </p>
        </div>
        {canViewAll && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>{workers.filter((worker) => worker.status === "Em serviço").length} em serviço</span>
            {overdueOrdersCount > 0 && <span className="text-status-danger">· {overdueOrdersCount} OS atrasada(s)</span>}
          </div>
        )}
      </div>

      {overdueOrdersCount > 0 && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          Existem OS com prazo vencido no Controle de Tempo. Elas permanecem disponíveis para apontamento, mas ficam destacadas para priorização operacional.
        </div>
      )}

      {loading && visibleWorkers.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">Carregando apontamentos...</div>
      )}

      {!canViewAll && !currentWorkerId && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Seu usuário não está vinculado a um manutentor válido. Vincule o usuário ao cadastro do manutentor para visualizar e apontar horas nas OS, inclusive para o perfil Operador.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleWorkers.map((worker) => (
          
          <WorkerTimeCard
            key={worker.id}
            worker={worker}
            orders={visibleOrders}
            entries={timeEntries.filter((entry) => entry.workerId === worker.id)}
            isDayOffToday={dayStatusByWorkerId.get(worker.id) === "rest"}
            hasDayOffConflict={
              dayStatusByWorkerId.get(worker.id) === "rest" && worker.status === "Em serviço"
            }
            onStart={handleStartWork}
            onPause={handlePause}
            onFinish={handleFinish}
          />
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 sm:px-5 py-3 border-b border-border">
          <p className="text-foreground font-semibold text-sm">Todos os Apontamentos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground font-medium px-5 py-2">Manutentor</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-2">OS</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-2">Atividade</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-2">Início</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-2">Fim</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-2">Duração</th>
              </tr>
            </thead>
            <tbody>
              {[...visibleTimeEntries]
                .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
                .map((entry) => {
                  const worker = workers.find((item) => item.id === entry.workerId);
                  const order = serviceOrders.find((item) => item.id === entry.osId);
                  const hours = entry.endTime
                    ? (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 3600000
                    : (Date.now() - new Date(entry.startTime).getTime()) / 3600000;
                  const productive = entry.activityType === "Execução" || entry.activityType === "Setup";
                  return (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-5 py-2.5 text-foreground font-medium">{worker?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-primary font-mono">{order?.number ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            productive
                              ? "bg-status-ok/10 text-status-ok border border-status-ok/30"
                              : "bg-status-warning/10 text-status-warning border border-status-warning/30"
                          }`}
                        >
                          {entry.activityType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(entry.startTime)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {entry.endTime ? formatDateTime(entry.endTime) : <span className="text-status-info">Em andamento</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-foreground">{formatHours(hours)}</td>
                    </tr>
                  );
                })}
              {!loading && visibleTimeEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Nenhum apontamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}