# Inicia API (8080) y portal web (3000) en ventanas separadas.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root "artifacts\api-server\.env"
$envExample = Join-Path $root "artifacts\api-server\.env.example"

if (-not (Test-Path $envFile)) {
  Copy-Item $envExample $envFile
  Write-Host 'Se creo artifacts/api-server/.env — edita DATABASE_URL antes de continuar.' -ForegroundColor Yellow
}

Write-Host 'Iniciando API en http://127.0.0.1:8080 ...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit', '-Command',
  "Set-Location '$root'; `$env:PORT='8080'; pnpm --filter @workspace/api-server run dev"
)

Start-Sleep -Seconds 3

Write-Host 'Iniciando portal en http://localhost:3000 ...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit', '-Command',
  "Set-Location '$root'; `$env:PORT='3000'; `$env:BASE_PATH='/'; pnpm --filter @workspace/school-portal run dev"
)

Write-Host ''
Write-Host 'Listo. Abre http://localhost:3000' -ForegroundColor Green
Write-Host 'Usuarios de prueba (tras crear tablas): admin / admin123' -ForegroundColor Green
