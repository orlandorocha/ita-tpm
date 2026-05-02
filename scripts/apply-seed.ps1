$envFile = Join-Path $PSScriptRoot '..\.env.local'

if (-not (Test-Path $envFile)) {
  throw 'Arquivo .env.local nao encontrado.'
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
  }
}

$baseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$apiKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY

if (-not $baseUrl -or -not $apiKey) {
  throw 'Variaveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sao obrigatorias.'
}

$headers = @{
  apikey        = $apiKey
  Authorization = "Bearer $apiKey"
  Prefer        = 'return=minimal'
  'Content-Type' = 'application/json'
}

function Invoke-SupabaseDelete {
  param(
    [string]$Table,
    [string]$Filter
  )

  $uri = "$baseUrl/rest/v1/$Table?$Filter"
  Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers | Out-Null
}

function Invoke-SupabaseInsert {
  param(
    [string]$Table,
    [object[]]$Rows
  )

  if ($Rows.Count -eq 0) {
    return
  }

  $uri = "$baseUrl/rest/v1/$Table"
  $json = $Rows | ConvertTo-Json -Depth 10 -Compress
  Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $json | Out-Null
}

function Get-SupabaseCount {
  param([string]$Table)

  $uri = "$baseUrl/rest/v1/$Table?select=*"
  $result = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
  if ($null -eq $result) { return 0 }
  if ($result -is [array]) { return $result.Count }
  return 1
}

function Get-WorkerAvailabilityColumn {
  try {
    $uri = "$baseUrl/rest/v1/workers?select=available_hours_per_day&limit=1"
    Invoke-RestMethod -Uri $uri -Method Get -Headers $headers | Out-Null
    return 'available_hours_per_day'
  }
  catch {
    return 'hourly_rate'
  }
}

$now = Get-Date

$equipments = @(
  @{ id = 'b1a1e1c0-0001-4000-8000-000000000001'; name = 'Compressor de Ar #1'; code = 'CA-001'; location = 'Bloco A'; production_line = 'Linha 01'; created_at = $now.ToString('o') },
  @{ id = 'b1a1e1c0-0002-4000-8000-000000000002'; name = 'Torno CNC T-200'; code = 'TC-200'; location = 'Bloco B'; production_line = 'Linha 02'; created_at = $now.ToString('o') },
  @{ id = 'b1a1e1c0-0003-4000-8000-000000000003'; name = 'Esteira Transportadora'; code = 'ET-010'; location = 'Bloco A'; production_line = 'Linha 01'; created_at = $now.ToString('o') },
  @{ id = 'b1a1e1c0-0004-4000-8000-000000000004'; name = 'Prensa Hidráulica PH-50'; code = 'PH-050'; location = 'Bloco C'; production_line = 'Linha 03'; created_at = $now.ToString('o') },
  @{ id = 'b1a1e1c0-0005-4000-8000-000000000005'; name = 'Injetora de Plástico IP-800'; code = 'IP-800'; location = 'Bloco D'; production_line = 'Linha 04'; created_at = $now.ToString('o') }
)

$workers = @(
  @{ id = 'c2b2e2d0-0001-4000-8000-000000000001'; name = 'Carlos Andrade'; registration = 'M-1001'; role = 'Técnico Mecânico'; shift = 'Manhã'; specialty = 'Mecânica Industrial'; status = 'Em serviço'; hourly_rate = 8; created_at = $now.ToString('o') },
  @{ id = 'c2b2e2d0-0002-4000-8000-000000000002'; name = 'Fernanda Lima'; registration = 'M-1002'; role = 'Técnica Elétrica'; shift = 'Tarde'; specialty = 'Eletrotécnica'; status = 'Disponível'; hourly_rate = 8; created_at = $now.ToString('o') },
  @{ id = 'c2b2e2d0-0003-4000-8000-000000000003'; name = 'Rafael Souza'; registration = 'M-1003'; role = 'Técnico de Instrumentação'; shift = 'Manhã'; specialty = 'Instrumentação'; status = 'Em pausa'; hourly_rate = 8; created_at = $now.ToString('o') },
  @{ id = 'c2b2e2d0-0004-4000-8000-000000000004'; name = 'Juliana Costa'; registration = 'M-1004'; role = 'Mecânica de Precisão'; shift = 'Noite'; specialty = 'Mecânica de Precisão'; status = 'Disponível'; hourly_rate = 8; created_at = $now.ToString('o') },
  @{ id = 'c2b2e2d0-0005-4000-8000-000000000005'; name = 'Marcos Pereira'; registration = 'M-1005'; role = 'Supervisor de Manutenção'; shift = 'Manhã'; specialty = 'Gestão de Manutenção'; status = 'Disponível'; hourly_rate = 8; created_at = $now.ToString('o') }
)

