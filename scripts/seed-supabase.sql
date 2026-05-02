delete from public.time_entries;
delete from public.service_order_history;
delete from public.service_order_parts;
delete from public.service_order_workers;
delete from public.service_orders;
delete from public.users;
delete from public.workers;
delete from public.equipments;

insert into public.equipments (id, name, code, location, production_line, created_at) values
  ('b1a1e1c0-0001-4000-8000-000000000001', 'Compressor de Ar #1', 'CA-001', 'Bloco A', 'Linha 01', now()),
  ('b1a1e1c0-0002-4000-8000-000000000002', 'Torno CNC T-200', 'TC-200', 'Bloco B', 'Linha 02', now()),
  ('b1a1e1c0-0003-4000-8000-000000000003', 'Esteira Transportadora', 'ET-010', 'Bloco A', 'Linha 01', now()),
  ('b1a1e1c0-0004-4000-8000-000000000004', 'Prensa Hidráulica PH-50', 'PH-050', 'Bloco C', 'Linha 03', now()),
  ('b1a1e1c0-0005-4000-8000-000000000005', 'Injetora de Plástico IP-800', 'IP-800', 'Bloco D', 'Linha 04', now());

insert into public.workers (id, name, registration, role, shift, specialty, status, available_hours_per_day, created_at) values
  ('c2b2e2d0-0001-4000-8000-000000000001', 'Carlos Andrade', 'M-1001', 'Técnico Mecânico', 'Manhã', 'Mecânica Industrial', 'Em serviço', 8, now()),
  ('c2b2e2d0-0002-4000-8000-000000000002', 'Fernanda Lima', 'M-1002', 'Técnica Elétrica', 'Tarde', 'Eletrotécnica', 'Disponível', 8, now()),
  ('c2b2e2d0-0003-4000-8000-000000000003', 'Rafael Souza', 'M-1003', 'Técnico de Instrumentação', 'Manhã', 'Instrumentação', 'Em pausa', 8, now()),
  ('c2b2e2d0-0004-4000-8000-000000000004', 'Juliana Costa', 'M-1004', 'Mecânica de Precisão', 'Noite', 'Mecânica de Precisão', 'Disponível', 8, now()),
  ('c2b2e2d0-0005-4000-8000-000000000005', 'Marcos Pereira', 'M-1005', 'Supervisor de Manutenção', 'Manhã', 'Gestão de Manutenção', 'Disponível', 8, now());

insert into public.service_orders (id, number, type, priority, status, description, equipment_id, assigned_to, sector, created_at, started_at, finished_at) values
  ('d3c3f3e0-0001-4000-8000-000000000001', 'OS-0001', 'Corretiva', 'Crítica', 'Em andamento', 'Compressor apresentando ruído excessivo e queda de pressão.', 'b1a1e1c0-0001-4000-8000-000000000001', 'c2b2e2d0-0001-4000-8000-000000000001', 'Produção', now() - interval '4 hours', now() - interval '3 hours', null),
  ('d3c3f3e0-0002-4000-8000-000000000002', 'OS-0002', 'Preventiva', 'Média', 'Finalizada', 'Manutenção preventiva programada — troca de óleo e ajuste de guias.', 'b1a1e1c0-0002-4000-8000-000000000002', 'c2b2e2d0-0002-4000-8000-000000000002', 'Usinagem', now() - interval '24 hours', now() - interval '22 hours', now() - interval '18 hours'),
  ('d3c3f3e0-0003-4000-8000-000000000003', 'OS-0003', 'Corretiva', 'Alta', 'Em andamento', 'Vazamento de óleo identificado no selo mecânico.', 'b1a1e1c0-0001-4000-8000-000000000001', 'c2b2e2d0-0001-4000-8000-000000000001', 'Produção', now() - interval '2 hours', now() - interval '90 minutes', null),
  ('d3c3f3e0-0004-4000-8000-000000000004', 'OS-0004', 'Preditiva', 'Baixa', 'Aberta', 'Análise de vibração — sensor indica anomalia na bomba hidráulica.', 'b1a1e1c0-0004-4000-8000-000000000004', null, 'Prensagem', now() - interval '30 minutes', null, null),
  ('d3c3f3e0-0005-4000-8000-000000000005', 'OS-0005', 'Preventiva', 'Alta', 'Aberta', 'Revisão semestral da injetora: troca de resistências e calibração.', 'b1a1e1c0-0005-4000-8000-000000000005', null, 'Injeção', now(), null, null);

