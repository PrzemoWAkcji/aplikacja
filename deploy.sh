#!/bin/bash
# ============================================================
# AthleticsPRO — Skrypt wdrożenia na serwer Linux
#
# Użycie:
#   ./deploy.sh <IP_LUB_DOMENA> [--email TWOJ@EMAIL.PL]
#
# Przykłady:
#   ./deploy.sh 1.2.3.4
#   ./deploy.sh zawody.twojadomena.pl --email admin@twojadomena.pl
#
# Wymagania na serwerze:
#   - Ubuntu 22.04 / Debian 12
#   - Docker + Docker Compose v2
#   - Otwarte porty 80 i 443
# ============================================================

set -euo pipefail

DOMAIN="${1:-}"
EMAIL=""

# Parsuj argumenty
while [[ $# -gt 0 ]]; do
  case $1 in
    --email) EMAIL="$2"; shift 2 ;;
    *) DOMAIN="$1"; shift ;;
  esac
done

if [ -z "$DOMAIN" ]; then
  echo "Użycie: ./deploy.sh <IP_LUB_DOMENA> [--email TWOJ@EMAIL.PL]"
  echo ""
  echo "Przykłady:"
  echo "  ./deploy.sh 1.2.3.4"
  echo "  ./deploy.sh zawody.twojadomena.pl --email admin@twojadomena.pl"
  exit 1
fi

IS_IP=false
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IS_IP=true
fi

echo ""
echo "============================================================"
echo " AthleticsPRO — Wdrożenie"
echo " Cel:    $DOMAIN"
echo " SSL:    $([ "$IS_IP" = true ] && echo 'NIE (adres IP — tylko HTTP)' || echo 'TAK (Let'\''s Encrypt)')"
echo "============================================================"
echo ""

# --- 1. Plik .env na serwerze ---
echo ">>> [1/7] Przygotowuję zmienne środowiskowe..."

if [ ! -f ".env" ]; then
  cat > .env << EOF
DOMAIN=$DOMAIN
DB_USER=admin
DB_PASSWORD=$(openssl rand -hex 32)
DB_NAME=aplikacja_db
REDIS_PASSWORD=$(openssl rand -hex 16)
LYNX_DATA_PATH=./lynx_data
NEXT_PUBLIC_API_URL=https://api.${DOMAIN}
EOF
  echo "   Wygenerowano .env z losowymi hasłami bazy danych."
else
  # Aktualizuj tylko DOMAIN i API URL
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" .env
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://api.$DOMAIN|" .env
  echo "   Zaktualizowano .env."
fi

# Załaduj zmienne
export $(grep -v '^#' .env | xargs)

# Zaktualizuj backend/.env
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://$DOMAIN,https://api.$DOMAIN|" backend/.env
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" backend/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER:-admin}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-aplikacja_db}?schema=public|" backend/.env
echo "   Zaktualizowano DATABASE_URL w backend/.env."

# --- 2. Nginx config z podstawieniem domeny ---
echo ">>> [2/7] Generuję konfigurację Nginx..."
mkdir -p nginx/conf.d
export DOMAIN
envsubst '${DOMAIN}' < nginx/conf.d/app.conf.template > nginx/conf.d/app.conf
echo "   nginx/conf.d/app.conf gotowy."

# --- 3. Ikony PWA ---
echo ">>> [3/7] Generuję ikony PWA..."
if command -v node &> /dev/null && [ -f "frontend/scripts/generate-icons.js" ]; then
  cd frontend
  npm install --save-dev sharp --silent 2>/dev/null || true
  node scripts/generate-icons.js
  cd ..
else
  echo "   Pominięto (brak Node.js lub skryptu) — użyję SVG jako fallback."
fi

# --- 4. Certbot / SSL ---
if [ "$IS_IP" = false ] && [ -n "$EMAIL" ]; then
  echo ">>> [4/7] Inicjalizuję certyfikat SSL (Let's Encrypt)..."

  # Uruchom nginx tylko na HTTP żeby certbot mógł weryfikować
  docker compose -f docker-compose.prod.yml up -d nginx --no-deps 2>/dev/null || true
  sleep 3

  docker run --rm \
    -v "$(pwd)/nginx/certbot_www:/var/www/certbot" \
    -v "$(pwd)/nginx/certbot_certs:/etc/letsencrypt" \
    certbot/certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email "$EMAIL" \
      --agree-tos \
      --no-eff-email \
      -d "$DOMAIN" \
      -d "api.$DOMAIN" \
      --non-interactive \
      2>&1 | tail -5

  echo "   Certyfikat SSL wystawiony dla $DOMAIN i api.$DOMAIN"
elif [ "$IS_IP" = true ]; then
  echo ">>> [4/7] Pominięto SSL — adres IP (brak obsługi Let's Encrypt)."
  echo "   UWAGA: Aplikacja będzie dostępna przez HTTP na porcie 80."
  # Dla IP — nadpisz nginx.conf żeby nie wymagał certyfikatów
  cat > nginx/conf.d/app.conf << NGINXEOF
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location /socket.io/ {
        proxy_pass         http://aplikacja-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
        proxy_read_timeout 86400;
    }

    location /api/ {
        proxy_pass         http://aplikacja-backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        client_max_body_size 50M;
    }

    location / {
        proxy_pass         http://aplikacja-frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 86400;
    }
}
NGINXEOF
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$DOMAIN/api|" .env
else
  echo ">>> [4/7] Pominięto SSL (brak --email). Dodaj '--email TWOJ@EMAIL.PL' aby włączyć HTTPS."
fi

# --- 5. Katalog Lynx ---
echo ">>> [5/7] Przygotowuję katalog FinishLynx..."
mkdir -p ./lynx_data
echo "   Katalog lynx_data gotowy."

# --- 6. Build i uruchomienie ---
echo ">>> [6/7] Buduję i uruchamiam kontenery (może potrwać kilka minut)..."
docker compose -f docker-compose.prod.yml pull --quiet 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build 2>&1 | grep -E "Building|Built|Started|Running|Error" || true

# --- 7. Weryfikacja ---
echo ">>> [7/7] Weryfikuję wdrożenie..."
sleep 10

PROTOCOL="http"
PORT=80
[ "$IS_IP" = false ] && [ -n "$EMAIL" ] && PROTOCOL="https" && PORT=443

MAX_WAIT=60
ELAPSED=0
until curl -sf --max-time 5 "http://localhost:3000/health" > /dev/null 2>&1; do
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "   UWAGA: Backend nie odpowiada po ${MAX_WAIT}s — sprawdź logi: docker compose -f docker-compose.prod.yml logs backend"
    break
  fi
done

echo ""
echo "============================================================"
echo " Wdrożenie zakończone!"
echo ""
if [ "$IS_IP" = true ]; then
  echo "   Aplikacja:  http://$DOMAIN"
  echo "   Backend:    http://$DOMAIN/api"
else
  echo "   Aplikacja:  https://$DOMAIN"
  echo "   Backend:    https://api.$DOMAIN"
fi
echo ""
echo "   Status kontenerów:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo "   Logi: docker compose -f docker-compose.prod.yml logs -f"
echo "============================================================"
