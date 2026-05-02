import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variaveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sao obrigatorias.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getWorkerAvailabilityColumn() {
  const { error } = await supabase.from('workers').select('available_hours_per_day').limit(1);
  return error ? 'hourly_rate' : 'available_hours_per_day';
}

const equipments = [
  { id: 'b1a1e1c0-0001-4000-8000-000000000001', name: 'Compressor de Ar #1', code: 'CA-001', location: 'Bloco A', production_line: 'Linha 01', created_at: new Date().toISOString() },
  { id: 'b1a1e1c0-0002-4000-8000-000000000002', name: 'Torno CNC T-200', code: 'TC-200', location: 'Bloco B', production_line: 'Linha 02', created_at: new Date().toISOString() },
  { id: 'b1a1e1c0-0003-4000-8000-000000000003', name: 'Esteira Transportadora', code: 'ET-010', location: 'Bloco A', production_line: 'Linha 01', created_at: new Date().toISOString() },
  { id: 'b1a1e1c0-0004-4000-8000-000000000004', name: 'Prensa Hidraulica PH-50', code: 'PH-050', location: 'Bloco C', production_line: 'Linha 03', created_at: new Date().toISOString() },
  { id: 'b1a1e1c0-0005-4000-8000-000000000005', name: 'Injetora de Plastico IP-800', code: 'IP-800', location: 'Bloco D', production_line: 'Linha 04', created_at: new Date().toISOString() },
];

const workers = [
  { id: 'c2b2e2d0-0001-4000-8000-000000000001', name: 'Carlos Andrade', registration: 'M-1001', role: 'Tecnico Mecanico', shift: 'Manha', specialty: 'Mecanica Industrial', status: 'Em serviço', hourly_rate: 8, created_at: new Date().toISOString() },
  { id: 'c2b2e2d0-0002-4000-8000-000000000002', name: 'Fernanda Lima', registration: 'M-1002', role: 'Tecnica Eletrica', shift: 'Tarde', specialty: 'Eletrotecnica', status: 'Disponível', hourly_rate: 8, created_at: new Date().toISOString() },
  { id: 'c2b2e2d0-0003-4000-8000-000000000003', name: 'Rafael Souza', registration: 'M-1003', role: 'Tecnico de Instrumentacao', shift: 'Manha', specialty: 'Instrumentacao', status: 'Em pausa', hourly_rate: 8, created_at: new Date().toISOString() },
  { id: 'c2b2e2d0-0004-4000-8000-000000000004', name: 'Juliana Costa', registration: 'M-1004', role: 'Mecanica de Precisao', shift: 'Noite', specialty: 'Mecanica de Precisao', status: 'Disponível', hourly_rate: 8, created_at: new Date().toISOString() },
  { id: 'c2b2e2d0-0005-4000-8000-000000000005', name: 'Marcos Pereira', registration: 'M-1005', role: 'Supervisor de Manutencao', shift: 'Manha', specialty: 'Gestao de Manutencao', status: 'Disponível', hourly_rate: 8, created_at: new Date().toISOString() },
];

const serviceOrders = [
  { id: 'd3c3f3e0-0001-4000-8000-000000000001', number: 'OS-0001', type: 'Corretiva', priority: 'Crítica', status: 'Em andamento', description: 'Compressor apresentando ruido excessivo e queda de pressao.', equipment_id: 'b1a1e1c0-0001-4000-8000-000000000001', assigned_to: 'c2b2e2d0-0001-4000-8000-000000000001', sector: 'Producao', created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), finished_at: null },
  { id: 'd3c3f3e0-0002-4000-8000-000000000002', number: 'OS-0002', type: 'Preventiva', priority: 'Média', status: 'Finalizada', description: 'Manutencao preventiva programada - troca de oleo e ajuste de guias.', equipment_id: 'b1a1e1c0-0002-4000-8000-000000000002', assigned_to: 'c2b2e2d0-0002-4000-8000-000000000002', sector: 'Usinagem', created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), started_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(), finished_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
  { id: 'd3c3f3e0-0003-4000-8000-000000000003', number: 'OS-0003', type: 'Corretiva', priority: 'Alta', status: 'Em andamento', description: 'Vazamento de oleo identificado no selo mecanico.', equipment_id: 'b1a1e1c0-0001-4000-8000-000000000001', assigned_to: 'c2b2e2d0-0001-4000-8000-000000000001', sector: 'Producao', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), finished_at: null },
  { id: 'd3c3f3e0-0004-4000-8000-000000000004', number: 'OS-0004', type: 'Preditiva', priority: 'Baixa', status: 'Aberta', description: 'Analise de vibracao - sensor indica anomalia na bomba hidraulica.', equipment_id: 'b1a1e1c0-0004-4000-8000-000000000004', assigned_to: null, sector: 'Prensagem', created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), started_at: null, finished_at: null },
  { id: 'd3c3f3e0-0005-4000-8000-000000000005', number: 'OS-0005', type: 'Preventiva', priority: 'Alta', status: 'Aberta', description: 'Revisao semestral da injetora: troca de resistencias e calibracao.', equipment_id: 'b1a1e1c0-0005-4000-8000-000000000005', assigned_to: null, sector: 'Injecao', created_at: new Date().toISOString(), started_at: null, finished_at: null },
];

