$envFile = Join-Path $PSScriptRoot '..\.env.local'
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
  }
}

$baseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$apiKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$headers = @{
  apikey = $apiKey
  Authorization = "Bearer $apiKey"
  Prefer = 'return=minimal'
  'Content-Type' = 'application/json'
}

function Insert-Rows {
  param([string]$Table, [object[]]$Rows)
  $json = $Rows | ConvertTo-Json -Depth 10 -Compress
  Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/rest/v1/$Table" -Method Post -Headers $headers -Body $json | Out-Null
}

function Get-Count {
  param([string]$Table)
  $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/rest/v1/$Table?select=*&limit=1000" -Method Get -Headers $headers
  $rows = $response.Content | ConvertFrom-Json
  if ($rows -is [array]) { return $rows.Count }
  if ($null -eq $rows) { return 0 }
  return 1
}

$parts = @(
  @{ id = '11111111-1111-4111-8111-111111111111'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; name = 'Filtro de ar'; quantity = 1; unit_cost = 85 },
  @{ id = '22222222-2222-4222-8222-222222222222'; service_order_id = 'd3c3f3e0-0001-4000-8000-000000000001'; name = 'Correia dentada'; quantity = 2; unit_cost = 55 },
  @{ id = '33333333-3333-4333-8333-333333333333'; service_order_id = 'd3c3f3e0-0002-4000-8000-000000000002'; name = 'Óleo lubrificante 5L'; quantity = 2; unit_cost = 120 }
)

$users = @(
  @{ id = 'f5e5a5f0-0001-4000-8000-000000000001'; name = 'Marcos Pereira'; email = 'marcos@manutencao.com'; password = '123456'; role = 'Supervisor'; worker_id = 'c2b2e2d0-0005-4000-8000-000000000005'; active = $true; created_at = '2026-04-01T12:00:00.000Z' },
  @{ id = 'f5e5a5f0-0002-4000-8000-000000000002'; name = 'Administrador'; email = 'admin@manutencao.com'; password = 'admin123'; role = 'Administrador'; worker_id = $null; active = $true; created_at = '2026-04-01T12:00:00.000Z' },
  @{ id = 'f5e5a5f0-0003-4000-8000-000000000003'; name = 'Carlos Andrade'; email = 'carlos@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0001-4000-8000-000000000001'; active = $true; created_at = '2026-04-01T12:00:00.000Z' },
  @{ id = 'f5e5a5f0-0004-4000-8000-000000000004'; name = 'Fernanda Lima'; email = 'fernanda@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0002-4000-8000-000000000002'; active = $true; created_at = '2026-04-01T12:00:00.000Z' },
  @{ id = 'f5e5a5f0-0005-4000-8000-000000000005'; name = 'Rafael Souza'; email = 'rafael@manutencao.com'; password = '123456'; role = 'Manutentor'; worker_id = 'c2b2e2d0-0003-4000-8000-000000000003'; active = $true; created_at = '2026-04-01T12:00:00.000Z' }
)

if ((Get-Count 'service_order_parts') -eq 0) {
  Insert-Rows -Table 'service_order_parts' -Rows $parts
}

if ((Get-Count 'users') -eq 0) {
  Insert-Rows -Table 'users' -Rows $users
}

'equipments', 'workers', 'service_orders', 'service_order_workers', 'service_order_parts', 'service_order_history', 'time_entries', 'users' | ForEach-Object {
  Write-Output ("{0}: {1}" -f $_, (Get-Count $_))
}