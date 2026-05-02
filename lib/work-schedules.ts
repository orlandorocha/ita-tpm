import { differenceInCalendarDays, format } from "date-fns";
import type {
  ScheduleCode,
  ScheduleDayStatus,
  Worker,
  WorkerStatus,
  WorkScheduleCycleOverride,
  WorkSchedule,
  WorkScheduleDayOverride,
} from "./types";

export type ResolvedScheduleDayStatus = ScheduleDayStatus | "undefined";

export interface ScheduleDefinition {
  code: ScheduleCode;
  name: string;
  defaultShiftLabel: string;
  supportsCycleOffset: boolean;
}

interface ShiftRosterRow {
  registration: string;
  name: string;
  scaleCode: Exclude<ScheduleCode, "ND">;
  scaleName: string;
  cycleOffset?: number;
}

export interface ScheduledWorker {
  key: string;
  id?: string;
  scheduleId?: string;
  name: string;
  registration: string;
  role: string;
  shift: string;
  specialty: string;
  status: WorkerStatus;
  availableHoursPerDay: number;
  scaleCode: ScheduleCode;
  scaleName: string;
  cycleOffset: number;
  hasLiveRecord: boolean;
  hasPersistedSchedule: boolean;
}

const scale41Name = "220 - Hrs Mensais Seg a Sab";
const scale42Name = "220 Hrs Mensais - 6 X 2";
const scale43Name = "220 Hrs Mensais - Diversas";
const scale42ReferenceDate = new Date("2026-01-05T00:00:00");

export const scheduleDefinitions: ScheduleDefinition[] = [
  { code: "41", name: scale41Name, defaultShiftLabel: "Seg a Sáb", supportsCycleOffset: false },
  { code: "42", name: scale42Name, defaultShiftLabel: "6x2", supportsCycleOffset: true },
  { code: "43", name: scale43Name, defaultShiftLabel: "Diversa", supportsCycleOffset: false },
  { code: "ND", name: "Sem escala definida", defaultShiftLabel: "A definir", supportsCycleOffset: false },
];

