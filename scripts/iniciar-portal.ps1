# Arranca API + portal en una sola terminal (recomendado).
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root "artifacts\api-server\.env"
if (-not (Test-Path $envFile)) {
  Write-Host 'ERROR: Falta artifacts\api-server\.env' -ForegroundColor Red
  Write-Host 'Copia .env.example y pon tu contraseña de PostgreSQL en DATABASE_URL.' -ForegroundColor Yellow
  exit 1
}

Write-Host ''
Write-Host 'Iniciando API (8080) + Portal (3000)...' -ForegroundColor Cyan
Write-Host 'Login: admin / admin123' -ForegroundColor Green
Write-Host 'Abre: http://localhost:3000' -ForegroundColor Green
Write-Host 'Para detener: Ctrl+C' -ForegroundColor Gray
Write-Host ''

pnpm run dev:local
