alter table public.workers
  rename column hourly_rate to available_hours_per_day;

update public.workers
set available_hours_per_day = 8;

alter table public.workers
  alter column available_hours_per_day set default 8;

comment on column public.workers.available_hours_per_day is 'Horas disponiveis por dia do manutentor.';