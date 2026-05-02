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

drop trigger if exists trg_worker_schedule_cycle_overrides_updated_at on public.worker_schedule_cycle_overrides;
create trigger trg_worker_schedule_cycle_overrides_updated_at
before update on public.worker_schedule_cycle_overrides
for each row execute function public.set_updated_at();

create index if not exists idx_worker_schedule_cycle_overrides_schedule_id
on public.worker_schedule_cycle_overrides(schedule_id);

create index if not exists idx_worker_schedule_cycle_overrides_position
on public.worker_schedule_cycle_overrides(cycle_position);