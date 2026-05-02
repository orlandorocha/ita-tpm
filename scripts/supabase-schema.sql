create extension if not exists pgcrypto;

create table if not exists public.equipments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  location text not null,
  production_line text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration text not null unique,
  role text not null,
  shift text not null,
  specialty text not null,
  status text not null check (status in ('Disponível', 'Em serviço', 'Em pausa')),
  available_hours_per_day numeric(10,2) not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('Administrador', 'Supervisor', 'Manutentor', 'Operador')),
  worker_id uuid references public.workers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null check (type in ('Corretiva', 'Preventiva', 'Preditiva', 'Opa', 'Guemba')),
  priority text not null check (priority in ('Baixa', 'Média', 'Alta', 'Crítica')),
  status text not null check (status in ('Aberta', 'Em andamento', 'Pausada', 'Atrasada', 'Finalizada')),
  due_date date,
  description text not null,
  equipment_id uuid not null references public.equipments(id) on delete restrict,
  assigned_to uuid references public.workers(id) on delete set null,
  sector text not null default '',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.service_order_workers (
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_order_id, worker_id)
);

create table if not exists public.service_order_parts (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_order_history (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  timestamp timestamptz not null default now(),
  field text not null,
  old_value text not null default '',
  new_value text not null default '',
  changed_by text not null default 'Sistema'
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  activity_type text not null check (activity_type in ('Execução', 'Espera', 'Deslocamento', 'Setup')),
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer generated always as (
    case
      when end_time is null then null
      else greatest(0, floor(extract(epoch from (end_time - start_time)) / 60))::integer
    end
  ) stored,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_schedules (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.workers(id) on delete set null,
  registration text not null unique,
  worker_name text not null,
  scale_code text not null check (scale_code in ('41', '42', '43', 'ND')),
  scale_name text not null,
  cycle_offset integer not null default 0,
  shift_label text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_schedule_day_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.worker_schedules(id) on delete cascade,
  schedule_date date not null,
  day_status text not null check (day_status in ('work', 'rest')),
  is_overtime boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, schedule_date)
);

create table if not exists public.worker_schedule_cycle_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.worker_schedules(id) on delete cascade,
  cycle_position integer not null check (cycle_position >= 0),
  day_status text not null check (day_status in ('work', 'rest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, cycle_position)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_worker_schedules_updated_at on public.worker_schedules;
create trigger trg_worker_schedules_updated_at
before update on public.worker_schedules
for each row execute function public.set_updated_at();

drop trigger if exists trg_worker_schedule_day_overrides_updated_at on public.worker_schedule_day_overrides;
create trigger trg_worker_schedule_day_overrides_updated_at
before update on public.worker_schedule_day_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_worker_schedule_cycle_overrides_updated_at on public.worker_schedule_cycle_overrides;
create trigger trg_worker_schedule_cycle_overrides_updated_at
before update on public.worker_schedule_cycle_overrides
for each row execute function public.set_updated_at();

create index if not exists idx_service_orders_equipment on public.service_orders(equipment_id);
create index if not exists idx_service_orders_assigned_to on public.service_orders(assigned_to);
create index if not exists idx_service_orders_due_date on public.service_orders(due_date);
create index if not exists idx_time_entries_worker on public.time_entries(worker_id);
create index if not exists idx_time_entries_service_order on public.time_entries(service_order_id);
create index if not exists idx_service_order_history_service_order on public.service_order_history(service_order_id);
create index if not exists idx_service_order_parts_service_order on public.service_order_parts(service_order_id);
create index if not exists idx_worker_schedules_worker_id on public.worker_schedules(worker_id);
create index if not exists idx_worker_schedules_scale_code on public.worker_schedules(scale_code);
create index if not exists idx_worker_schedule_day_overrides_schedule_id on public.worker_schedule_day_overrides(schedule_id);
create index if not exists idx_worker_schedule_day_overrides_schedule_date on public.worker_schedule_day_overrides(schedule_date);
create index if not exists idx_worker_schedule_cycle_overrides_schedule_id on public.worker_schedule_cycle_overrides(schedule_id);
create index if not exists idx_worker_schedule_cycle_overrides_position on public.worker_schedule_cycle_overrides(cycle_position);
