# Backup de la base de datos Postgres/Supabase (Windows)
#
# Uso:
#   $env:SUPABASE_DB_URL = "postgresql://postgres.PROYECTO:CLAVE@aws-0-region.pooler.supabase.com:6543/postgres"
#   .\scripts\backup-supabase.ps1
#
# Requiere: pg_dump del cliente de Postgres en el PATH
# (https://www.postgresql.org/download/windows/).
#
# Retención: conserva los últimos 14 backups diarios + los 4 más recientes
# (para restaurar en cualquier momento).

param(
    [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups"),
    [int]$KeepDaily = 14
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) {
    Write-Error "Falta la variable de entorno SUPABASE_DB_URL. No se puede continuar."
    exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error "pg_dump no está en el PATH. Instala los clientes de PostgreSQL."
    exit 1
}

$date = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $BackupDir "catoledger-$date.dump"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "Generando backup -> $file"
& pg_dump --no-owner --format=custom --file=$file $env:SUPABASE_DB_URL
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump falló con código $LASTEXITCODE"
    exit $LASTEXITCODE
}

$bytes = (Get-Item $file).Length
Write-Host ("OK: {0:N2} MB" -f ($bytes / 1MB))

# Rotación: elimina backups diarios más antiguos que `KeepDaily` días.
Get-ChildItem $BackupDir -Filter "catoledger-*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDaily) } |
    Remove-Item -Force

Write-Host "Backup completado. Archivos en $BackupDir:"
Get-ChildItem $BackupDir -Filter "catoledger-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, Length, LastWriteTime
