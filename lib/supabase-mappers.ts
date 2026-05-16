import type {
  Equipment,
  EquipmentInput,
  EquipmentRow,
  OSHistoryEntry,
  Part,
  ServiceOrder,
  ServiceOrderHistoryRow,
  ServiceOrderInput,
  ServiceOrderPartRow,
  ServiceOrderRow,
  ServiceOrderWorkerRow,
  TimeEntry,
  TimeEntryInput,
  TimeEntryRow,
  AuditLogEntry,
  AuditLogRow,
  User,
  UserInput,
  UserRow,
  WorkerStatus,
  Worker,
  WorkerInput,
  WorkerRow,
  WorkSchedule,
  WorkScheduleCycleOverride,
  WorkScheduleCycleOverrideInput,
  WorkScheduleCycleOverrideRow,
  WorkScheduleDayOverride,
  WorkScheduleDayOverrideInput,
  WorkScheduleDayOverrideRow,
  WorkScheduleInput,
  WorkScheduleRow,
} from "./types";

export type WorkerAvailabilityColumn = "available_hours_per_day" | "hourly_rate";

export function mapEquipmentRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    location: row.location,
    productionLine: row.production_line,
    createdAt: row.created_at,
    maintenanceHistory: [],
  };
}

export function mapWorkerRow(row: WorkerRow): Worker {
  return {
    id: row.id,
    name: row.name,
    registration: row.registration,
    role: row.role,
    shift: row.shift,
    specialty: row.specialty,
    status: row.status,
    availableHoursPerDay: row.available_hours_per_day ?? row.hourly_rate ?? 8,
    createdAt: row.created_at,
    activityHistory: [],
  };
}

export function mapTimeEntryRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    osId: row.service_order_id,
    workerId: row.worker_id,
    activityType: row.activity_type,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    durationMinutes: row.duration_minutes,
    notes: row.notes ?? undefined,
  };
}

export function mapWorkScheduleRow(row: WorkScheduleRow): WorkSchedule {
  return {
    id: row.id,
    workerId: row.worker_id ?? undefined,
    registration: row.registration,
    workerName: row.worker_name,
    scaleCode: row.scale_code,
    scaleName: row.scale_name,
    cycleOffset: row.cycle_offset,
    shiftLabel: row.shift_label,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkScheduleDayOverrideRow(
  row: WorkScheduleDayOverrideRow
): WorkScheduleDayOverride {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    scheduleDate: row.schedule_date,
    dayStatus: row.day_status,
    isOvertime: row.is_overtime ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkScheduleCycleOverrideRow(
  row: WorkScheduleCycleOverrideRow
): WorkScheduleCycleOverride {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    cyclePosition: row.cycle_position,
    dayStatus: row.day_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    workerId: row.worker_id ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function mapPartRow(row: ServiceOrderPartRow): Part {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unitCost: row.unit_cost,
  };
}

export function mapHistoryRow(row: ServiceOrderHistoryRow): OSHistoryEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
  };
}

export function mapAuditLogRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    resource: row.resource,
    resourceId: row.resource_id,
    action: row.action,
    userId: row.user_id ?? undefined,
    userName: row.user_name,
    details: row.details ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export function mapServiceOrderRecord(params: {
  row: ServiceOrderRow;
  assignments: ServiceOrderWorkerRow[];
  parts: ServiceOrderPartRow[];
  history: ServiceOrderHistoryRow[];
  timeEntries: TimeEntryRow[];
}): ServiceOrder {
  const { row, assignments, parts, history, timeEntries } = params;
  const workerIds = Array.from(
    new Set(
      [row.assigned_to, ...assignments.map((assignment) => assignment.worker_id)].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  return {
    id: row.id,
    number: row.number,
    type: row.type,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date ?? undefined,
    equipmentId: row.equipment_id,
    sector: row.sector,
    description: row.description,
    openedAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    workerIds,
    timeEntries: timeEntries.map((entry) => entry.id),
    parts: parts
      .map(mapPartRow)
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    history: history
      .map(mapHistoryRow)
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      ),
    images: [],
  };
}

export function toEquipmentInsert(input: EquipmentInput) {
  return {
    name: input.name,
    code: input.code,
    location: input.location,
    production_line: input.productionLine,
  };
}

export function toWorkerInsert(
  input: WorkerInput,
  availabilityColumn: WorkerAvailabilityColumn = "available_hours_per_day"
) {
  return {
    name: input.name,
    registration: input.registration,
    role: input.role,
    shift: input.shift,
    specialty: input.specialty,
    status: input.status ?? "Disponível",
    [availabilityColumn]: input.availableHoursPerDay,
  };
}

export function toWorkerUpdate(
  input: Partial<WorkerInput> & { status?: WorkerStatus },
  availabilityColumn: WorkerAvailabilityColumn = "available_hours_per_day"
) {
  return {
    name: input.name,
    registration: input.registration,
    role: input.role,
    shift: input.shift,
    specialty: input.specialty,
    status: input.status,
    [availabilityColumn]: input.availableHoursPerDay,
  };
}

export function toUserInsert(input: UserInput) {
  return {
    name: input.name,
    email: input.email,
    password: input.password,
    role: input.role,
    worker_id: input.workerId ?? null,
    active: input.active ?? true,
  };
}

export function toTimeEntryInsert(input: TimeEntryInput) {
  return {
    worker_id: input.workerId,
    service_order_id: input.serviceOrderId,
    activity_type: input.activityType,
    start_time: input.startTime ?? new Date().toISOString(),
    end_time: input.endTime ?? null,
    notes: input.notes ?? null,
  };
}

export function toWorkScheduleInsert(input: WorkScheduleInput) {
  return {
    worker_id: input.workerId ?? null,
    registration: input.registration,
    worker_name: input.workerName,
    scale_code: input.scaleCode,
    scale_name: input.scaleName,
    cycle_offset: input.cycleOffset ?? 0,
    shift_label: input.shiftLabel ?? "",
    notes: input.notes ?? null,
  };
}

export function toWorkScheduleDayOverrideInsert(input: WorkScheduleDayOverrideInput) {
  return {
    schedule_id: input.scheduleId,
    schedule_date: input.scheduleDate,
    day_status: input.dayStatus,
    is_overtime: input.isOvertime ?? false,
  };
}

export function toWorkScheduleCycleOverrideInsert(input: WorkScheduleCycleOverrideInput) {
  return {
    schedule_id: input.scheduleId,
    cycle_position: input.cyclePosition,
    day_status: input.dayStatus,
  };
}

export function normalizeServiceOrderNumber(value: string) {
  const normalized = value.trim().replace(/^OS-\s*/i, "");
  return normalized ? `OS-${normalized}` : "";
}

export function toServiceOrderInsert(input: ServiceOrderInput) {
  return {
    number: normalizeServiceOrderNumber(input.number),
    type: input.type,
    priority: input.priority,
    status: input.status,
    due_date: input.dueDate ?? null,
    description: input.description,
    equipment_id: input.equipmentId,
    assigned_to: input.assignedTo ?? input.workerIds?.[0] ?? null,
    sector: input.sector,
    started_at: input.startedAt ?? null,
    finished_at: input.finishedAt ?? null,
  };
}