"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Search, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkSchedules } from "@/hooks/useWorkSchedules";
import { useWorkers } from "@/hooks/useWorkers";
import {
  getBaseDayStatus,
  getScaleBadgeColor,
  getScaleDescription,
  getScheduledWorkerDayStatus,
  getScheduleCyclePosition,
  resolveScheduledWorkers,
  type ResolvedScheduleDayStatus,
  type ScheduledWorker,
} from "@/lib/work-schedules";
import type { ScheduleCode, ScheduleDayStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type DayOverrideConfig = {
  dayStatus: ScheduleDayStatus;
  isOvertime: boolean;
};

type OverrideMap = Record<string, Record<string, DayOverrideConfig>>;
type CycleOverrideMap = Record<string, Record<number, ScheduleDayStatus>>;
type DayEditorScope = "date" | "cycle";
type DayEditorStatus = ScheduleDayStatus | "base" | "undefined";

interface DayEditorState {
  date: Date;
  status: DayEditorStatus;
  applyScope: DayEditorScope;
  isOvertime: boolean;
}

const scaleFilters: { value: ScheduleCode | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas as escalas" },
  { value: "41", label: "Escala 41" },
  { value: "42", label: "Escala 42" },
  { value: "43", label: "Escala 43" },
  { value: "ND", label: "Sem escala" },
];
const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getResolvedDayStatus(
  date: Date,
  worker: ScheduledWorker,
  overrides: OverrideMap,
  cycleOverrides: CycleOverrideMap
): ResolvedScheduleDayStatus {
  const dayOverrides = worker.scheduleId
    ? Object.entries(overrides[worker.scheduleId] ?? {}).map(([scheduleDate, dayOverride]) => ({
        id: `${worker.scheduleId}-${scheduleDate}`,
        scheduleId: worker.scheduleId as string,
        scheduleDate,
        dayStatus: dayOverride.dayStatus,
        isOvertime: dayOverride.isOvertime,
      }))
    : [];
  const recurringOverrides = worker.scheduleId
    ? Object.entries(cycleOverrides[worker.scheduleId] ?? {}).map(([cyclePosition, dayStatus]) => ({
        id: `${worker.scheduleId}-${cyclePosition}`,
        scheduleId: worker.scheduleId as string,
        cyclePosition: Number(cyclePosition),
        dayStatus,
      }))
    : [];

  return getScheduledWorkerDayStatus(date, worker, dayOverrides, recurringOverrides);
}

function getDayPill(status: ResolvedScheduleDayStatus) {
  switch (status) {
    case "work":
      return {
        label: "Trabalho",
        className: "border-status-ok/30 bg-status-ok/10 text-status-ok",
        cellClassName: "border-status-ok/30 bg-status-ok/8",
      };
    case "rest":
      return {
        label: "Folga",
        className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
        cellClassName: "border-status-warning/30 bg-status-warning/8",
      };
    case "undefined":
      return {
        label: "Definir",
        className: "border-border bg-muted/40 text-muted-foreground",
        cellClassName: "border-border bg-muted/20",
      };
  }
}

export function WorkScheduleView() {
  const { workers, loading: workersLoading, error: workersError } = useWorkers();
  const {
    schedules,
    overrides: overrideRows,
    cycleOverrides: cycleOverrideRows,
    loading: schedulesLoading,
    error: schedulesError,
    upsertSchedule,
    saveOverride,
    saveCycleOverride,
    removeOverride,
    removeCycleOverride,
    removeCycleOverrides,
    removeMonthOverrides,
  } = useWorkSchedules();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState("");
  const [scaleFilter, setScaleFilter] = useState<ScheduleCode | "ALL">("ALL");
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | null>(null);
  const [dayEditor, setDayEditor] = useState<DayEditorState | null>(null);

  const overrides = useMemo(() => {
    return overrideRows.reduce<OverrideMap>((accumulator, override) => {
      if (!accumulator[override.scheduleId]) {
        accumulator[override.scheduleId] = {};
      }
      accumulator[override.scheduleId][override.scheduleDate] = {
        dayStatus: override.dayStatus,
        isOvertime: override.isOvertime,
      };
      return accumulator;
    }, {});
  }, [overrideRows]);

  const cycleOverrides = useMemo(() => {
    return cycleOverrideRows.reduce<CycleOverrideMap>((accumulator, override) => {
      if (!accumulator[override.scheduleId]) {
        accumulator[override.scheduleId] = {};
      }
      accumulator[override.scheduleId][override.cyclePosition] = override.dayStatus;
      return accumulator;
    }, {});
  }, [cycleOverrideRows]);

  const scheduledWorkers = useMemo(() => resolveScheduledWorkers(workers, schedules), [workers, schedules]);

  const filteredWorkers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scheduledWorkers.filter((worker) => {
      const matchesScale = scaleFilter === "ALL" || worker.scaleCode === scaleFilter;
      const matchesSearch =
        normalizedSearch === "" ||
        worker.name.toLowerCase().includes(normalizedSearch) ||
        worker.registration.toLowerCase().includes(normalizedSearch) ||
        worker.scaleName.toLowerCase().includes(normalizedSearch);

      return matchesScale && matchesSearch;
    });
  }, [scheduledWorkers, search, scaleFilter]);

  useEffect(() => {
    if (!filteredWorkers.length) {
      setSelectedWorkerKey(null);
      setDayEditor(null);
      return;
    }

    const stillVisible = filteredWorkers.some((worker) => worker.key === selectedWorkerKey);
    if (!stillVisible) {
      setSelectedWorkerKey(filteredWorkers[0].key);
      setDayEditor(null);
    }
  }, [filteredWorkers, selectedWorkerKey]);

  const selectedWorker = filteredWorkers.find((worker) => worker.key === selectedWorkerKey) ?? null;

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  );

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month]
  );

  const overviewCards = useMemo(() => {
    const total = scheduledWorkers.length;
    const scale41 = scheduledWorkers.filter((worker) => worker.scaleCode === "41").length;
    const scale42 = scheduledWorkers.filter((worker) => worker.scaleCode === "42").length;
    const scale43 = scheduledWorkers.filter((worker) => worker.scaleCode === "43").length;
    return [
      { label: "Manutentores mapeados", value: total, helper: "cadastro + planilha" },
      { label: "Escala 41", value: scale41, helper: "Seg a sáb" },
      { label: "Escala 42", value: scale42, helper: "6x2" },
      { label: "Escala 43", value: scale43, helper: "diversa" },
    ];
  }, [scheduledWorkers]);

  const selectedMonthSummary = useMemo(() => {
    if (!selectedWorker) {
      return { workDays: 0, restDays: 0, undefinedDays: 0, manualChanges: 0, nextRests: [] as Date[] };
    }

    const resolvedDays = monthDays.map((date) =>
      getResolvedDayStatus(date, selectedWorker, overrides, cycleOverrides)
    );
    const nextRests = monthDays.filter(
      (date) => getResolvedDayStatus(date, selectedWorker, overrides, cycleOverrides) === "rest"
    );
    const manualChanges = monthDays.filter((date) => {
      const resolved = getResolvedDayStatus(date, selectedWorker, overrides, cycleOverrides);
      const base = getBaseDayStatus(date, selectedWorker);
      const dateOverride = selectedWorker.scheduleId ? overrides[selectedWorker.scheduleId]?.[getDateKey(date)] : undefined;
      return resolved !== base || Boolean(dateOverride?.isOvertime);
    }).length;

    return {
      workDays: resolvedDays.filter((status) => status === "work").length,
      restDays: resolvedDays.filter((status) => status === "rest").length,
      undefinedDays: resolvedDays.filter((status) => status === "undefined").length,
      manualChanges,
      nextRests,
    };
  }, [cycleOverrides, monthDays, overrides, selectedWorker]);

  async function ensurePersistedSchedule(worker: ScheduledWorker) {
    if (worker.scheduleId) {
      return schedules.find((schedule) => schedule.id === worker.scheduleId) ?? null;
    }

    const created = await upsertSchedule({
      workerId: worker.id,
      registration: worker.registration,
      workerName: worker.name,
      scaleCode: worker.scaleCode,
      scaleName: worker.scaleName,
      cycleOffset: worker.cycleOffset,
      shiftLabel: worker.shift,
    });

    return created;
  }

  function handleOpenDayEditor(date: Date) {
    if (!selectedWorker || !isSameMonth(date, month)) {
      return;
    }

    const dateKey = getDateKey(date);
    const baseStatus = getBaseDayStatus(date, selectedWorker);
    const resolvedStatus = getResolvedDayStatus(date, selectedWorker, overrides, cycleOverrides);
    const cyclePosition = getScheduleCyclePosition(date, selectedWorker);
    const dateOverride = selectedWorker.scheduleId ? overrides[selectedWorker.scheduleId]?.[dateKey] : undefined;
    const cycleOverride =
      selectedWorker.scheduleId && cyclePosition !== null
        ? cycleOverrides[selectedWorker.scheduleId]?.[cyclePosition]
        : undefined;

    const initialStatus: DayEditorStatus = (() => {
      if (dateOverride) {
        return dateOverride.dayStatus;
      }

      if (cycleOverride) {
        return cycleOverride;
      }

      if (baseStatus === "undefined") {
        return resolvedStatus;
      }

      return resolvedStatus === baseStatus ? "base" : resolvedStatus;
    })();

    setDayEditor({
      date,
      status: initialStatus,
      applyScope: baseStatus !== "undefined" && cyclePosition !== null && !dateOverride ? "cycle" : "date",
      isOvertime: dateOverride?.isOvertime ?? false,
    });
  }

  async function handleSaveDayEditor() {
    if (!selectedWorker || !dayEditor || !isSameMonth(dayEditor.date, month)) {
      return;
    }

    const schedule = await ensurePersistedSchedule(selectedWorker);
    if (!schedule) {
      return;
    }

    const dateKey = getDateKey(dayEditor.date);
    const baseStatus = getBaseDayStatus(dayEditor.date, selectedWorker);
    const cyclePosition = getScheduleCyclePosition(dayEditor.date, selectedWorker);

    if (dayEditor.isOvertime) {
      await saveOverride(schedule.id, dateKey, "work", { isOvertime: true });
      setDayEditor(null);
      return;
    }

    if (dayEditor.applyScope === "cycle" && cyclePosition !== null && baseStatus !== "undefined") {
      await removeOverride(schedule.id, dateKey);

      if (dayEditor.status === "base") {
        await removeCycleOverride(schedule.id, cyclePosition);
      } else {
        await saveCycleOverride(schedule.id, cyclePosition, dayEditor.status as ScheduleDayStatus);
      }

      setDayEditor(null);
      return;
    }

    const nextDateStatus =
      baseStatus === "undefined"
        ? dayEditor.status === "undefined"
          ? undefined
          : (dayEditor.status as ScheduleDayStatus)
        : dayEditor.status === "base"
        ? undefined
        : (dayEditor.status as ScheduleDayStatus);

    if (nextDateStatus) {
      await saveOverride(schedule.id, dateKey, nextDateStatus, { isOvertime: false });
    } else {
      await removeOverride(schedule.id, dateKey);
    }

    setDayEditor(null);
  }

  async function clearMonthOverrides() {
    if (!selectedWorker?.scheduleId) {
      return;
    }

    const cyclePositions = Array.from(
      new Set(
        monthDays
          .map((date) => getScheduleCyclePosition(date, selectedWorker))
          .filter((value): value is number => value !== null)
      )
    );

    await Promise.all([
      removeMonthOverrides(
        selectedWorker.scheduleId,
        getDateKey(startOfMonth(month)),
        getDateKey(endOfMonth(month))
      ),
      removeCycleOverrides(selectedWorker.scheduleId, cyclePositions),
    ]);
  }

  const loading = workersLoading || schedulesLoading;
  const error = workersError || schedulesError;
  const dayEditorBaseStatus = dayEditor && selectedWorker ? getBaseDayStatus(dayEditor.date, selectedWorker) : "undefined";
  const dayEditorCyclePosition = dayEditor && selectedWorker ? getScheduleCyclePosition(dayEditor.date, selectedWorker) : null;
  const dayEditorSupportsCycle = Boolean(dayEditor && dayEditorBaseStatus !== "undefined" && dayEditorCyclePosition !== null);
  const dayEditorDateKey = dayEditor ? getDateKey(dayEditor.date) : "";
  const dayEditorResolvedStatus =
    dayEditor && selectedWorker ? getResolvedDayStatus(dayEditor.date, selectedWorker, overrides, cycleOverrides) : "undefined";
  const dayEditorSelectedStatus = dayEditor?.isOvertime
    ? "work"
    : dayEditor?.status === "base"
    ? dayEditorBaseStatus
    : dayEditor?.status;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-foreground font-semibold">Escalas de Trabalho</h2>
          <p className="text-muted-foreground text-xs mt-1 max-w-3xl">
            Calendário mensal de dias trabalhados e folgas por manutentor, usando a ordem de escalas da planilha enviada.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          Clique no dia para abrir os ajustes. Hora extra vale só para a data escolhida; ajustes de ciclo continuam recorrentes.
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, matrícula ou escala"
                className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground"
              />
            </div>
            <select
              value={scaleFilter}
              onChange={(event) => setScaleFilter(event.target.value as ScheduleCode | "ALL")}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground sm:w-56"
            >
              {scaleFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-start xl:self-auto">
            <button
              onClick={() => setMonth((current) => startOfMonth(subMonths(current, 1)))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-40 rounded-lg border border-border bg-muted/20 px-4 py-2 text-center text-sm font-medium text-foreground">
              {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <button
              onClick={() => setMonth((current) => startOfMonth(addMonths(current, 1)))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[22rem,minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Manutentores</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {filteredWorkers.length}
              </span>
            </div>

            <div className="max-h-[48rem] space-y-2 overflow-y-auto pr-1">
              {filteredWorkers.map((worker) => {
                const summary = monthDays.reduce(
                  (accumulator, date) => {
                    const status = getResolvedDayStatus(date, worker, overrides, cycleOverrides);
                    if (status === "work") accumulator.work += 1;
                    if (status === "rest") accumulator.rest += 1;
                    if (status === "undefined") accumulator.undefined += 1;
                    return accumulator;
                  },
                  { work: 0, rest: 0, undefined: 0 }
                );

                return (
                  <button
                    key={worker.key}
                    onClick={() => setSelectedWorkerKey(worker.key)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      selectedWorker?.key === worker.key
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{worker.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{worker.registration}</p>
                      </div>
                      <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold", getScaleBadgeColor(worker.scaleCode))}>
                        {worker.scaleCode}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{worker.scaleName}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-status-ok/30 bg-status-ok/10 px-2 py-1 text-status-ok">
                        {summary.work} trabalho
                      </span>
                      <span className="rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-1 text-status-warning">
                        {summary.rest} folga
                      </span>
                      {summary.undefined > 0 && (
                        <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                          {summary.undefined} pendente
                        </span>
                      )}
                      {worker.hasPersistedSchedule && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                          salvo
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {!loading && filteredWorkers.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum manutentor encontrado para os filtros aplicados.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {selectedWorker ? (
              <>
                <div className="rounded-xl border border-border bg-background px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{selectedWorker.name}</h3>
                        <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold", getScaleBadgeColor(selectedWorker.scaleCode))}>
                          Escala {selectedWorker.scaleCode}
                        </span>
                        {selectedWorker.hasPersistedSchedule && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                            Sincronizada
                          </span>
                        )}
                        {!selectedWorker.hasLiveRecord && (
                          <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                            Apenas planilha
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedWorker.registration}</p>
                      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                        {getScaleDescription(selectedWorker.scaleCode)}
                      </p>
                    </div>

                    <button
                      onClick={() => void clearMonthOverrides()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                    >
                      <RotateCcw className="h-4 w-4" /> Limpar ajustes do mês
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Dias de trabalho</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{selectedMonthSummary.workDays}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Folgas</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{selectedMonthSummary.restDays}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Ajustes manuais</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{selectedMonthSummary.manualChanges}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Dias sem regra</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{selectedMonthSummary.undefinedDays}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-status-ok/30 bg-status-ok/10 px-2.5 py-1 text-status-ok">
                      Trabalho
                    </span>
                    <span className="rounded-full border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-status-warning">
                      Folga
                    </span>
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
                      Definir
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                  <div className="mb-3 grid grid-cols-7 gap-2">
                    {weekdayLabels.map((label) => (
                      <div key={label} className="px-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((date) => {
                      const dayStatus = getResolvedDayStatus(date, selectedWorker, overrides, cycleOverrides);
                      const pill = getDayPill(dayStatus);
                      const isCurrentMonth = isSameMonth(date, month);
                      const cyclePosition = getScheduleCyclePosition(date, selectedWorker);
                      const dateOverride = selectedWorker.scheduleId
                        ? overrides[selectedWorker.scheduleId]?.[getDateKey(date)]
                        : undefined;
                      const hasRecurringOverride =
                        selectedWorker.scheduleId && cyclePosition !== null
                          ? Boolean(cycleOverrides[selectedWorker.scheduleId]?.[cyclePosition])
                          : false;

                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => handleOpenDayEditor(date)}
                          disabled={!isCurrentMonth}
                          className={cn(
                            "min-h-24 rounded-xl border p-2 text-left transition-colors sm:min-h-28",
                            pill.cellClassName,
                            isCurrentMonth ? "hover:bg-muted/20" : "cursor-default opacity-35"
                          )}
                        >
                          <div className="flex h-full flex-col justify-between gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground">{format(date, "d")}</span>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                {dateOverride && (
                                  <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    Data
                                  </span>
                                )}
                                {dateOverride?.isOvertime && (
                                  <span className="rounded-full border border-status-danger/30 bg-status-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-danger">
                                    HE
                                  </span>
                                )}
                                {hasRecurringOverride && (
                                  <span className="rounded-full border border-status-info/30 bg-status-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-info">
                                    Ciclo
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn("inline-flex w-fit rounded-full border px-2 py-1 text-[10px] font-semibold", pill.className)}>
                              {pill.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-foreground">Folgas do mês</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMonthSummary.nextRests.length > 0 ? (
                      selectedMonthSummary.nextRests.map((date) => (
                        <span
                          key={date.toISOString()}
                          className="rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1 text-xs font-medium text-status-warning"
                        >
                          {format(parseISO(getDateKey(date)), "dd/MM · EEE", { locale: ptBR })}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhuma folga calculada para este mês.</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
                Selecione um manutentor para visualizar a escala mensal.
              </div>
            )}

            {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(dayEditor && selectedWorker)} onOpenChange={(open) => !open && setDayEditor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar dia da escala</DialogTitle>
            <DialogDescription>
              {selectedWorker && dayEditor
                ? `${selectedWorker.name} · ${format(dayEditor.date, "dd/MM/yyyy", { locale: ptBR })}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {dayEditor && selectedWorker && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Escala base</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {dayEditorBaseStatus === "undefined"
                      ? "Sem regra"
                      : dayEditorBaseStatus === "work"
                      ? "Trabalho"
                      : "Folga"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Situação atual</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {dayEditorResolvedStatus === "undefined"
                      ? "Sem regra"
                      : dayEditorResolvedStatus === "work"
                      ? "Trabalho"
                      : "Folga"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resultado ao salvar</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {dayEditorSelectedStatus === "undefined"
                      ? "Sem regra"
                      : dayEditorSelectedStatus === "work"
                      ? "Trabalho"
                      : "Folga"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Ajuste do dia</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {dayEditorBaseStatus === "undefined" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "undefined" } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "undefined"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Sem regra
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "work", isOvertime: false } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "work" && !dayEditor.isOvertime
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Trabalho
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "rest", isOvertime: false } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "rest"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Folga
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "base", isOvertime: false } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "base" && !dayEditor.isOvertime
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Seguir escala
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "work", isOvertime: false } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "work" && !dayEditor.isOvertime
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Trabalho
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayEditor((current) => (current ? { ...current, status: "rest", isOvertime: false } : current))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          dayEditor.status === "rest"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        Folga
                      </button>
                    </>
                  )}
                </div>
              </div>

              {dayEditorSupportsCycle && !dayEditor.isOvertime && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Abrangência do ajuste</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDayEditor((current) => (current ? { ...current, applyScope: "date" } : current))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        dayEditor.applyScope === "date"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      Somente esta data
                    </button>
                    <button
                      type="button"
                      onClick={() => setDayEditor((current) => (current ? { ...current, applyScope: "cycle" } : current))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        dayEditor.applyScope === "cycle"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      Repetir no ciclo
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Repetir no ciclo mantém o comportamento atual da tela e propaga o ajuste para as próximas ocorrências equivalentes.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <Checkbox
                  checked={dayEditor.isOvertime}
                  onCheckedChange={(checked) =>
                    setDayEditor((current) =>
                      current
                        ? {
                            ...current,
                            isOvertime: checked === true,
                            applyScope: checked === true ? "date" : current.applyScope,
                            status: checked === true ? "work" : current.status,
                          }
                        : current
                    )
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">Hora extra nesta data</span>
                  <span className="block text-xs text-muted-foreground">
                    Ao marcar, o dia passa a ser tratado como trabalho apenas nesta data. Se a escala original indicar folga, a disponibilidade é liberada temporariamente para apontamento.
                  </span>
                </span>
              </label>

              {dayEditor.isOvertime && dayEditorBaseStatus === "rest" && (
                <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-xs text-status-warning">
                  Este manutentor está de folga pela escala base em {format(dayEditor.date, "dd/MM/yyyy", { locale: ptBR })}. Ao salvar como hora extra, ele ficará disponível para trabalho somente nesta data.
                </div>
              )}

              {selectedWorker.scheduleId && overrides[selectedWorker.scheduleId]?.[dayEditorDateKey]?.isOvertime && (
                <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-xs text-status-danger">
                  Já existe uma marcação de hora extra salva para esta data.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDayEditor(null)}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveDayEditor()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Salvar ajustes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}