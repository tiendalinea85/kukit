#!/usr/bin/env bash
# ==============================================================================
# CatoLedger — Health check para monitoreo
# ==============================================================================
# Uso: ./scripts/health-check.sh [URL]
#
# Por defecto verifica: http://localhost:3000
#
# Verificaciones:
#   1. La app responde (HTTP 200)
#   2. Supabase es accesible (auth endpoint)
#   3. API key de Gemini configurada (si se provee GEMINI_API_KEY)
#
# Código de salida:
#   0 = todo OK
#   1 = al menos una verificación falló
# ==============================================================================
set -euo pipefail

APP_URL="${1:-http://localhost:3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
GEMINI_KEY="${GEMINI_API_KEY:-}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_pass() { echo -e "  ${GREEN}✓${NC} $*"; PASS=$((PASS + 1)); }
check_fail() { echo -e "  ${RED}✗${NC} $*"; FAIL=$((FAIL + 1)); }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $*"; WARN=$((WARN + 1)); }

echo "============================================"
echo " CatoLedger Health Check"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"
echo ""

# --- 1. App responde -----------------------------------------------------------

echo "1. App (${APP_URL})"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${APP_URL}" 2>/dev/null || echo "000")

if [[ "${HTTP_CODE}" == "200" ]]; then
    check_pass "App responde con HTTP ${HTTP_CODE}"
elif [[ "${HTTP_CODE}" == "000" ]]; then
    check_fail "No se pudo conectar a ${APP_URL}"
else
    check_fail "App respondió con HTTP ${HTTP_CODE} (esperado 200)"
fi

# Verificar headers de seguridad
HEADERS=$(curl -s -I --max-time 10 "${APP_URL}" 2>/dev/null || echo "")

if echo "${HEADERS}" | grep -qi "x-content-type-options: nosniff"; then
    check_pass "Header X-Content-Type-Options presente"
else
    check_warn "Header X-Content-Type-Options ausente"
fi

if echo "${HEADERS}" | grep -qi "x-frame-options"; then
    check_pass "Header X-Frame-Options presente"
else
    check_warn "Header X-Frame-Options ausente"
fi

echo ""

# --- 2. Supabase ----------------------------------------------------------------

echo "2. Supabase"

if [[ -n "${SUPABASE_URL}" ]]; then
    SUPABASE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        "${SUPABASE_URL}/auth/v1/health" 2>/dev/null || echo "000")

    if [[ "${SUPABASE_HEALTH}" == "200" ]]; then
        check_pass "Supabase auth endpoint responde (HTTP ${SUPABASE_HEALTH})"
    elif [[ "${SUPABASE_HEALTH}" == "000" ]]; then
        check_fail "No se pudo conectar a Supabase (${SUPABASE_URL})"
    else
        check_warn "Supabase respondió con HTTP ${SUPABASE_HEALTH}"
    fi
else
    check_warn "NEXT_PUBLIC_SUPABASE_URL no configurada — omitiendo verificación de Supabase"
fi

echo ""

# --- 3. Gemini API Key ----------------------------------------------------------

echo "3. Gemini AI"

if [[ -n "${GEMINI_KEY}" ]]; then
    # Verificar que la key es válida haciendo una llamada mínima
    GEMINI_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 15 \
        "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}" 2>/dev/null || echo -e "\n000")

    GEMINI_HTTP=$(echo "${GEMINI_RESPONSE}" | tail -1)

    if [[ "${GEMINI_HTTP}" == "200" ]]; then
        check_pass "API key de Gemini válida"
    elif [[ "${GEMINI_HTTP}" == "400" || "${GEMINI_HTTP}" == "403" ]]; then
        check_fail "API key de Gemini inválida o sin permisos (HTTP ${GEMINI_HTTP})"
    else
        check_warn "No se pudo verificar Gemini (HTTP ${GEMINI_HTTP})"
    fi
else
    check_warn "GEMINI_API_KEY no configurada — OCR y voz no funcionarán"
fi

echo ""

# --- 4. Endpoint API (voice/ocr) -----------------------------------------------

echo "4. API Endpoints"

VOICE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST -H "Content-Type: application/json" \
    -d '{}' \
    "${APP_URL}/api/voice/parse" 2>/dev/null || echo "000")

if [[ "${VOICE_CODE}" == "200" || "${VOICE_CODE}" == "401" ]]; then
    check_pass "/api/voice/parse responde (HTTP ${VOICE_CODE})"
else
    check_fail "/api/voice/parse no responde correctamente (HTTP ${VOICE_CODE})"
fi

OCR_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST -H "Content-Type: application/json" \
    -d '{}' \
    "${APP_URL}/api/ai/ocr" 2>/dev/null || echo "000")

if [[ "${OCR_CODE}" == "400" || "${OCR_CODE}" == "401" ]]; then
    check_pass "/api/ai/ocr responde (HTTP ${OCR_CODE})"
else
    check_fail "/api/ai/ocr no responde correctamente (HTTP ${OCR_CODE})"
fi

echo ""

# --- Resumen --------------------------------------------------------------------

echo "============================================"
echo " Resultado: ${PASS} pass | ${FAIL} fail | ${WARN} warn"
echo "============================================"

if [[ ${FAIL} -gt 0 ]]; then
    echo -e "${RED}STATUS: DEGRADED${NC}"
    exit 1
else
    echo -e "${GREEN}STATUS: HEALTHY${NC}"
    exit 0
fi
