"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useWorkSchedules } from "@/hooks/useWorkSchedules";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useWorkers } from "@/hooks/useWorkers";
import { formatDate, formatHours, getOSStatusColor, getWorkerStatusColor, isServiceOrderOverdue } from "@/lib/format";
import {
  getDefaultShiftLabel,
  getScaleBadgeColor,
  getScaleDescription,
  getScaleName,
  getScheduledWorkerDayStatus,
  resolveScheduledWorkers,
  scheduleDefinitions,
  supportsCycleOffset,
} from "@/lib/work-schedules";
import type { ScheduleCode, Worker, WorkerInput, WorkerStatus, WorkSchedule } from "@/lib/types";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";

type WorkerFormValues = WorkerInput & {
  scaleCode: ScheduleCode;
  cycleOffset: number;
  shiftLabel: string;
  scheduleNotes: string;
};

function WorkerFormModal({
  worker,
  schedule,
  onSaved,
  onClose,
}: {
  worker?: Worker;
  schedule?: WorkSchedule;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { create, update, loading, error } = useWorkers();
  const { upsertSchedule, loading: scheduleLoading, error: scheduleError } = useWorkSchedules();
  const isEdit = Boolean(worker);

  const [form, setForm] = useState<WorkerFormValues>({
    name: worker?.name ?? "",
    registration: worker?.registration ?? "",
    role: worker?.role ?? "",
    shift: worker?.shift ?? "Manhã",
    specialty: worker?.specialty ?? "",
    availableHoursPerDay: worker?.availableHoursPerDay ?? 8,
    status: worker?.status ?? "Disponível",
    scaleCode: schedule?.scaleCode ?? "ND",
    cycleOffset: schedule?.cycleOffset ?? 0,
    shiftLabel: schedule?.shiftLabel ?? getDefaultShiftLabel(schedule?.scaleCode ?? "ND"),
    scheduleNotes: schedule?.notes ?? "",
  });

  const saving = loading || scheduleLoading;
  const formError = error || scheduleError;

  function setField<K extends keyof WorkerFormValues>(key: K, value: WorkerFormValues[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function setScaleCode(scaleCode: ScheduleCode) {
    setForm((previous) => ({
      ...previous,
      scaleCode,
      cycleOffset: scaleCode === "42" ? previous.cycleOffset : 0,
      shiftLabel:
        previous.shiftLabel === "" || previous.shiftLabel === getDefaultShiftLabel(previous.scaleCode)
          ? getDefaultShiftLabel(scaleCode)
          : previous.shiftLabel,
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const workerPayload: WorkerInput = {
      name: form.name,
      registration: form.registration,
      role: form.role,
      shift: form.shift,
      specialty: form.specialty,
      availableHoursPerDay: form.availableHoursPerDay,
      status: form.status,
    };

    const result = isEdit && worker ? await update(worker.id, workerPayload) : await create(workerPayload);

    if (!result) {
      return;
    }

    const savedSchedule = await upsertSchedule({
      workerId: result.id,
      registration: form.registration,
      workerName: form.name,
      scaleCode: form.scaleCode,
      scaleName: getScaleName(form.scaleCode),
      cycleOffset: form.scaleCode === "42" ? form.cycleOffset : 0,
      shiftLabel: form.shiftLabel.trim() || getDefaultShiftLabel(form.scaleCode),
      notes: form.scheduleNotes.trim() || undefined,
    }, {
      scheduleId: schedule?.id,
      previousRegistration: worker?.registration,
    });

    if (!savedSchedule) {
      await onSaved();
      return;
    }

    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-foreground font-semibold text-sm">
            {isEdit ? "Editar Manutentor" : "Novo Manutentor"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground font-medium mb-1">Nome</label>
              <input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Matrícula</label>
              <input
                value={form.registration}
                onChange={(event) => setField("registration", event.target.value)}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Turno</label>
              <select
                value={form.shift}
                onChange={(event) => setField("shift", event.target.value)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {["Manhã", "Tarde", "Noite"].map((shift) => (
                  <option key={shift}>{shift}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Função</label>
              <input
                value={form.role}
                onChange={(event) => setField("role", event.target.value)}
                required
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Especialidade</label>
              <input
                value={form.specialty}
                onChange={(event) => setField("specialty", event.target.value)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(event) => setField("status", event.target.value as WorkerStatus)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {(["Disponível", "Em serviço", "Em pausa"] as WorkerStatus[]).map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Escala</label>
              <select
                value={form.scaleCode}
                onChange={(event) => setScaleCode(event.target.value as ScheduleCode)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {scheduleDefinitions.map((definition) => (
                  <option key={definition.code} value={definition.code}>
                    {definition.code} - {definition.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Rótulo da escala</label>
              <input
                value={form.shiftLabel}
                onChange={(event) => setField("shiftLabel", event.target.value)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            {supportsCycleOffset(form.scaleCode) && (
              <div>
                <label className="block text-xs text-muted-foreground font-medium mb-1">Posição no ciclo 6x2</label>
                <select
                  value={form.cycleOffset}
                  onChange={(event) => setField("cycleOffset", Number(event.target.value))}
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
                >
                  {Array.from({ length: 8 }, (_, index) => (
                    <option key={index} value={index}>
                      Ciclo {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground font-medium mb-1">Disponível/dia (h)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.availableHoursPerDay}
                onChange={(event) => setField("availableHoursPerDay", Number(event.target.value))}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="col-span-2 rounded border border-border bg-muted/20 px-3 py-3">
              <p className="text-[11px] font-medium text-foreground">Regra da escala</p>
              <p className="mt-1 text-xs text-muted-foreground">{getScaleDescription(form.scaleCode)}</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground font-medium mb-1">Observações da escala</label>
              <textarea
                value={form.scheduleNotes}
                onChange={(event) => setField("scheduleNotes", event.target.value)}
                rows={3}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted/30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              disabled={saving}
            >
              {isEdit ? "Salvar" : "Cadastrar"}
            </button>
          </div>
          {formError && <div className="text-red-500 text-xs pt-2">{formError}</div>}
        </form>
      </div>
    </div>
  );
}

export function WorkersView() {
  const { workers, update, remove, getAll, loading, error } = useWorkers();
  const { schedules, overrides, cycleOverrides, getAll: getAllSchedules, removeSchedule } = useWorkSchedules();
  const { serviceOrders } = useServiceOrders();
  const { timeEntries } = useTimeEntries();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | undefined>();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const schedulesByWorkerId = useMemo(
    () => new Map(schedules.filter((schedule) => schedule.workerId).map((schedule) => [schedule.workerId as string, schedule])),
    [schedules]
  );

  const schedulesByRegistration = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.registration, schedule])),
    [schedules]
  );

  const todayStatusByWorkerId = useMemo(() => {
    const scheduledWorkers = resolveScheduledWorkers(workers, schedules);

    return new Map(
      scheduledWorkers
        .filter((worker) => worker.id)
        .map(
          (worker) =>
            [worker.id as string, getScheduledWorkerDayStatus(today, worker, overrides, cycleOverrides)] as const
        )
    );
  }, [cycleOverrides, overrides, schedules, today, todayKey, workers]);

  const hoursByWorker = useMemo(() => {
    return new Map(
      workers.map((worker) => {
        const total = timeEntries
          .filter((entry) => entry.workerId === worker.id)
          .reduce((accumulator, entry) => {
            const end = entry.endTime ? new Date(entry.endTime) : new Date();
            return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
          }, 0);
        return [worker.id, total];
      })
    );
  }, [timeEntries, workers]);

  const filtered = workers.filter(
    (worker) =>
      search === "" ||
      worker.name.toLowerCase().includes(search.toLowerCase()) ||
      worker.registration.toLowerCase().includes(search.toLowerCase()) ||
      worker.specialty.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar manutentor..."
            className="w-full bg-input border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => {
            setEditingWorker(undefined);
            setShowForm(true);
          }}
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Novo Manutentor
        </button>
      </div>

      {loading && workers.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">Carregando manutentores...</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filtered.map((worker) => {
          const hours = hoursByWorker.get(worker.id) ?? 0;
          const workerOrders = serviceOrders
            .filter((order) => order.workerIds.includes(worker.id))
            .sort((left, right) => {
              const leftDueDate = left.dueDate ?? "9999-12-31";
              const rightDueDate = right.dueDate ?? "9999-12-31";
              if (leftDueDate !== rightDueDate) {
                return leftDueDate.localeCompare(rightDueDate);
              }

              return new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime();
            });
          const osFinished = workerOrders.filter((order) => order.status === "Finalizada").length;
          const activeOrders = workerOrders.filter((order) => order.status !== "Finalizada").slice(0, 3);
          const overdueOrders = workerOrders.filter(
            (order) => order.dueDate && isServiceOrderOverdue(order.dueDate, order.status)
          );
          const schedule = schedulesByWorkerId.get(worker.id) ?? schedulesByRegistration.get(worker.registration);
          const todayStatus = todayStatusByWorkerId.get(worker.id) ?? "undefined";
          const isDayOffToday = todayStatus === "rest";
          const isWorkingOnDayOff = isDayOffToday && worker.status === "Em serviço";

          return (
            <div
              key={worker.id}
              className={`bg-card border rounded-lg p-5 ${
                isWorkingOnDayOff || overdueOrders.length > 0
                  ? "border-status-danger/40 bg-status-danger/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {worker.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-sm">{worker.name}</p>
                    <p className="text-muted-foreground text-xs font-mono">{worker.registration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingWorker(worker);
                      setShowForm(true);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir ${worker.name}?`)) {
                        void (async () => {
                          const scheduleToRemove =
                            schedulesByWorkerId.get(worker.id) ?? schedulesByRegistration.get(worker.registration);

                          if (scheduleToRemove) {
                            await removeSchedule({
                              scheduleId: scheduleToRemove.id,
                              registration: scheduleToRemove.registration,
                            });
                          }

                          await remove(worker.id);
                          await Promise.all([getAll(), getAllSchedules()]);
                        })();
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                <div className="bg-muted/20 rounded px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Função</p>
                  <p className="text-foreground text-xs font-medium mt-0.5">{worker.role}</p>
                </div>
                <div className="bg-muted/20 rounded px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Turno</p>
                  <p className="text-foreground text-xs font-medium mt-0.5">{worker.shift}</p>
                </div>
                <div className="bg-muted/20 rounded px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Especialidade</p>
                  <p className="text-foreground text-xs font-medium mt-0.5 truncate">{worker.specialty}</p>
                </div>
                <div className="bg-muted/20 rounded px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Disponível/dia</p>
                  <p className="text-foreground text-xs font-medium mt-0.5">{formatHours(worker.availableHoursPerDay)}</p>
                </div>
                <div className="bg-muted/20 rounded px-3 py-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[10px]">Escala</p>
                    {schedule && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getScaleBadgeColor(schedule.scaleCode)}`}>
                        {schedule.scaleCode}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground text-xs font-medium mt-0.5 truncate">
                    {schedule ? schedule.scaleName : "Sem escala definida"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded border font-semibold ${getWorkerStatusColor(worker.status)}`}>
                      {worker.status}
                    </span>
                    {isDayOffToday && (
                      <span className="text-[10px] px-2 py-1 rounded border font-semibold border-status-warning/30 bg-status-warning/10 text-status-warning">
                        De folga hoje
                      </span>
                    )}
                    {isWorkingOnDayOff && (
                      <span className="text-[10px] px-2 py-1 rounded border font-semibold border-status-danger/30 bg-status-danger/10 text-status-danger">
                        Em serviço na folga
                      </span>
                    )}
                    {overdueOrders.length > 0 && (
                      <span className="text-[10px] px-2 py-1 rounded border font-semibold border-status-danger/30 bg-status-danger/10 text-status-danger">
                        {overdueOrders.length} OS atrasada(s)
                      </span>
                    )}
                  </div>
                  <select
                    value={worker.status}
                    onChange={(event) => {
                      void update(worker.id, { status: event.target.value as WorkerStatus });
                    }}
                    className="bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground"
                  >
                    {(["Disponível", "Em serviço", "Em pausa"] as WorkerStatus[]).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs">
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-semibold">{formatHours(hours)}</span> trabalhadas
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-semibold">{osFinished}</span> OS
                  </span>
                  <span className="text-muted-foreground">
                    Hoje: <span className="text-foreground font-semibold">{isDayOffToday ? "Folga" : todayStatus === "work" ? "Trabalho" : "Sem regra"}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-foreground text-xs font-semibold">OS atribuídas</p>
                  <span className="text-[10px] text-muted-foreground">{workerOrders.length} total</span>
                </div>
                {activeOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem OS ativas atribuídas.</p>
                ) : (
                  activeOrders.map((order) => {
                    const isOverdue = order.dueDate ? isServiceOrderOverdue(order.dueDate, order.status) : false;
                    return (
                      <div key={order.id} className={`rounded border px-3 py-2 ${isOverdue ? "border-status-danger/30 bg-status-danger/10" : "border-border bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-foreground text-xs font-semibold font-mono">{order.number}</p>
                            <p className="text-muted-foreground text-[11px] truncate">{order.sector}</p>
                          </div>
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${getOSStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className={`mt-2 text-[11px] ${isOverdue ? "text-status-danger font-semibold" : "text-muted-foreground"}`}>
                          Prazo: {order.dueDate ? formatDate(order.dueDate) : "Não definido"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="sm:col-span-2 2xl:col-span-3 py-20 text-center text-muted-foreground text-sm">
            Nenhum manutentor encontrado.
          </div>
        )}
      </div>

      {showForm && (
        <WorkerFormModal
          worker={editingWorker}
          schedule={
            editingWorker
              ? schedulesByWorkerId.get(editingWorker.id) ?? schedulesByRegistration.get(editingWorker.registration)
              : undefined
          }
          onSaved={async () => {
            await Promise.all([getAll(), getAllSchedules()]);
          }}
          onClose={() => {
            setShowForm(false);
            setEditingWorker(undefined);
          }}
        />
      )}

      {error && <div className="text-red-500 text-xs pt-2">{error}</div>}
    </div>
  );
}