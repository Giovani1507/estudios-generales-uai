# Crea tablas en PostgreSQL (requiere DATABASE_URL en artifacts/api-server/.env)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envFile = Join-Path $root "artifacts\api-server\.env"

if (-not (Test-Path $envFile)) {
  Write-Error 'Falta artifacts/api-server/.env — copia .env.example y configura DATABASE_URL.'
  exit 1
}

Write-Host 'Aplicando esquema Drizzle a la base de datos...' -ForegroundColor Cyan
pnpm --filter @workspace/db run push

if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Si falla la conexion:' -ForegroundColor Yellow
  Write-Host '  1. Instala PostgreSQL 16 desde https://www.postgresql.org/download/windows/' -ForegroundColor Yellow
  Write-Host '  2. Crea la base: CREATE DATABASE estudios_generales;' -ForegroundColor Yellow
  Write-Host '  3. Ajusta DATABASE_URL en artifacts/api-server/.env' -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host 'Esquema listo. Al iniciar el API se crean usuarios de prueba (admin / admin123).' -ForegroundColor Green
