alter table public.service_orders
  add column if not exists due_date date;

alter table public.service_orders
  drop constraint if exists service_orders_status_check;

alter table public.service_orders
  add constraint service_orders_status_check
  check (status in ('Aberta', 'Em andamento', 'Pausada', 'Atrasada', 'Finalizada'));

create index if not exists idx_service_orders_due_date
  on public.service_orders(due_date);