const shiftRoster: ShiftRosterRow[] = [
  { registration: "40103547", name: "EVERALDO FIGUEREDO DE BRITO", scaleCode: "41", scaleName: scale41Name },
  { registration: "40102533", name: "LUCIANO FERREIRA DA SILVA", scaleCode: "41", scaleName: scale41Name },
  { registration: "40103768", name: "ISRAEL CARLOS DINIZ", scaleCode: "41", scaleName: scale41Name },
  { registration: "81118433", name: "RAMON ROQUE ESTEVES", scaleCode: "41", scaleName: scale41Name },
  { registration: "81233339", name: "LEONARDO DOS SANTOS", scaleCode: "41", scaleName: scale41Name },
  { registration: "40103324", name: "JOAQUIM GOMES SANTIAGO", scaleCode: "42", scaleName: scale42Name, cycleOffset: 0 },
  { registration: "40103728", name: "ADEMAR DA SILVA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 1 },
  { registration: "40102561", name: "SIDNEY FLAVIO CARTOLARI", scaleCode: "42", scaleName: scale42Name, cycleOffset: 2 },
  { registration: "80022051", name: "THIAGO ROBERTO COELHO TURTERO", scaleCode: "42", scaleName: scale42Name, cycleOffset: 3 },
  { registration: "40103739", name: "JOSENILDO ALMEIDA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 4 },
  { registration: "80264570", name: "RAFAEL ALVES DOS SANTOS SOUZA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 5 },
  { registration: "80186744", name: "MARCELO BARBOSA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 6 },
  { registration: "81011558", name: "JOSE MIGUEL RICIERI", scaleCode: "42", scaleName: scale42Name, cycleOffset: 7 },
  { registration: "40103741", name: "EDNEY BEZERRA DE ANDRADE", scaleCode: "43", scaleName: scale43Name },
  { registration: "40102540", name: "FRANCISCO ALVES DA SILVA NETO", scaleCode: "43", scaleName: scale43Name },
  { registration: "81041741", name: "MARCOS SOUZA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 0 },
  { registration: "40103733", name: "FRANCISCO DE ASSIS SOUSA LEAL", scaleCode: "42", scaleName: scale42Name, cycleOffset: 1 },
  { registration: "80327968", name: "FABIO SZMYHIEL FERREIRA", scaleCode: "42", scaleName: scale42Name, cycleOffset: 2 },
  { registration: "40101891", name: "MAICON DE BARROS CARVALHO", scaleCode: "42", scaleName: scale42Name, cycleOffset: 3 },
  { registration: "80332061", name: "MARCIO RUFINO", scaleCode: "41", scaleName: scale41Name },
  { registration: "40103746", name: "RONALDO LUIZ GALDINO DA SILVA", scaleCode: "41", scaleName: scale41Name },
  { registration: "40103140", name: "ANTONIO CARVALHO DOS SANTOS", scaleCode: "41", scaleName: scale41Name },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function toScheduledWorker(worker: Worker, rosterRow?: ShiftRosterRow): ScheduledWorker {
  return {
    key: worker.id,
    id: worker.id,
    scheduleId: undefined,
    name: worker.name,
    registration: worker.registration,
    role: worker.role,
    shift: worker.shift,
    specialty: worker.specialty,
    status: worker.status,
    availableHoursPerDay: worker.availableHoursPerDay,
    scaleCode: rosterRow?.scaleCode ?? "ND",
    scaleName: rosterRow?.scaleName ?? "Sem escala definida",
    cycleOffset: rosterRow?.cycleOffset ?? 0,
    hasLiveRecord: true,
    hasPersistedSchedule: false,
  };
}

function createScheduledWorker(params: {
  worker?: Worker;
  rosterRow?: ShiftRosterRow;
  persistedSchedule?: WorkSchedule;
}): ScheduledWorker {
  const { worker, rosterRow, persistedSchedule } = params;

  const registration = worker?.registration ?? persistedSchedule?.registration ?? rosterRow?.registration ?? "";
  const name = worker?.name ?? persistedSchedule?.workerName ?? rosterRow?.name ?? "";
  const scaleCode = persistedSchedule?.scaleCode ?? rosterRow?.scaleCode ?? "ND";
  const scaleName = persistedSchedule?.scaleName ?? rosterRow?.scaleName ?? "Sem escala definida";
  const cycleOffset = persistedSchedule?.cycleOffset ?? rosterRow?.cycleOffset ?? 0;
  const shift = worker?.shift ?? persistedSchedule?.shiftLabel ?? (rosterRow?.scaleCode === "41" ? "Seg a Sáb" : rosterRow?.scaleCode === "42" ? "6x2" : rosterRow?.scaleCode === "43" ? "Diversa" : "");

  return {
    key: worker?.id ?? persistedSchedule?.id ?? `schedule-${registration}`,
    id: worker?.id,
    scheduleId: persistedSchedule?.id,
    name,
    registration,
    role: worker?.role ?? "Manutentor",
    shift,
    specialty: worker?.specialty ?? "",
    status: worker?.status ?? ("Disponível" as WorkerStatus),
    availableHoursPerDay: worker?.availableHoursPerDay ?? 8,
    scaleCode,
    scaleName,
    cycleOffset,
    hasLiveRecord: Boolean(worker),
    hasPersistedSchedule: Boolean(persistedSchedule),
  };
}

export function resolveScheduledWorkers(workers: Worker[], persistedSchedules: WorkSchedule[] = []): ScheduledWorker[] {
  const workersByRegistration = new Map(workers.map((worker) => [worker.registration.trim(), worker]));
  const workersByName = new Map(workers.map((worker) => [normalizeText(worker.name), worker]));
  const schedulesByRegistration = new Map(
    persistedSchedules.map((schedule) => [schedule.registration.trim(), schedule])
  );
  const schedulesByWorkerId = new Map(
    persistedSchedules.filter((schedule) => schedule.workerId).map((schedule) => [schedule.workerId as string, schedule])
  );
  const consumedWorkerIds = new Set<string>();
  const consumedScheduleIds = new Set<string>();

  const mergedRoster = shiftRoster.map((rosterRow) => {
    const liveWorker =
      workersByRegistration.get(rosterRow.registration.trim()) ?? workersByName.get(normalizeText(rosterRow.name));
    const persistedSchedule =
      (liveWorker ? schedulesByWorkerId.get(liveWorker.id) : undefined) ??
      schedulesByRegistration.get(rosterRow.registration.trim());

    if (liveWorker) {
      consumedWorkerIds.add(liveWorker.id);
    }

    if (persistedSchedule) {
      consumedScheduleIds.add(persistedSchedule.id);
    }

    return createScheduledWorker({ worker: liveWorker, rosterRow, persistedSchedule });
  });

  const persistedOnlyWorkers = persistedSchedules
    .filter((schedule) => !consumedScheduleIds.has(schedule.id))
    .map((schedule) => {
      const liveWorker =
        (schedule.workerId ? workers.find((worker) => worker.id === schedule.workerId) : undefined) ??
        workersByRegistration.get(schedule.registration.trim()) ??
        workersByName.get(normalizeText(schedule.workerName));

      if (liveWorker) {
        consumedWorkerIds.add(liveWorker.id);
      }

      return createScheduledWorker({ worker: liveWorker, persistedSchedule: schedule });
    });

  const unassignedWorkers = workers
    .filter((worker) => !consumedWorkerIds.has(worker.id))
    .map((worker) => {
      const persistedSchedule =
        schedulesByWorkerId.get(worker.id) ?? schedulesByRegistration.get(worker.registration.trim());

      return persistedSchedule
        ? createScheduledWorker({ worker, persistedSchedule })
        : toScheduledWorker(worker);
    });

  return [...mergedRoster, ...persistedOnlyWorkers, ...unassignedWorkers];
}

export function getScaleDescription(scaleCode: ScheduleCode): string {
  switch (scaleCode) {
    case "41":
      return "Trabalho de segunda a sábado, com folga fixa aos domingos.";
    case "42":
      return "Ciclo contínuo de 6 dias trabalhados por 2 dias de folga, distribuído pela ordem informada na planilha.";
    case "43":
      return "Escala diversa com base operacional padrão e possibilidade de ajuste manual de dias e folgas.";
    case "ND":
      return "Sem vínculo de escala na planilha. Use ajustes manuais até definir a regra oficial.";
  }
}

export function getScaleName(scaleCode: ScheduleCode): string {
  return scheduleDefinitions.find((definition) => definition.code === scaleCode)?.name ?? "Sem escala definida";
}

export function getDefaultShiftLabel(scaleCode: ScheduleCode): string {
  return scheduleDefinitions.find((definition) => definition.code === scaleCode)?.defaultShiftLabel ?? "A definir";
}

export function supportsCycleOffset(scaleCode: ScheduleCode): boolean {
  return scheduleDefinitions.find((definition) => definition.code === scaleCode)?.supportsCycleOffset ?? false;
}

export function getScheduleCycleLength(scaleCode: ScheduleCode): number | null {
  switch (scaleCode) {
    case "41":
    case "43":
      return 7;
    case "42":
      return 8;
    case "ND":
      return null;
  }
}

export function getScheduleCyclePosition(date: Date, worker: ScheduledWorker): number | null {
  const cycleLength = getScheduleCycleLength(worker.scaleCode);
  if (!cycleLength) {
    return null;
  }

  switch (worker.scaleCode) {
    case "41":
    case "43": {
      const weekdayIndex = (date.getDay() + 6) % 7;
      return weekdayIndex;
    }
    case "42": {
      const cycleIndex = (differenceInCalendarDays(date, scale42ReferenceDate) + worker.cycleOffset) % cycleLength;
      return cycleIndex < 0 ? cycleIndex + cycleLength : cycleIndex;
    }
    case "ND":
      return null;
  }
}

export function getBaseDayStatus(date: Date, worker: ScheduledWorker): ResolvedScheduleDayStatus {
  switch (worker.scaleCode) {
    case "41":
      return date.getDay() === 0 ? "rest" : "work";
    case "42": {
      const cycleIndex = (differenceInCalendarDays(date, scale42ReferenceDate) + worker.cycleOffset) % 8;
      const normalizedCycleIndex = cycleIndex < 0 ? cycleIndex + 8 : cycleIndex;
      return normalizedCycleIndex >= 6 ? "rest" : "work";
    }
    case "43":
      return date.getDay() === 0 ? "rest" : "work";
    case "ND":
      return "undefined";
  }
}

export function getScheduledWorkerDayStatus(
  date: Date,
  worker: ScheduledWorker,
  overrides: WorkScheduleDayOverride[] = [],
  cycleOverrides: WorkScheduleCycleOverride[] = []
): ResolvedScheduleDayStatus {
  if (worker.scheduleId) {
    const dateKey = format(date, "yyyy-MM-dd");
    const override = overrides.find(
      (item) => item.scheduleId === worker.scheduleId && item.scheduleDate === dateKey
    );

    if (override) {
      return override.dayStatus;
    }

    const cyclePosition = getScheduleCyclePosition(date, worker);
    if (cyclePosition !== null) {
      const cycleOverride = cycleOverrides.find(
        (item) => item.scheduleId === worker.scheduleId && item.cyclePosition === cyclePosition
      );

      if (cycleOverride) {
        return cycleOverride.dayStatus;
      }
    }
  }

  return getBaseDayStatus(date, worker);
}

export function getScaleBadgeColor(scaleCode: ScheduleCode): string {
  switch (scaleCode) {
    case "41":
      return "border-status-info/30 bg-status-info/10 text-status-info";
    case "42":
      return "border-status-warning/30 bg-status-warning/10 text-status-warning";
    case "43":
      return "border-status-danger/30 bg-status-danger/10 text-status-danger";
    case "ND":
      return "border-border bg-muted/40 text-muted-foreground";
  }
}
