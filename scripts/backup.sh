#!/usr/bin/env bash
# ==============================================================================
# CatoLedger — Script de backup de base de datos
# ==============================================================================
# Uso: ./scripts/backup.sh
#
# Requiere:
#   - supabase CLI autenticado (supabase login)
#   - Proyecto vinculado (supabase link --project-ref <ref>)
#
# Alternativa sin supabase CLI (usar con pg_dump directo):
#   export SUPABASE_DB_URL="postgresql://postgres.PROYECTO:CLAVE@aws-0-...pooler.supabase.com:6543/postgres"
#   pg_dump --no-owner --format=custom --file=backups/catoledger-YYYYMMDD.dump "$SUPABASE_DB_URL"
#
# Retención: conserva los últimos 7 backups diarios.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/catoledger-${TIMESTAMP}.dump"
KEEP_DAILY=7

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- Verificaciones previas ---------------------------------------------------

# Verificar que existe supabase CLI
if ! command -v supabase &>/dev/null; then
    error "supabase CLI no encontrado."
    echo "  Instálalo con: npm i -g supabase"
    echo "  O usa pg_dump directamente (ver comentarios al inicio del script)."
    exit 1
fi

# Verificar que el proyecto está vinculado
if ! supabase projects list &>/dev/null 2>&1; then
    warn "No se pudo verificar la lista de proyectos. ¿Estás autenticado?"
    echo "  Ejecuta: supabase login"
    echo "  Luego:   supabase link --project-ref <tu-project-ref>"
    exit 1
fi

# --- Crear directorio de backups -----------------------------------------------

mkdir -p "${BACKUP_DIR}"
info "Directorio de backups: ${BACKUP_DIR}"

# --- Generar backup ------------------------------------------------------------

info "Generando backup de Supabase..."
if supabase db dump --file "${BACKUP_FILE}" 2>/dev/null; then
    BYTES=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo 0)
    MB=$(echo "scale=2; ${BYTES} / 1048576" | bc 2>/dev/null || echo "?")
    info "Backup completado: ${BACKUP_FILE} (${MB} MB)"
else
    error "supabase db dump falló."
    echo "  Asegúrate de estar autenticado y vinculado al proyecto."
    echo "  Ejecuta: supabase login && supabase link --project-ref <ref>"
    rm -f "${BACKUP_FILE}" 2>/dev/null
    exit 1
fi

# --- Rotación: eliminar backups antiguos ----------------------------------------

info "Rotación: conservando últimos ${KEEP_DAILY} backups..."

DELETED=0
if ls "${BACKUP_DIR}"/catoledger-*.dump 1>/dev/null 2>&1; then
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS
        find "${BACKUP_DIR}" -name "catoledger-*.dump" -type f -mtime +${KEEP_DAILY} -print -delete | while read -r f; do
            info "  Eliminado: $(basename "$f")"
            DELETED=$((DELETED + 1))
        done
    else
        # Linux
        find "${BACKUP_DIR}" -name "catoledger-*.dump" -type f -mtime +${KEEP_DAILY} -print -delete | while read -r f; do
            info "  Eliminado: $(basename "$f")"
            DELETED=$((DELETED + 1))
        done
    fi
fi

# --- Resumen --------------------------------------------------------------------

TOTAL=$(ls -1 "${BACKUP_DIR}"/catoledger-*.dump 2>/dev/null | wc -l | tr -d ' ')
info "Backups almacenados: ${TOTAL}"
echo ""
ls -lht "${BACKUP_DIR}"/catoledger-*.dump 2>/dev/null | head -5

info "Backup completado exitosamente."
