import { format } from "date-fns";
import type {
  User,
  WorkSchedule,
  WorkScheduleCycleOverride,
  WorkScheduleDayOverride,
  Worker,
} from "@/lib/types";
import { resolveCurrentUserWorkerId } from "@/lib/utils";
import { getScheduledWorkerDayStatus, resolveScheduledWorkers, type ScheduledWorker } from "@/lib/work-schedules";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const BUSINESS_UTC_OFFSET = "-03:00";

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export interface DayOffAlertWorker {
  workerId: string;
  workerName: string;
  registration: string;
  scaleCode: ScheduledWorker["scaleCode"];
  scaleName: string;
  shift: string;
}

export interface AvailableMaintainerAlertWorker {
  workerId: string;
  workerName: string;
  registration: string;
  scaleCode: ScheduledWorker["scaleCode"];
  scaleName: string;
  shift: string;
  status: Worker["status"];
}

export interface OverdueServiceOrderAlert {
  id: string;
  number: string;
  dueDate: string;
  status: string;
  equipmentName: string;
  equipmentCode: string;
  workerNames: string[];
}

function getMaintainerWorkerIds(users: User[], workers: Worker[]) {
  return new Set(
    users
      .filter((user) => user.active && user.role === "Manutentor")
      .map((user) => resolveCurrentUserWorkerId(user, workers))
      .filter((workerId): workerId is string => Boolean(workerId))
  );
}

function getMaintainerNames(users: User[]) {
  return new Set(
    users
      .filter((user) => user.active && user.role === "Manutentor")
      .map((user) => normalizeComparableText(user.name))
      .filter(Boolean)
  );
}

function getScheduledMaintainers(params: {
  workers: Worker[];
  users: User[];
  schedules: WorkSchedule[];
}) {
  const { workers, users, schedules } = params;
  const maintainerWorkerIds = getMaintainerWorkerIds(users, workers);
  const maintainerNames = getMaintainerNames(users);

  const scheduledMaintainers = resolveScheduledWorkers(workers, schedules);

  return scheduledMaintainers.filter((worker) => {
    const matchesWorkerId = Boolean(worker.id && maintainerWorkerIds.has(worker.id));
    const matchesName = maintainerNames.has(normalizeComparableText(worker.name));

    return matchesWorkerId || matchesName;
  });
}

export function getBusinessDateKey(referenceDate = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

export function getBusinessDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00${BUSINESS_UTC_OFFSET}`);
}

export function formatBusinessDate(dateKey: string) {
  return format(getBusinessDateFromKey(dateKey), "dd/MM/yyyy");
}

export function getMaintainersOnDayOff(params: {
  workers: Worker[];
  users: User[];
  schedules: WorkSchedule[];
  overrides: WorkScheduleDayOverride[];
  cycleOverrides: WorkScheduleCycleOverride[];
  date?: Date;
}) {
  const { workers, users, schedules, overrides, cycleOverrides, date = new Date() } = params;
  const scheduledMaintainers = getScheduledMaintainers({ workers, users, schedules });

  return scheduledMaintainers
    .filter(
      (worker) =>
        getScheduledWorkerDayStatus(date, worker, overrides, cycleOverrides) === "rest"
    )
    .map<DayOffAlertWorker>((worker) => ({
      workerId: worker.id as string,
      workerName: worker.name,
      registration: worker.registration,
      scaleCode: worker.scaleCode,
      scaleName: worker.scaleName,
      shift: worker.shift,
    }))
    .sort((left, right) => left.workerName.localeCompare(right.workerName, "pt-BR"));
}

export function getMaintainersAvailableForActivities(params: {
  workers: Worker[];
  users: User[];
  schedules: WorkSchedule[];
  overrides: WorkScheduleDayOverride[];
  cycleOverrides: WorkScheduleCycleOverride[];
  date?: Date;
}) {
  const { workers, users, schedules, overrides, cycleOverrides, date = new Date() } = params;
  const scheduledMaintainers = getScheduledMaintainers({ workers, users, schedules });

  return scheduledMaintainers
    .filter(
      (worker) =>
        getScheduledWorkerDayStatus(date, worker, overrides, cycleOverrides) === "work" &&
        worker.status === "Disponível"
    )
    .map<AvailableMaintainerAlertWorker>((worker) => ({
      workerId: worker.id as string,
      workerName: worker.name,
      registration: worker.registration,
      scaleCode: worker.scaleCode,
      scaleName: worker.scaleName,
      shift: worker.shift,
      status: worker.status,
    }))
    .sort((left, right) => left.workerName.localeCompare(right.workerName, "pt-BR"));
}

export function buildTeamsDayOffMessage(dayOffWorkers: DayOffAlertWorker[], dateKey: string) {
  const lines = dayOffWorkers.map(
    (worker) =>
      `- ${worker.workerName} (matrícula ${worker.registration}) | Escala ${worker.scaleCode} - ${worker.scaleName} | Turno ${worker.shift}`
  );

  return [
    `Alerta de folga do dia ${formatBusinessDate(dateKey)}`,
    "",
    "Manutentores com perfil Manutentor no sistema que estão de folga hoje:",
    ...(lines.length > 0 ? lines : ["- Nenhum manutentor identificado em folga para hoje."]),
  ].join("\n");
}

export function buildTeamsAvailableMaintainersMessage(
  availableWorkers: AvailableMaintainerAlertWorker[],
  dateKey: string
) {
  const lines = availableWorkers.map(
    (worker) =>
      `- ${worker.workerName} (matrícula ${worker.registration}) | Escala ${worker.scaleCode} - ${worker.scaleName} | Turno ${worker.shift} | Status ${worker.status}`
  );

  return [
    `Disponibilidade para atividades do dia ${formatBusinessDate(dateKey)}`,
    "",
    "Manutentores com perfil Manutentor no sistema disponíveis para atividades hoje:",
    ...(lines.length > 0 ? lines : ["- Nenhum manutentor disponível para atividades foi identificado hoje."]),
  ].join("\n");
}

export function buildTeamsOverdueServiceOrdersMessage(
  overdueOrders: OverdueServiceOrderAlert[],
  dateKey: string
) {
  const lines = overdueOrders.map(
    (order) =>
      `- ${order.number} | Prazo ${formatBusinessDate(order.dueDate)} | Status ${order.status} | Equipamento ${order.equipmentName} (${order.equipmentCode}) | Técnicos ${order.workerNames.length > 0 ? order.workerNames.join(", ") : "Sem vínculo"}`
  );

  return [
    `Ordens de serviço atrasadas em ${formatBusinessDate(dateKey)}`,
    "",
    "OS com prazo vencido e ainda não finalizadas:",
    ...(lines.length > 0 ? lines : ["- Nenhuma OS atrasada identificada hoje."]),
  ].join("\n");
}

