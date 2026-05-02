// ─── Enums ────────────────────────────────────────────────────────────────────

export const OS_TYPES = ["Corretiva", "Preventiva", "Preditiva", "Opa", "Guemba"] as const;
export type OSType = (typeof OS_TYPES)[number];
export type OSPriority = "Baixa" | "Média" | "Alta" | "Crítica";
export type OSStatus = "Aberta" | "Em andamento" | "Pausada" | "Atrasada" | "Finalizada";

export type ActivityType = "Execução" | "Espera" | "Deslocamento" | "Setup";
export type WorkerStatus = "Disponível" | "Em serviço" | "Em pausa";
export type UserRole = "Administrador" | "Supervisor" | "Manutentor" | "Operador";
export type ScheduleCode = "41" | "42" | "43" | "ND";
export type ScheduleDayStatus = "work" | "rest";

// ─── Domain Entities ──────────────────────────────────────────────────────────

export interface Equipment {
  id: string;
  name: string;
  code: string;
  location: string;
  productionLine: string;
  createdAt?: string;
  maintenanceHistory: string[];
}

export interface Worker {
  id: string;
  name: string;
  registration: string;
  role: string;
  shift: string;
  specialty: string;
  status: WorkerStatus;
  availableHoursPerDay: number;
  createdAt?: string;
  activityHistory: string[];
}

export interface TimeEntry {
  id: string;
  osId: string;
  workerId: string;
  activityType: ActivityType;
  startTime: string;
  endTime?: string;
  durationMinutes?: number | null;
  notes?: string;
}