const serviceOrderWorkers = [
  { service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', worker_id: 'c2b2e2d0-0001-4000-8000-000000000001' },
  { service_order_id: 'd3c3f3e0-0002-4000-8000-000000000002', worker_id: 'c2b2e2d0-0002-4000-8000-000000000002' },
  { service_order_id: 'd3c3f3e0-0003-4000-8000-000000000003', worker_id: 'c2b2e2d0-0001-4000-8000-000000000001' },
  { service_order_id: 'd3c3f3e0-0003-4000-8000-000000000003', worker_id: 'c2b2e2d0-0003-4000-8000-000000000003' },
];

const serviceOrderParts = [
  { id: '11111111-1111-4111-8111-111111111111', service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', name: 'Filtro de ar', quantity: 1, unit_cost: 85 },
  { id: '22222222-2222-4222-8222-222222222222', service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', name: 'Correia dentada', quantity: 2, unit_cost: 55 },
  { id: '33333333-3333-4333-8333-333333333333', service_order_id: 'd3c3f3e0-0002-4000-8000-000000000002', name: 'Oleo lubrificante 5L', quantity: 2, unit_cost: 120 },
];

const serviceOrderHistory = [
  { id: '44444444-4444-4444-8444-444444444444', service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), field: 'status', old_value: '', new_value: 'Aberta', changed_by: 'Marcos Pereira' },
  { id: '55555555-5555-4555-8555-555555555555', service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), field: 'status', old_value: 'Aberta', new_value: 'Em andamento', changed_by: 'Carlos Andrade' },
];

const timeEntries = [
  { id: 'e4d4a4f0-0001-4000-8000-000000000001', worker_id: 'c2b2e2d0-0001-4000-8000-000000000001', service_order_id: 'd3c3f3e0-0001-4000-8000-000000000001', activity_type: 'Execução', start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), end_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), notes: null },
  { id: 'e4d4a4f0-0002-4000-8000-000000000002', worker_id: 'c2b2e2d0-0002-4000-8000-000000000002', service_order_id: 'd3c3f3e0-0002-4000-8000-000000000002', activity_type: 'Execução', start_time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), end_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), notes: null },
  { id: 'e4d4a4f0-0003-4000-8000-000000000003', worker_id: 'c2b2e2d0-0001-4000-8000-000000000001', service_order_id: 'd3c3f3e0-0003-4000-8000-000000000003', activity_type: 'Setup', start_time: new Date(Date.now() - 90 * 60 * 1000).toISOString(), end_time: null, notes: null },
];

const users = [
  { id: 'f5e5a5f0-0001-4000-8000-000000000001', name: 'Marcos Pereira', email: 'marcos@manutencao.com', password: '123456', role: 'Supervisor', worker_id: 'c2b2e2d0-0005-4000-8000-000000000005', active: true, created_at: new Date().toISOString() },
  { id: 'f5e5a5f0-0002-4000-8000-000000000002', name: 'Administrador', email: 'admin@manutencao.com', password: 'admin123', role: 'Administrador', worker_id: null, active: true, created_at: new Date().toISOString() },
  { id: 'f5e5a5f0-0003-4000-8000-000000000003', name: 'Carlos Andrade', email: 'carlos@manutencao.com', password: '123456', role: 'Manutentor', worker_id: 'c2b2e2d0-0001-4000-8000-000000000001', active: true, created_at: new Date().toISOString() },
  { id: 'f5e5a5f0-0004-4000-8000-000000000004', name: 'Fernanda Lima', email: 'fernanda@manutencao.com', password: '123456', role: 'Manutentor', worker_id: 'c2b2e2d0-0002-4000-8000-000000000002', active: true, created_at: new Date().toISOString() },
  { id: 'f5e5a5f0-0005-4000-8000-000000000005', name: 'Rafael Souza', email: 'rafael@manutencao.com', password: '123456', role: 'Manutentor', worker_id: 'c2b2e2d0-0003-4000-8000-000000000003', active: true, created_at: new Date().toISOString() },
];

async function assert(result, step) {
  if (result.error) {
    throw new Error(`${step}: ${result.error.message}`);
  }
}

async function clearTable(table, column) {
  const result = await supabase.from(table).delete().not(column, 'is', null);
  await assert(result, `Erro ao limpar ${table}`);
}

async function insertMany(table, rows) {
  if (rows.length === 0) return;
  const result = await supabase.from(table).insert(rows);
  await assert(result, `Erro ao inserir em ${table}`);
}

async function countTable(table) {
  const result = await supabase.from(table).select('*', { count: 'exact', head: true });
  await assert(result, `Erro ao contar ${table}`);
  return result.count ?? 0;
}

async function main() {
  const workerAvailabilityColumn = await getWorkerAvailabilityColumn();
  const normalizedWorkers = workers.map(({ hourly_rate, ...worker }) => ({
    ...worker,
    [workerAvailabilityColumn]: hourly_rate,
  }));

  console.log('Limpando tabelas...');
  await clearTable('time_entries', 'id');
  await clearTable('service_order_history', 'id');
  await clearTable('service_order_parts', 'id');
  await clearTable('service_order_workers', 'service_order_id');
  await clearTable('service_orders', 'id');
  await clearTable('users', 'id');
  await clearTable('workers', 'id');
  await clearTable('equipments', 'id');

  console.log('Inserindo seed...');
  await insertMany('equipments', equipments);
  await insertMany('workers', normalizedWorkers);
  await insertMany('service_orders', serviceOrders);
  await insertMany('service_order_workers', serviceOrderWorkers);
  await insertMany('service_order_parts', serviceOrderParts);
  await insertMany('service_order_history', serviceOrderHistory);
  await insertMany('time_entries', timeEntries);
  await insertMany('users', users);

  console.log('Validando contagens...');
  const tables = ['equipments', 'workers', 'service_orders', 'service_order_workers', 'service_order_parts', 'service_order_history', 'time_entries', 'users'];
  for (const table of tables) {
    const count = await countTable(table);
    console.log(`${table}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});