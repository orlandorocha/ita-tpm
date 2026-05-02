alter table public.service_orders
  drop constraint if exists service_orders_type_check;

alter table public.service_orders
  add constraint service_orders_type_check
  check (type in ('Corretiva', 'Preventiva', 'Preditiva', 'Opa', 'Guemba'));