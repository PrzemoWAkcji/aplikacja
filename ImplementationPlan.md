Jasne, oto szczegółowy plan implementacji w formacie Markdown, stworzony na podstawie dostarczonych dokumentów PRD i TechStack.

---

# Szczegółowy Plan Implementacji
## Webowa aplikacja do obsługi zawodów lekkoatletycznych

**Wersja:** 1.0  
**Data:** 2026-02-10  
**Na podstawie:** PRD v1.1, TechStack v1.0

---

## 1. Wprowadzenie i Główne Założenia

Niniejszy dokument opisuje szczegółowy plan wdrożenia aplikacji, dzieląc projekt na fazy, epiki i konkretne zadania techniczne. Plan jest bezpośrednią odpowiedzią na wymagania biznesowe i funkcjonalne zdefiniowane w PRD, realizowaną przy użyciu rekomendowanego stosu technologicznego.

**Główne zasady implementacji:**
*   **Architektura API-First:** Backend (NestJS) dostarcza w pełni udokumentowane API, z którego korzysta frontend (Next.js) oraz przyszłe integracje.
*   **Modularność:** Logika biznesowa jest zamknięta w dedykowanych modułach (np. `UsersModule`, `MeetingsModule`, `FileMappingEngineModule`), co ułatwia testowanie i utrzymanie.
*   **Bezpieczeństwo typów (End-to-End Type Safety):** Wykorzystanie TypeScript w całym stosie (Next.js, NestJS, Prisma) w celu minimalizacji błędów w czasie działania aplikacji.
*   **Asynchroniczność:** Kluczowe, długotrwałe operacje (generowanie list, import/eksport plików) są obsługiwane w tle przez system kolejek (BullMQ + Redis), aby nie blokować interfejsu użytkownika.
*   **Ciągła integracja i dostarczanie (CI/CD):** Automatyzacja procesów budowania, testowania i wdrażania w celu zapewnienia wysokiej jakości i szybkości dostarczania nowych funkcji.

---

## 2. Podział na Fazy (Roadmap)

Implementacja zostanie podzielona na dwie główne fazy, zgodnie z sekcją 12 dokumentu PRD.

*   **Faza 1: MVP (Minimum Viable Product)** – Skupia się na dostarczeniu kluczowych funkcjonalności umożliwiających organizację zawodów od A do Z z manualnym i plikowym wsparciem dla FinishLynx.
*   **Faza 2: Rozszerzenie Funkcjonalne** – Wprowadza pełną automatyzację integracji z FinishLynx, zaawansowane reguły sportowe oraz obsługę wielobojów.

---

## 3. Faza 1: Implementacja MVP

**Cel:** Umożliwienie pełnego cyklu organizacji zawodów: od zapisów, przez generowanie list startowych, po eksport danych do systemów zewnętrznych i publikację wyników z importu.

| Epik | Opis | Kluczowe Technologie |
| :--- | :--- | :--- |
| **0. Fundamenty Projektu** | Konfiguracja środowiska, bazy danych i podstawowej architektury. | Docker, NestJS, Next.js, PostgreSQL, Prisma, Redis |
| **1. Uwierzytelnianie i RBAC** | Implementacja logowania i zarządzania rolami użytkowników. | NestJS, Passport.js, Prisma, Next.js |
| **2. Moduł Zapisów i Zawodów** | Pełna obsługa tworzenia zawodów i przyjmowania zgłoszeń online. | NestJS, Next.js, Prisma, class-validator |
| **3. Program i Listy Startowe** | Tworzenie programu minutowego i generowanie list startowych. | NestJS, Next.js, BullMQ |
| **4. Integracja Plikowa (MVP)** | Kluczowy moduł do eksportu CSV/EVT i importu CSV federacyjnego. | NestJS, BullMQ, papaparse, iconv-lite, Node.js `fs` |

---

### **Epik 0: Fundamenty Projektu (Sprint 0)**

*   **Zadanie 0.1: Inicjalizacja Repozytoriów**
    *   Utworzenie monorepozytorium (np. za pomocą Nx lub Turborepo) lub osobnych repozytoriów dla `backend` i `frontend`.
*   **Zadanie 0.2: Konfiguracja Środowiska Lokalnego**
    *   Stworzenie pliku `docker-compose.yml` do uruchamiania kontenerów: PostgreSQL, Redis.
*   **Zadanie 0.3: Inicjalizacja Aplikacji Backendowej**
    *   Utworzenie nowego projektu NestJS.
    *   Konfiguracja Prisma ORM, wygenerowanie klienta i stworzenie początkowych migracji dla podstawowych modeli (User, Role).
    *   Integracja z BullMQ.
