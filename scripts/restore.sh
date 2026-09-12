#!/usr/bin/env bash
# ==============================================================================
# CatoLedger — Script de restauración de base de datos
# ==============================================================================
# Uso: ./scripts/restore.sh <archivo-de-backup.dump>
#
# Ejemplo:
#   ./scripts/restore.sh ./backups/catoledger-20260818-120000.dump
#
# Requiere:
#   - supabase CLI autenticado (supabase login)
#   - Proyecto vinculado (supabase link --project-ref <ref>)
#   - Archivo de backup válido generado por backup.sh o supabase db dump
#
# ⚠️  ADVERTENCIA: Este script SOBRESCRIBE la base de datos de producción.
#     Se recomienda hacer un backup actual antes de restaurar.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- Validar argumentos --------------------------------------------------------

if [[ $# -lt 1 ]]; then
    error "Uso: $0 <archivo-de-backup.dump>"
    echo ""
    echo "Backups disponibles:"
    if ls "${BACKUP_DIR}"/catoledger-*.dump 1>/dev/null 2>&1; then
        ls -lht "${BACKUP_DIR}"/catoledger-*.dump | head -10
    else
        echo "  (no hay backups en ${BACKUP_DIR})"
    fi
    exit 1
fi

BACKUP_FILE="$1"

# Si es un nombre relativo, buscarlo en el directorio de backups
if [[ ! -f "${BACKUP_FILE}" ]]; then
    if [[ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]]; then
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    else
        error "Archivo de backup no encontrado: $1"
        exit 1
    fi
fi

# Verificar que es un archivo válido
if [[ ! -s "${BACKUP_FILE}" ]]; then
    error "El archivo de backup está vacío o no es legible: ${BACKUP_FILE}"
    exit 1
fi

info "Archivo de backup: ${BACKUP_FILE}"
info "Tamaño: $(du -h "${BACKUP_FILE}" | cut -f1)"

# --- Verificaciones previas ---------------------------------------------------

if ! command -v supabase &>/dev/null; then
    error "supabase CLI no encontrado."
    echo "  Instálalo con: npm i -g supabase"
    exit 1
fi

# --- Confirmación de seguridad ------------------------------------------------

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠️  ADVERTENCIA: RESTAURACIÓN DE BASE DE DATOS            ║${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}║  Este proceso SOBRESCRIBIRÁ todos los datos actuales       ║${NC}"
echo -e "${RED}║  en la base de datos de Supabase.                          ║${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}║  Esta acción es IRREVERSIBLE.                              ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Primera confirmación
read -rp "¿Escribe 'RESTAURAR' para confirmar: " CONFIRM1
if [[ "${CONFIRM1}" != "RESTAURAR" ]]; then
    info "Operación cancelada."
    exit 0
fi

# Segunda confirmación
read -rp "¿Estás SEGURO? (sí/no): " CONFIRM2
if [[ "${CONFIRM2}" != "sí" && "${CONFIRM2}" != "si" ]]; then
    info "Operación cancelada."
    exit 0
fi

# --- Backup de seguridad previo ------------------------------------------------

info "Creando backup de seguridad previo..."
SAFETY_BACKUP="${BACKUP_DIR}/catoledger-pre-restore-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "${BACKUP_DIR}"

if supabase db dump --file "${SAFETY_BACKUP}" 2>/dev/null; then
    info "Backup de seguridad: ${SAFETY_BACKUP}"
else
    warn "No se pudo crear backup de seguridad. Continuando..."
fi

# --- Restaurar -----------------------------------------------------------------

info "Restaurando desde: ${BACKUP_FILE}"
echo ""

if supabase db dump --file "${BACKUP_FILE}" --use-copy 2>/dev/null; then
    # Note: supabase CLI no tiene "db restore" directo en todas las versiones.
    # Alternativa con pg_restore:
    if command -v pg_restore &>/dev/null && [[ -n "${SUPABASE_DB_URL:-}" ]]; then
        info "Usando pg_restore con SUPABASE_DB_URL..."
        pg_restore --no-owner --no-acl --if-exists --clean \
            --dbname="${SUPABASE_DB_URL}" \
            "${BACKUP_FILE}"
    else
        warn "supabase CLI no soporta restauración directa."
        echo "  Usa pg_restore manualmente:"
        echo ""
        echo "  export SUPABASE_DB_URL='postgresql://postgres.PROYECTO:CLAVE@host:6543/postgres'"
        echo "  pg_restore --no-owner --no-acl --if-exists --clean --dbname=\"\$SUPABASE_DB_URL\" '${BACKUP_FILE}'"
        echo ""
        echo "  O importa desde el Dashboard de Supabase:"
        echo "  1. Ve a https://supabase.com/dashboard"
        echo "  2. Selecciona tu proyecto"
        echo "  3. Ve a SQL Editor"
        echo "  4. Usa 'Upload file' para importar el dump"
        exit 1
    fi
else
    error "La restauración falló."
    echo "  Consulta los errores arriba y verifica:"
    echo "  1. Que estás autenticado: supabase login"
    echo "  2. Que el proyecto está vinculado: supabase link --project-ref <ref>"
    echo "  3. Que el archivo de backup no está corrupto"
    exit 1
fi

info "Restauración completada exitosamente."
echo ""
info "Verificación recomendada:"
echo "  1. Abre el Dashboard de Supabase y verifica las tablas"
echo "  2. Ejecuta la app y prueba login + datos"
echo "  3. Revisa los logs de Supabase por errores"