$workerAvailabilityColumn = Get-WorkerAvailabilityColumn
$workers = $workers | ForEach-Object {
  $normalizedWorker = @{}
  foreach ($key in $_.Keys) {
    if ($key -ne 'hourly_rate') {
      $normalizedWorker[$key] = $_[$key]
    }
  }
  $normalizedWorker[$workerAvailabilityColumn] = $_.hourly_rate
  $normalizedWorker
}

$serviceOrders = @(
  @{ id = 'd3c3f3e0-0001-4000-8000-000000000001'; number = 'OS-0001'; type = 'Corretiva'; priority = 'Crítica'; status = 'Em andamento'; description = 'Compressor apresentando ruído excessivo e queda de pressão.'; equipment_id = 'b1a1e1c0-0001-4000-8000-000000000001'; assigned_to = 'c2b2e2d0-0001-4000-8000-000000000001'; sector = 'Produção'; created_at = $now.AddHours(-4).ToString('o'); started_at = $now.AddHours(-3).ToString('o'); finished_at = $null },
  @{ id = 'd3c3f3e0-0002-4000-8000-000000000002'; number = 'OS-0002'; type = 'Preventiva'; priority = 'Média'; status = 'Finalizada'; description = 'Manutenção preventiva programada - troca de óleo e ajuste de guias.'; equipment_id = 'b1a1e1c0-0002-4000-8000-000000000002'; assigned_to = 'c2b2e2d0-0002-4000-8000-000000000002'; sector = 'Usinagem'; created_at = $now.AddHours(-24).ToString('o'); started_at = $now.AddHours(-22).ToString('o'); finished_at = $now.AddHours(-18).ToString('o') },
  @{ id = 'd3c3f3e0-0003-4000-8000-000000000003'; number = 'OS-0003'; type = 'Corretiva'; priority = 'Alta'; status = 'Em andamento'; description = 'Vazamento de óleo identificado no selo mecânico.'; equipment_id = 'b1a1e1c0-0001-4000-8000-000000000001'; assigned_to = 'c2b2e2d0-0001-4000-8000-000000000001'; sector = 'Produção'; created_at = $now.AddHours(-2).ToString('o'); started_at = $now.AddMinutes(-90).ToString('o'); finished_at = $null },
  @{ id = 'd3c3f3e0-0004-4000-8000-000000000004'; number = 'OS-0004'; type = 'Preditiva'; priority = 'Baixa'; status = 'Aberta'; description = 'Análise de vibração - sensor indica anomalia na bomba hidráulica.'; equipment_id = 'b1a1e1c0-0004-4000-8000-000000000004'; assigned_to = $null; sector = 'Prensagem'; created_at = $now.AddMinutes(-30).ToString('o'); started_at = $null; finished_at = $null },
  @{ id = 'd3c3f3e0-0005-4000-8000-000000000005'; number = 'OS-0005'; type = 'Preventiva'; priority = 'Alta'; status = 'Aberta'; description = 'Revisão semestral da injetora: troca de resistências e calibração.'; equipment_id = 'b1a1e1c0-0005-4000-8000-000000000005'; assigned_to = $null; sector = 'Injeção'; created_at = $now.ToString('o'); started_at = $null; finished_at = $null }
)

