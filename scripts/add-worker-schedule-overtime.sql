alter table public.worker_schedule_day_overrides
add column if not exists is_overtime boolean not null default false;