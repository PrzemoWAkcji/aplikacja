# Instrukcja Wdrożenia Systemu AthleticsPRO

System został przygotowany do wdrożenia zautomatyzowanego przy użyciu platformy Docker.

## Wymagania
- Docker
- Docker Compose

## Kroki wdrożeniowe

### 1. Przygotowanie środowiska
Skopiuj plik `env.deploy.example` do pliku `.env` w głównym katalogu projektu:
`cp env.deploy.example .env`
Uzupełnij odpowiednie wartości (szczególnie `DATABASE_URL` i `JWT_SECRET`).

### 2. Uruchomienie kontenerów
Wydaj polecenie:
`docker-compose -f docker-compose.prod.yml up -d --build`

To polecenie:
- Zbuduje zoptymalizowane obrazy frontendu i backendu.
- Uruchomi bazę danych PostgreSQL i pamięć podręczną Redis.
- Automatycznie wykona migracje bazy danych (Prisma).
- Skonfiguruje sieć wewnętrzną między usługami.

### 3. Folder danych FinishLynx
System automatycznie obserwuje folder `backend/lynx_data` wewnątrz kontenera (zmapowany na lokalny folder o tej samej nazwie). Wrzucenie tam plików `.lif` spowoduje natychmiastową aktualizację wyników.

## Porty
- **Frontend (Kibice/Sędziowie):** http://localhost:3001
- **Backend (API):** http://localhost:3000

## Monitoring
Status systemu można sprawdzić pod adresem:
`http://localhost:3000/health`
