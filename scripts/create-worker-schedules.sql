create extension if not exists pgcrypto;

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

create index if not exists idx_worker_schedules_worker_id on public.worker_schedules(worker_id);
create index if not exists idx_worker_schedules_scale_code on public.worker_schedules(scale_code);
create index if not exists idx_worker_schedule_day_overrides_schedule_id on public.worker_schedule_day_overrides(schedule_id);
create index if not exists idx_worker_schedule_day_overrides_schedule_date on public.worker_schedule_day_overrides(schedule_date);
create index if not exists idx_worker_schedule_cycle_overrides_schedule_id on public.worker_schedule_cycle_overrides(schedule_id);
create index if not exists idx_worker_schedule_cycle_overrides_position on public.worker_schedule_cycle_overrides(cycle_position);

insert into public.worker_schedules (
  worker_id,
  registration,
  worker_name,
  scale_code,
  scale_name,
  cycle_offset,
  shift_label,
  notes
)
select
  workers.id,
  roster.registration,
  roster.worker_name,
  roster.scale_code,
  roster.scale_name,
  roster.cycle_offset,
  roster.shift_label,
  roster.notes
from (
  values
    ('40103547', 'EVERALDO FIGUEREDO DE BRITO', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('40102533', 'LUCIANO FERREIRA DA SILVA', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('40103768', 'ISRAEL CARLOS DINIZ', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('81118433', 'RAMON ROQUE ESTEVES', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('81233339', 'LEONARDO DOS SANTOS', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('40103324', 'JOAQUIM GOMES SANTIAGO', '42', '220 Hrs Mensais - 6 X 2', 0, '6x2', null),
    ('40103728', 'ADEMAR DA SILVA', '42', '220 Hrs Mensais - 6 X 2', 1, '6x2', null),
    ('40102561', 'SIDNEY FLAVIO CARTOLARI', '42', '220 Hrs Mensais - 6 X 2', 2, '6x2', null),
    ('80022051', 'THIAGO ROBERTO COELHO TURTERO', '42', '220 Hrs Mensais - 6 X 2', 3, '6x2', null),
    ('40103739', 'JOSENILDO ALMEIDA', '42', '220 Hrs Mensais - 6 X 2', 4, '6x2', null),
    ('80264570', 'RAFAEL ALVES DOS SANTOS SOUZA', '42', '220 Hrs Mensais - 6 X 2', 5, '6x2', null),
    ('80186744', 'MARCELO BARBOSA', '42', '220 Hrs Mensais - 6 X 2', 6, '6x2', null),
    ('81011558', 'JOSE MIGUEL RICIERI', '42', '220 Hrs Mensais - 6 X 2', 7, '6x2', null),
    ('40103741', 'EDNEY BEZERRA DE ANDRADE', '43', '220 Hrs Mensais - Diversas', 0, 'Diversa', null),
    ('40102540', 'FRANCISCO ALVES DA SILVA NETO', '43', '220 Hrs Mensais - Diversas', 0, 'Diversa', null),
    ('81041741', 'MARCOS SOUZA', '42', '220 Hrs Mensais - 6 X 2', 0, '6x2', null),
    ('40103733', 'FRANCISCO DE ASSIS SOUSA LEAL', '42', '220 Hrs Mensais - 6 X 2', 1, '6x2', null),
    ('80327968', 'FABIO SZMYHIEL FERREIRA', '42', '220 Hrs Mensais - 6 X 2', 2, '6x2', null),
    ('40101891', 'MAICON DE BARROS CARVALHO', '42', '220 Hrs Mensais - 6 X 2', 3, '6x2', null),
    ('80332061', 'MARCIO RUFINO', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('40103746', 'RONALDO LUIZ GALDINO DA SILVA', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null),
    ('40103140', 'ANTONIO CARVALHO DOS SANTOS', '41', '220 - Hrs Mensais Seg a Sab', 0, 'Seg a Sáb', null)
) as roster(registration, worker_name, scale_code, scale_name, cycle_offset, shift_label, notes)
left join public.workers on workers.registration = roster.registration
on conflict (registration) do update
set
  worker_id = excluded.worker_id,
  worker_name = excluded.worker_name,
  scale_code = excluded.scale_code,
  scale_name = excluded.scale_name,
  cycle_offset = excluded.cycle_offset,
  shift_label = excluded.shift_label,
  notes = excluded.notes,
  updated_at = now();