*   **Zadanie 0.4: Inicjalizacja Aplikacji Frontendowej**
    *   Utworzenie nowego projektu Next.js.
    *   Instalacja i konfiguracja biblioteki UI (np. Shadcn/ui) oraz narzędzi do zarządzania stanem (Zustand/React Query).
*   **Zadanie 0.5: Konfiguracja CI/CD**
    *   Podstawowa konfiguracja pipeline'u na Vercel (dla frontendu) i GitHub Actions (dla backendu – budowanie, testy).

### **Epik 1: Uwierzytelnianie i RBAC (zgodnie z PRD rozdz. 3)**

*   **Zadanie 1.1: Implementacja Modułu Użytkowników (Backend)**
    *   Rozszerzenie schemy Prisma o modele `User`, `Role`, `Permission`.
    *   Stworzenie endpointów API (NestJS) do rejestracji, logowania (JWT) i zarządzania użytkownikami.
    *   Implementacja strategii uwierzytelniania za pomocą `Passport.js`.
*   **Zadanie 1.2: Implementacja Strażników (Guards) RBAC (Backend)**
    *   Stworzenie dekoratorów i strażników w NestJS do zabezpieczania endpointów na podstawie ról zdefiniowanych w PRD.
*   **Zadanie 1.3: Stworzenie Widoków Logowania i Rejestracji (Frontend)**
    *   Zbudowanie formularzy w Next.js/React.
    *   Implementacja logiki komunikacji z API backendowym.

### **Epik 2: Moduł Zapisów i Zawodów (Moduł A z PRD)**

*   **Zadanie 2.1: Model Danych (Backend)**
    *   Rozbudowa schemy Prisma o modele: `Meeting`, `Event` (konkurencja), `Entry` (zgłoszenie), `Athlete`, `Club`.
*   **Zadanie 2.2: API do Zarządzania Zawodami (Backend)**
    *   Stworzenie endpointów CRUD w NestJS dla Organizatora do zarządzania zawodami i konkurencjami.
*   **Zadanie 2.3: Logika Zgłoszeń (Backend)**
    *   Implementacja publicznego endpointu do przyjmowania zgłoszeń.
    *   Dodanie walidacji (limity, minima, kategorie wiekowe) za pomocą `class-validator`.
*   **Zadanie 2.4: Interfejs Użytkownika (Frontend)**
    *   Stworzenie panelu Organizatora do zarządzania zawodami.
    *   Zbudowanie publicznego formularza zgłoszeniowego.

### **Epik 3: Program i Listy Startowe (Moduły B i C z PRD)**

*   **Zadanie 3.1: API do Zarządzania Programem Minutowym (Backend)**
    *   Stworzenie endpointów do budowania i publikacji programu zawodów.
*   **Zadanie 3.2: Logika Generowania List Startowych (Backend)**
    *   Implementacja serwisu w NestJS odpowiedzialnego za seeding (losowy/manualny dla MVP).
    *   Operacja generowania list musi być delegowana do zadania w tle (BullMQ), aby spełnić cel jakościowy (<10s dla 500+ zawodników).
*   **Zadanie 3.3: Interfejs Użytkownika (Frontend)**
    *   Stworzenie interaktywnego widoku do zarządzania programem minutowym.
    *   Stworzenie panelu do generowania i podglądu list startowych.

### **Epik 4: Integracja Plikowa (MVP) (zgodnie z PRD rozdz. 9.3)**

*   **Zadanie 4.1: Stworzenie Modułu `FileMappingEngine` (Backend)**
    *   Zaprojektowanie modularnej struktury w NestJS, która będzie odpowiedzialna za wszystkie operacje plikowe.
*   **Zadanie 4.2: Implementacja Eksportu CSV (format oficjalny)**
    *   Stworzenie serwisu i endpointu.
    *   Wykorzystanie biblioteki `papaparse` do generowania plików CSV zgodnie ze specyfikacją z PRD 9.3.1.
*   **Zadanie 4.3: Implementacja Importu CSV (format federacyjny)**
    *   Stworzenie endpointu do uploadu pliku.
    *   Wykorzystanie `iconv-lite` do konwersji kodowania `Windows-1250`.
    *   Implementacja logiki mapowania kolumn (`Impreza` -> `MeetingName` itd.).
    *   Przetwarzanie pliku jako zadanie w tle (BullMQ) z generowaniem raportu końcowego.
