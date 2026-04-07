#!/bin/bash
# ============================================================
# Skrypt wdrożenia AthleticsPRO na serwer Linux
# Użycie: ./deploy.sh <IP_SERWERA>
# Przykład: ./deploy.sh 1.2.3.4
# ============================================================

set -e

SERVER_IP="${1:-BRAK}"

if [ "$SERVER_IP" = "BRAK" ]; then
  echo "Użycie: ./deploy.sh <IP_SERWERA>"
  echo "Przykład: ./deploy.sh 1.2.3.4"
  exit 1
fi

echo ">>> Ustawiam IP serwera: $SERVER_IP"

# Aktualizuj NEXT_PUBLIC_API_URL w root .env
sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$SERVER_IP:3000|" .env

# Aktualizuj ALLOWED_ORIGINS w backend .env
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://$SERVER_IP:3001,http://$SERVER_IP:3000|" backend/.env

echo ">>> Tworzę katalog lynx_data (jeśli nie istnieje)"
mkdir -p ./lynx_data

echo ">>> Buduję i uruchamiam kontenery..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo ""
echo "============================================================"
echo "Aplikacja uruchomiona!"
echo "  Frontend: http://$SERVER_IP:3001"
echo "  Backend:  http://$SERVER_IP:3000"
echo "============================================================"
