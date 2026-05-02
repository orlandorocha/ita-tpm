alter table if exists public.users
drop constraint if exists users_role_check;

alter table if exists public.users
add constraint users_role_check
check (role in ('Administrador', 'Supervisor', 'Manutentor', 'Operador'));