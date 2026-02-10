Na podstawie zaktualizowanego dokumentu PRD (wersja 1.1), który kładzie silny nacisk na integrację plikową (CSV, EVT, LIF), zaawansowane mapowanie danych oraz obsługę specyficznych formatów i kodowań, poniżej przedstawiam szczegółowy, rekomendowany stos technologiczny w formacie Markdown.

---

# Stos technologiczny: Webowa aplikacja do obsługi zawodów lekkoatletycznych

Poniższy dokument opisuje rekomendowany stos technologiczny do realizacji aplikacji, zgodnie z wymaganiami określonymi w PRD v1.1. Wybór został podyktowany potrzebą stworzenia systemu wydajnego, bezpiecznego, skalowalnego i łatwego w utrzymaniu, z kluczowym naciskiem na architekturę API-first oraz zaawansowane przetwarzanie danych.

### **Podsumowanie**

| Warstwa | Technologia / Biblioteka | Przeznaczenie |
| :--- | :--- | :--- |
| **Język programowania** | **TypeScript** | Bezpieczeństwo typów w całym stosie, mniejsza liczba błędów. |
| **Frontend** | **Next.js (React)** | Interfejs użytkownika (UI), responsywność, SEO. |
| **Backend** | **NestJS (Node.js)** | API, logika biznesowa, integracje, przetwarzanie plików. |
| **Baza danych** | **PostgreSQL** | Niezawodność, transakcyjność, przechowywanie danych relacyjnych. |
| **ORM** | **Prisma** | Bezpieczna i wydajna komunikacja z bazą danych. |
| **Przetwarzanie w tle** | **BullMQ + Redis** | Asynchroniczne generowanie list startowych i obsługa importu/eksportu. |
| **Infrastruktura** | **Docker, Vercel, AWS/GCP** | Konteneryzacja, wdrożenie i skalowalność. |

---

## 1. Backend

Sercem aplikacji będzie serwis backendowy odpowiedzialny za logikę biznesową, API oraz, co kluczowe, integracje plikowe.

*   **Framework: NestJS**
    *   **Uzasadnienie:** Jego modularna architektura idealnie pasuje do wymagań projektu. Umożliwia stworzenie dedykowanego modułu `FileMappingEngine` (wymóg 9.3.6), który będzie hermetyzował logikę parsowania, walidacji i mapowania plików CSV, EVT oraz LIF. NestJS wspiera natywnie podejście API-first i ułatwia implementację ról (RBAC) oraz logów audytowych.

*   **Środowisko uruchomieniowe: Node.js**
    *   **Uzasadnienie:** Wydajne, nieblokujące I/O jest kluczowe dla obsługi operacji plikowych oraz dużej liczby zapytań API w dniu zawodów.

*   **Zarządzanie zadaniami w tle: BullMQ + Redis**
    *   **Uzasadnienie:** Spełnia wymaganie NFR dotyczące operacji masowych bez blokowania UI. Procesy takie jak "Generowanie list startowych dla 500+ zawodników" (cel 5) oraz import/eksport plików będą delegowane do kolejek BullMQ. Zapewni to responsywność aplikacji i niezawodność przetwarzania.

## 2. Frontend

Interfejs użytkownika musi być nowoczesny, responsywny (web-first) i intuicyjny.

*   **Framework: Next.js (z użyciem React)**
    *   **Uzasadnienie:** Zapewnia doskonałą wydajność dzięki renderowaniu po stronie serwera (SSR) dla publicznych widoków (program, listy startowe), co jest korzystne dla SEO. Bogaty ekosystem Reacta ułatwi budowę złożonych komponentów, takich jak interaktywny edytor list startowych.

*   **Biblioteka komponentów UI: Shadcn/ui lub Material UI (MUI)**
    *   **Uzasadnienie:** Dostarczają gotowe, konfigurowalne i dostępne (accessibility) komponenty, które znacznie przyspieszą budowę interfejsu. Wybór zależy od preferencji projektowych, przy czym Shadcn/ui oferuje większą elastyczność dzięki budowie na Tailwind CSS i Radix UI.

