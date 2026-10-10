<#
CatoLedger — Rollout "release estados y sync v8" (v1.1.0)

Uso:
  .\scripts\rollout.ps1 -Check              # solo diagnostico de prerequisitos
  .\scripts\rollout.ps1 -Backup             # solo backup (gate de seguridad)
  .\scripts\rollout.ps1 -Migrations         # aplica 00020, 00021 y 00006 (EXIGE backup reciente)
  .\scripts\rollout.ps1 -PwaBuild           # build local de la PWA (standalone)
  .\scripts\rollout.ps1 -All                # Backup -> Migrations -> PwaBuild

Requisitos (bloque A o B):
  A) $env:SUPABASE_DB_URL + pg_dump/psql (clientes PostgreSQL en el PATH)
  B) supabase CLI logueado/linked (backup alternativo con `supabase db dump`)
EAS (móvil) NO se automatiza aqui: requiere `eas login` interactivo.

Seguridad: JAMAS migra sin un backup reciente (predeterminado).
#>

param(
    [switch]$Check,
    [switch]$Backup,
    [switch]$Migrations,
    [switch]$PwaBuild,
    [switch]$All,
    [int]$MaxBackupAgeHours = 24,
    [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
$Root = Join-Path $PSScriptRoot ".."

function Write-Result {
    param([string]$Label, [bool]$Ok, [string]$Detail = "")
    $status = if ($Ok) { "OK " } else { "FALTA" }
    Write-Host ("[{0}] {1} {2}" -f $status, $Label, $Detail)
}

function Test-Requisites {
    $dbUrl = [bool]$env:SUPABASE_DB_URL
    $pgDump = [bool](Get-Command pg_dump -ErrorAction SilentlyContinue)
    $psql = [bool](Get-Command psql -ErrorAction SilentlyContinue)
    $supa = [bool](Get-Command supabase -ErrorAction SilentlyContinue)

    # EAS login se detecta sin invocar la CLI (tarda ~20 s en arrancar).
    # eas-cli guarda la sesion en ~/.expo/state.json -> auth.
    $easLogin = $false
    $easStatePath = Join-Path $env:USERPROFILE ".expo\state.json"
    if (Test-Path $easStatePath) {
        try {
            $easAuth = (Get-Content $easStatePath -Raw | ConvertFrom-Json).auth
            $easLogin = ($null -ne $easAuth -and "$easAuth" -ne "")
        } catch { $easLogin = $false }
    }

    Write-Host "`n== Prerequisitos =="
    Write-Result "SUPABASE_DB_URL" $dbUrl "($env:SUPABASE_DB_URL)"
    Write-Result "pg_dump (backup clasico)" $pgDump
    Write-Result "psql (migraciones)" $psql
    Write-Result "supabase CLI (backup alt.)" $supa
    Write-Result "EAS login (movil, estado local)" $easLogin

    if ($dbUrl -and $psql) { return "A" }
    if ($supa) { return "B" }
    return ""
}

function Backup-Database {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

    if ($env:SUPABASE_DB_URL -and (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
        $file = Join-Path $BackupDir "catoledger-$stamp.dump"
        Write-Host "`nGenerando backup (pg_dump) -> $file"
        & pg_dump --no-owner --format=custom --file=$file $env:SUPABASE_DB_URL
        if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo con codigo $LASTEXITCODE" }
        $mb = (Get-Item $file).Length / 1MB
        Write-Host ("Backup OK: {0:N2} MB" -f $mb)
        return $file
    }

    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        if (-not $env:SUPABASE_DB_URL) { throw "Backup via CLI requiere SUPABASE_DB_URL (no hay proyecto linkeado en este repo)" }
        $file = Join-Path $BackupDir "catoledger-$stamp.sql"
        Write-Host "`nGenerando backup (supabase db dump) -> $file"
        & supabase db dump "--db-url=$env:SUPABASE_DB_URL" --schema public -f $file
        if ($LASTEXITCODE -ne 0) { throw "supabase db dump fallo con codigo $LASTEXITCODE" }
        $mb = (Get-Item $file).Length / 1MB
        Write-Host ("Backup OK: {0:N2} MB" -f $mb)
        return $file
    }

    throw "Backup imposible: falta SUPABASE_DB_URL+pg_dump o supabase CLI logueado"
}

function Confirm-FreshBackup {
    $cutoff = (Get-Date).AddHours(-$MaxBackupAgeHours)
    $latest = Get-ChildItem $BackupDir -Filter "catoledger-*" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $cutoff } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        throw "No hay backup de las ultimas $MaxBackupAgeHours horas en $BackupDir. Ejecuta primero: .\scripts\rollout.ps1 -Backup"
    }
    Write-Host ("`nBackup reciente confirmado: {0} ({1:N2} MB)" -f $latest.Name, ($latest.Length / 1MB))
}

function Apply-Migrations {
    Confirm-FreshBackup
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        throw "Migraciones requieren psql + SUPABASE_DB_URL (aplicacion manual via SQL con permisos)"
    }

    $files = @(
        (Join-Path $Root "supabase\migrations\00020_products_category_id.sql"),
        (Join-Path $Root "supabase\migrations\00021_soft_delete_details.sql"),
        (Join-Path $Root "apps\api\migrations\00006_sync_field_alignment.sql")
    )

    foreach ($f in $files) {
        if (-not (Test-Path $f)) { throw "Migracion no encontrada: $f" }
        Write-Host ("`nAplicando {0}" -f (Split-Path $f -Leaf))
        & psql -v ON_ERROR_STOP=1 --single-transaction -f $f $env:SUPABASE_DB_URL
        if ($LASTEXITCODE -ne 0) { throw "psql fallo aplicando $f" }
    }

    Write-Host "`nMigraciones aplicadas. Validar en el entorno de produccion:"
    Write-Host "  - RLS anon: SELECT * FROM expenses;   (debe dar 0 filas o 401)"
    Write-Host "  - sale_details/purchase_details: columnas deleted/workspace_id/updated_at"
    Write-Host "  - products.category_id: obtener valor con SELECT"
    Write-Host "  - GET /health/ready de la API"
}

function Build-Pwa {
    Write-Host "`n== Build PWA (produccion standalone) =="
    $devRunning = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -match 'next.{0,60} dev|run dev' }
    if ($devRunning) {
        throw "El dev server esta corriendo (PID $($devRunning.ProcessId -join ',')). Detenlo antes de build: no se puede tocar .next a la vez."
    }

    Push-Location $Root
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0 -and -not (Test-Path "$Root\node_modules")) {
            throw "npm ci fallo y no hay node_modules"
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "npm ci omitido (node_modules en uso por otro proceso). Se usa la instalacion actual."
        }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build fallo" }
        Write-Host "`nBuild PWA generado en .next/ (listo para hostear con npm run start)"
    }
    finally { Pop-Location }
}

$mode = Test-Requisites

if ($Check) {
    Write-Host ("`nBloque disponible: {0}" -f $(if ($mode -eq "A") { "A (psql/ps_dump directo)" } elseif ($mode -eq "B") { "B (supabase CLI)" } else { "ninguno: resolviendo" }) )
    exit 0
}

if ($All -or $Backup) {
    $null = Backup-Database
    if (-not $All) { exit 0 }
}
if ($All -or $Migrations) { Apply-Migrations }
if ($All -or $PwaBuild) { Build-Pwa }

Write-Host "`nRollout completado. Pasos manuales restantes:"
Write-Host "  - Móvil: eas login && npx eas build --platform android --profile preview"
Write-Host "  - Verificar promocion a production ('anulado') en un dispositivo real (v7 y v8)."