*   **Zadanie 4.4: Implementacja Eksportu EVT dla FinishLynx**
    *   Stworzenie serwisu generującego plik `.evt` linia po linii, używając wbudowanych modułów Node.js (`fs`).
    *   Implementacja logiki blokującej eksport, jeśli lista startowa jest w stanie "dirty" (PRD 9.3.3).

---

## 4. Faza 2: Rozszerzenie Funkcjonalne

**Cel:** Automatyzacja przepływu danych z FinishLynx, obsługa zaawansowanych scenariuszy sportowych i zwiększenie wartości produktu.

| Epik | Opis | Kluczowe Technologie |
| :--- | :--- | :--- |
| **5. Pełna Integracja FinishLynx** | Automatyczny import wyników (LIF) i synchronizacja harmonogramu (SCH). | NestJS, BullMQ, Node.js `fs`/`readline` |
| **6. Automatyzacja Sportowa** | Implementacja automatycznych awansów i zaawansowanych reguł WA. | NestJS |
| **7. Wieloboje** | Rozbudowa systemu o obsługę konkurencji łączonych i wielobojów. | NestJS, Prisma, Next.js |

---

### **Epik 5: Pełna Integracja FinishLynx (zgodnie z PRD rozdz. 9.3)**

*   **Zadanie 5.1: Implementacja Importu Plików LIF (Backend)**
    *   Rozbudowa `FileMappingEngine` o parser plików `.lif`.
    *   Przetwarzanie plików linia po linii za pomocą `readline` dla maksymalnej wydajności.
    *   Implementacja **krytycznej logiki mapowania** wyników na `StartListEntry` na podstawie kombinacji `EventId`, `Round`, `Heat`, `Lane`, `Bib` (PRD 9.3.5).
    *   Operacja importu musi być zadaniem w tle (BullMQ) i generować szczegółowy raport.
*   **Zadanie 5.2: Implementacja Synchronizacji Harmonogramu (SCH)**
    *   Dodanie funkcjonalności importu/eksportu plików `.sch` w celu weryfikacji i synchronizacji programu minutowego.

### **Epik 6: Automatyzacja Sportowa**

*   **Zadanie 6.1: Logika Automatycznych Awansów (Q/q) (Backend)**
    *   Stworzenie serwisu, który po zaimportowaniu wyników z rundy (np. eliminacji) automatycznie generuje listy startowe dla kolejnej rundy na podstawie zdefiniowanych reguł (np. 2Q + 2q).
*   **Zadanie 6.2: Implementacja Zaawansowanych Reguł Seedingowych**
    *   Rozbudowa mechanizmu generowania list startowych o reguły zgodne z wytycznymi World Athletics (np. "wężyk").

### **Epik 7: Wieloboje**

*   **Zadanie 7.1: Rozbudowa Modelu Danych (Backend)**
    *   Aktualizacja schemy Prisma o relacje i pola niezbędne do obsługi wielobojów (np. punkty za konkurencję, suma punktów).
*   **Zadanie 7.2: Implementacja Tabel Punktowych (Backend)**
    *   Integracja lub implementacja logiki przeliczania wyników na punkty zgodnie z oficjalnymi tabelami WA.
*   **Zadanie 7.3: Aktualizacja Interfejsu Użytkownika (Frontend)**
    *   Dostosowanie widoków list startowych i wyników do specyfiki wielobojów.

---

## 5. Wymagania Horyzontalne (Ciągłe)

Zadania realizowane równolegle w trakcie trwania całego projektu.

*   **Testowanie:**
    *   **Testy jednostkowe (Unit Tests):** Każdy serwis i kluczowa funkcja w NestJS musi mieć pokrycie testami (np. za pomocą Jest).
    *   **Testy integracyjne (Integration Tests):** Testowanie współpracy modułów i endpointów API (np. za pomocą Supertest).
    *   **Testy E2E (End-to-End):** Symulacja pełnych przepływów użytkownika (np. od rejestracji do publikacji wyników) za pomocą Cypress lub Playwright.
*   **Bezpieczeństwo:**
    *   Regularne audyty zależności (npm audit).
    *   Zabezpieczenie API przed typowymi atakami (CORS, CSRF, XSS, SQL Injection - Prisma pomaga).
    *   Walidacja wszystkich danych wejściowych.
*   **Dokumentacja:**
    *   Automatyczne generowanie dokumentacji API za pomocą modułu Swagger w NestJS.
    *   Prowadzenie dokumentacji kluczowych decyzji architektonicznych.