export interface WorkSchedule {
  id: string;
  workerId?: string;
  registration: string;
  workerName: string;
  scaleCode: ScheduleCode;
  scaleName: string;
  cycleOffset: number;
  shiftLabel: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkScheduleDayOverride {
  id: string;
  scheduleId: string;
  scheduleDate: string;
  dayStatus: ScheduleDayStatus;
  isOvertime: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkScheduleCycleOverride {
  id: string;
  scheduleId: string;
  cyclePosition: number;
  dayStatus: ScheduleDayStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Part {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface OSHistoryEntry {
  id: string;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
}

export interface ServiceOrder {
  id: string;
  number: string;
  type: OSType;
  priority: OSPriority;
  status: OSStatus;
  dueDate?: string;
  equipmentId: string;
  sector: string;
  description: string;
  openedAt: string;
  startedAt?: string;
  finishedAt?: string;
  assignedTo?: string;
  workerIds: string[];
  timeEntries: string[];
  parts: Part[];
  history: OSHistoryEntry[];
  images: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  workerId?: string;
  active: boolean;
  createdAt: string;
}

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
}

// ─── Supabase Rows ────────────────────────────────────────────────────────────

export interface EquipmentRow {
  id: string;
  name: string;
  code: string;
  location: string;
  production_line: string;
  created_at: string;
}

export interface WorkerRow {
  id: string;
  name: string;
  registration: string;
  role: string;
  shift: string;
  specialty: string;
  status: WorkerStatus;
  available_hours_per_day?: number;
  hourly_rate?: number;
  created_at: string;
}

export interface ServiceOrderRow {
  id: string;
  number: string;
  type: OSType;
  priority: OSPriority;
  status: OSStatus;
  due_date: string | null;
  description: string;
  equipment_id: string;
  assigned_to: string | null;
  sector: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ServiceOrderWorkerRow {
  service_order_id: string;
  worker_id: string;
  created_at: string;
}

export interface ServiceOrderPartRow {
  id: string;
  service_order_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface ServiceOrderHistoryRow {
  id: string;
  service_order_id: string;
  timestamp: string;
  field: string;
  old_value: string;
  new_value: string;
  changed_by: string;
}

export interface TimeEntryRow {
  id: string;
  worker_id: string;
  service_order_id: string;
  activity_type: ActivityType;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  worker_id: string | null;
  active: boolean;
  created_at: string;
}

export interface WorkScheduleRow {
  id: string;
  worker_id: string | null;
  registration: string;
  worker_name: string;
  scale_code: ScheduleCode;
  scale_name: string;
  cycle_offset: number;
  shift_label: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkScheduleDayOverrideRow {
  id: string;
  schedule_id: string;
  schedule_date: string;
  day_status: ScheduleDayStatus;
  is_overtime?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkScheduleCycleOverrideRow {
  id: string;
  schedule_id: string;
  cycle_position: number;
  day_status: ScheduleDayStatus;
  created_at: string;
  updated_at: string;
}

// ─── Mutation Inputs ─────────────────────────────────────────────────────────

export interface EquipmentInput {
  name: string;
  code: string;
  location: string;
  productionLine: string;
}

export interface WorkerInput {
  name: string;
  registration: string;
  role: string;
  shift: string;
  specialty: string;
  status?: WorkerStatus;
  availableHoursPerDay: number;
}

export interface UserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  workerId?: string;
  active?: boolean;
}

export interface TimeEntryInput {
  workerId: string;
  serviceOrderId: string;
  activityType: ActivityType;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number | null;
  notes?: string;
}

export interface ServiceOrderInput {
  number: string;
  type: OSType;
  priority: OSPriority;
  status: OSStatus;
  dueDate?: string;
  description: string;
  equipmentId: string;
  sector: string;
  assignedTo?: string;
  startedAt?: string;
  finishedAt?: string;
  workerIds?: string[];
}

export interface WorkScheduleInput {
  workerId?: string;
  registration: string;
  workerName: string;
  scaleCode: ScheduleCode;
  scaleName: string;
  cycleOffset?: number;
  shiftLabel?: string;
  notes?: string;
}

export interface WorkScheduleDayOverrideInput {
  scheduleId: string;
  scheduleDate: string;
  dayStatus: ScheduleDayStatus;
  isOvertime?: boolean;
}

export interface WorkScheduleCycleOverrideInput {
  scheduleId: string;
  cyclePosition: number;
  dayStatus: ScheduleDayStatus;
}

type SupabaseTable<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// ─── Database Shape ──────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      equipments: SupabaseTable<
        EquipmentRow,
        Omit<EquipmentRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Omit<EquipmentRow, "id">>
      >;
      workers: SupabaseTable<
        WorkerRow,
        Omit<WorkerRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Omit<WorkerRow, "id">>
      >;
      service_orders: SupabaseTable<
        ServiceOrderRow,
        Omit<ServiceOrderRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Omit<ServiceOrderRow, "id">>
      >;
      service_order_workers: SupabaseTable<
        ServiceOrderWorkerRow,
        Omit<ServiceOrderWorkerRow, "created_at"> & { created_at?: string },
        Partial<ServiceOrderWorkerRow>
      >;
      service_order_parts: SupabaseTable<
        ServiceOrderPartRow,
        Omit<ServiceOrderPartRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Omit<ServiceOrderPartRow, "id" | "service_order_id">>
      >;
      service_order_history: SupabaseTable<
        ServiceOrderHistoryRow,
        Omit<ServiceOrderHistoryRow, "id"> & { id?: string },
        Partial<Omit<ServiceOrderHistoryRow, "id" | "service_order_id">>
      >;
      time_entries: SupabaseTable<
        TimeEntryRow,
        Omit<TimeEntryRow, "id" | "created_at" | "duration_minutes"> & { id?: string; created_at?: string },
        Partial<Omit<TimeEntryRow, "id" | "worker_id" | "service_order_id" | "duration_minutes">>
      >;
      worker_schedules: SupabaseTable<
        WorkScheduleRow,
        Omit<WorkScheduleRow, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
        Partial<Omit<WorkScheduleRow, "id" | "created_at" | "updated_at">>
      >;
      worker_schedule_day_overrides: SupabaseTable<
        WorkScheduleDayOverrideRow,
        Omit<WorkScheduleDayOverrideRow, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
        Partial<Omit<WorkScheduleDayOverrideRow, "id" | "created_at" | "updated_at">>
      >;
      worker_schedule_cycle_overrides: SupabaseTable<
        WorkScheduleCycleOverrideRow,
        Omit<WorkScheduleCycleOverrideRow, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
        Partial<Omit<WorkScheduleCycleOverrideRow, "id" | "created_at" | "updated_at">>
      >;
      users: SupabaseTable<
        UserRow,
        Omit<UserRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Omit<UserRow, "id">>
      >;
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

// ─── Legacy Store Shape ──────────────────────────────────────────────────────

export interface AppStore {
  serviceOrders: ServiceOrder[];
  workers: Worker[];
  equipment: Equipment[];
  timeEntries: TimeEntry[];
  currentUser: User | null;
  users: User[];
  isAuthenticated: boolean;
}