*   **Zarządzanie stanem: Zustand / React Query**
    *   **Uzasadnienie:** Lekkie i efektywne biblioteki do zarządzania stanem globalnym i serwerowym, co jest kluczowe dla utrzymania spójności danych w interfejsie użytkownika.

## 3. Baza danych

System musi gwarantować spójność i integralność danych, zwłaszcza w kontekście zapisów, płatności i wyników.

*   **System: PostgreSQL**
    *   **Uzasadnienie:** Dojrzały, w pełni transakcyjny (ACID) system bazodanowy, który gwarantuje spójność operacji (wymóg 7). Jego elastyczność i skalowalność są idealne dla rosnącej aplikacji.

*   **ORM (Object-Relational Mapper): Prisma**
    *   **Uzasadnienie:** Zapewnia pełne bezpieczeństwo typów (end-to-end type safety) między bazą danych a kodem aplikacji w TypeScript. Znacząco upraszcza i zabezpiecza operacje na bazie danych, minimalizując ryzyko błędów SQL.

## 4. Kluczowe biblioteki i narzędzia (Backend)

Realizacja specyficznych wymagań z sekcji 9.3 PRD wymaga użycia wyspecjalizowanych bibliotek.

*   **Obsługa CSV: `papaparse` lub `fast-csv`**
    *   **Uzasadnienie:** Wydajne i sprawdzone biblioteki do parsowania i generowania plików CSV. Umożliwią implementację mapowania kolumn oraz walidacji danych zgodnie z wymaganiami.

*   **Obsługa kodowania znaków: `iconv-lite`**
    *   **Uzasadnienie:** Kluczowa biblioteka do obsługi importu plików CSV w formacie `Windows-1250` / `Latin-1` (wymóg 9.3.2). Jest to standardowe rozwiązanie w ekosystemie Node.js do konwersji kodowań.

*   **Obsługa plików EVT/SCH/LIF: Własny parser oparty o wbudowany moduł `fs` i `readline`**
    *   **Uzasadnienie:** Formaty te mają prostą, liniową strukturę. Można je efektywnie przetwarzać linia po linii przy użyciu wbudowanych modułów Node.js, co minimalizuje zależności i zapewnia maksymalną wydajność.

*   **Walidacja danych: `class-validator` i `class-transformer`**
    *   **Uzasadnienie:** Biblioteki te, głęboko zintegrowane z NestJS, pozwolą na deklaratywną walidację danych przychodzących z API oraz z importowanych plików, co jest kluczowe dla utrzymania jakości danych (cel 5).

*   **Bezpieczeństwo (uwierzytelnianie): `Passport.js`**
    *   **Uzasadnienie:** Standard branżowy do implementacji uwierzytelniania w Node.js. Jego modularna budowa (strategie) ułatwi obsługę logowania i zabezpieczenie API zgodnie z rolami (RBAC).

## 5. Infrastruktura i DevOps

Aplikacja musi być niezawodna, szczególnie w "event day".

*   **Konteneryzacja: Docker**
    *   **Uzasadnienie:** Zapewnia spójne i przenośne środowiska programistyczne, testowe i produkcyjne. Upraszcza proces wdrożenia i skalowania poszczególnych serwisów (backend, baza danych, Redis).

*   **Hosting Frontend: Vercel**
    *   **Uzasadnienie:** Platforma zoptymalizowana pod Next.js, oferująca globalną sieć CDN, automatyczne CI/CD i wysoką wydajność, co jest kluczowe dla szybkiego dostarczania treści publicznych.

*   **Hosting Backend i Bazy Danych: AWS (np. ECS/Fargate + RDS) / Google Cloud / Render**
    *   **Uzasadnienie:** Wiodący dostawcy chmurowi oferują skalowalność, zarządzane bazy danych (RDS dla PostgreSQL) i narzędzia niezbędne do zapewnienia wysokiej dostępności (SLA) i niezawodności systemu.

---