insert into public.service_order_workers (service_order_id, worker_id) values
  ('d3c3f3e0-0001-4000-8000-000000000001', 'c2b2e2d0-0001-4000-8000-000000000001'),
  ('d3c3f3e0-0002-4000-8000-000000000002', 'c2b2e2d0-0002-4000-8000-000000000002'),
  ('d3c3f3e0-0003-4000-8000-000000000003', 'c2b2e2d0-0001-4000-8000-000000000001'),
  ('d3c3f3e0-0003-4000-8000-000000000003', 'c2b2e2d0-0003-4000-8000-000000000003');

insert into public.service_order_parts (id, service_order_id, name, quantity, unit_cost) values
  ('11111111-1111-4111-8111-111111111111', 'd3c3f3e0-0001-4000-8000-000000000001', 'Filtro de ar', 1, 85),
  ('22222222-2222-4222-8222-222222222222', 'd3c3f3e0-0001-4000-8000-000000000001', 'Correia dentada', 2, 55),
  ('33333333-3333-4333-8333-333333333333', 'd3c3f3e0-0002-4000-8000-000000000002', 'Óleo lubrificante 5L', 2, 120);

insert into public.service_order_history (id, service_order_id, timestamp, field, old_value, new_value, changed_by) values
  ('44444444-4444-4444-8444-444444444444', 'd3c3f3e0-0001-4000-8000-000000000001', now() - interval '4 hours', 'status', '', 'Aberta', 'Marcos Pereira'),
  ('55555555-5555-4555-8555-555555555555', 'd3c3f3e0-0001-4000-8000-000000000001', now() - interval '3 hours', 'status', 'Aberta', 'Em andamento', 'Carlos Andrade');

insert into public.time_entries (id, worker_id, service_order_id, activity_type, start_time, end_time, notes) values
  ('e4d4a4f0-0001-4000-8000-000000000001', 'c2b2e2d0-0001-4000-8000-000000000001', 'd3c3f3e0-0001-4000-8000-000000000001', 'Execução', now() - interval '3 hours', now() - interval '1 hour', null),
  ('e4d4a4f0-0002-4000-8000-000000000002', 'c2b2e2d0-0002-4000-8000-000000000002', 'd3c3f3e0-0002-4000-8000-000000000002', 'Execução', now() - interval '5 hours', now() - interval '2 hours', null),
  ('e4d4a4f0-0003-4000-8000-000000000003', 'c2b2e2d0-0001-4000-8000-000000000001', 'd3c3f3e0-0003-4000-8000-000000000003', 'Setup', now() - interval '90 minutes', null, null);

insert into public.users (id, name, email, password, role, worker_id, active, created_at) values
  ('f5e5a5f0-0001-4000-8000-000000000001', 'Marcos Pereira', 'marcos@manutencao.com', '123456', 'Supervisor', 'c2b2e2d0-0005-4000-8000-000000000005', true, now()),
  ('f5e5a5f0-0002-4000-8000-000000000002', 'Administrador', 'admin@manutencao.com', 'admin123', 'Administrador', null, true, now()),
  ('f5e5a5f0-0003-4000-8000-000000000003', 'Carlos Andrade', 'carlos@manutencao.com', '123456', 'Manutentor', 'c2b2e2d0-0001-4000-8000-000000000001', true, now()),
  ('f5e5a5f0-0004-4000-8000-000000000004', 'Fernanda Lima', 'fernanda@manutencao.com', '123456', 'Manutentor', 'c2b2e2d0-0002-4000-8000-000000000002', true, now()),
  ('f5e5a5f0-0005-4000-8000-000000000005', 'Rafael Souza', 'rafael@manutencao.com', '123456', 'Manutentor', 'c2b2e2d0-0003-4000-8000-000000000003', true, now());