$serviceOrderWorkers = @(
  @{ service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001' },
  @{ service_order_id = 'd3c3f3e0-0002-4000-8000-000000000002'; worker_id = 'c2b2e2d0-0002-4000-8000-000000000002' },
  @{ service_order_id = 'd3c3f3e0-0003-4000-8000-000000000003'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001' },
  @{ service_order_id = 'd3c3f3e0-0003-4000-8000-000000000003'; worker_id = 'c2b2e2d0-0003-4000-8000-000000000003' }
)

$serviceOrderParts = @(
  @{ id = '11111111-1111-4111-8111-111111111111'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; name = 'Filtro de ar'; quantity = 1; unit_cost = 85 },
  @{ id = '22222222-2222-4222-8222-222222222222'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; name = 'Correia dentada'; quantity = 2; unit_cost = 55 },
  @{ id = '33333333-3333-4333-8333-333333333333'; service_order_id = 'd3c3f3e0-0002-4000-8000-000000000002'; name = 'Óleo lubrificante 5L'; quantity = 2; unit_cost = 120 }
)

$serviceOrderHistory = @(
  @{ id = '44444444-4444-4444-8444-444444444444'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; timestamp = $now.AddHours(-4).ToString('o'); field = 'status'; old_value = ''; new_value = 'Aberta'; changed_by = 'Marcos Pereira' },
  @{ id = '55555555-5555-4555-8555-555555555555'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; timestamp = $now.AddHours(-3).ToString('o'); field = 'status'; old_value = 'Aberta'; new_value = 'Em andamento'; changed_by = 'Carlos Andrade' }
)

$timeEntries = @(
  @{ id = 'e4d4a4f0-0001-4000-8000-000000000001'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; activity_type = 'Execução'; start_time = $now.AddHours(-3).ToString('o'); end_time = $now.AddHours(-1).ToString('o'); notes = $null },
  @{ id = 'e4d4a4f0-0002-4000-8000-000000000002'; worker_id = 'c2b2e2d0-0002-4000-8000-000000000002'; service_order_id = 'd3c3f3e0-0002-4000-8000-000000000002'; activity_type = 'Execução'; start_time = $now.AddHours(-5).ToString('o'); end_time = $now.AddHours(-2).ToString('o'); notes = $null },
  @{ id = 'e4d4a4f0-0003-4000-8000-000000000003'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001'; service_order_id = 'd3c3f3e0-0003-4000-8000-000000000003'; activity_type = 'Setup'; start_time = $now.AddMinutes(-90).ToString('o'); end_time = $null; notes = $null }
)

$users = @(
  @{ id = 'f5e5a5f0-0001-4000-8000-000000000001'; name = 'Marcos Pereira'; email = 'marcos@manutencao.com'; password = '123456'; role = 'Supervisor'; worker_id = 'c2b2e2d0-0005-4000-8000-000000000005'; active = $true; created_at = $now.ToString('o') },
  @{ id = 'f5e5a5f0-0002-4000-8000-000000000002'; name = 'Administrador'; email = 'admin@manutencao.com'; password = 'admin123'; role = 'Administrador'; worker_id = $null; active = $true; created_at = $now.ToString('o') },
  @{ id = 'f5e5a5f0-0003-4000-8000-000000000003'; name = 'Carlos Andrade'; email = 'carlos@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001'; active = $true; created_at = $now.ToString('o') },
  @{ id = 'f5e5a5f0-0004-4000-8000-000000000004'; name = 'Fernanda Lima'; email = 'fernanda@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0002-4000-8000-000000000002'; active = $true; created_at = $now.ToString('o') },
  @{ id = 'f5e5a5f0-0005-4000-8000-000000000005'; name = 'Rafael Souza'; email = 'rafael@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0003-4000-8000-000000000003'; active = $true; created_at = $now.ToString('o') }
)

Write-Output 'Limpando tabelas...'
Invoke-SupabaseDelete -Table 'time_entries' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'service_order_history' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'service_order_parts' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'service_order_workers' -Filter 'service_order_id=not.is.null'
Invoke-SupabaseDelete -Table 'service_orders' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'users' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'workers' -Filter 'id=not.is.null'
Invoke-SupabaseDelete -Table 'equipments' -Filter 'id=not.is.null'

Write-Output 'Inserindo seed...'
Invoke-SupabaseInsert -Table 'equipments' -Rows $equipments
Invoke-SupabaseInsert -Table 'workers' -Rows $workers
Invoke-SupabaseInsert -Table 'service_orders' -Rows $serviceOrders
Invoke-SupabaseInsert -Table 'service_order_workers' -Rows $serviceOrderWorkers
Invoke-SupabaseInsert -Table 'service_order_parts' -Rows $serviceOrderParts
Invoke-SupabaseInsert -Table 'service_order_history' -Rows $serviceOrderHistory
Invoke-SupabaseInsert -Table 'time_entries' -Rows $timeEntries
Invoke-SupabaseInsert -Table 'users' -Rows $users

Write-Output 'Contagens apos seed:'
'equipments', 'workers', 'service_orders', 'service_order_workers', 'service_order_parts', 'service_order_history', 'time_entries', 'users' | ForEach-Object {
  Write-Output ("{0}: {1}" -f $_, (Get-SupabaseCount -Table $_))
}