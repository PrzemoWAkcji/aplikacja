# PRD – Webowa aplikacja do obsługi zawodów lekkoatletycznych  
**Zakres: Zapisy → Program minutowy → Listy startowe / rozstawianie → integracja z FinishLynx**

**Wersja:** 1.1  
**Data:** 2026-02-10  
**Status:** Draft

---

## 1. Cel produktu

Celem jest stworzenie nowoczesnej, bezpiecznej i wydajnej webowej aplikacji do organizacji i obsługi zawodów lekkoatletycznych (biegi, skoki, rzuty, wieloboje) w skali od lokalnej (50–200 zawodników) do krajowej (500+ zawodników).

Aplikacja musi:

- umożliwiać zapisy online przez formularz przypięty do konkretnych zawodów,
- wspierać tworzenie i publikację programu minutowego,
- generować listy startowe oraz rozstawiać zawodników zgodnie z zasadami lekkoatletyki,
- integrować się z FinishLynx (wymiana danych: listy startowe, wyniki),
- zapewniać prawidłowość danych i estetykę publikowanych wyników,
- być zgodna z przepisami World Athletics,
- działać w modelu subskrypcyjnym.

---

## 2. Zakres (In Scope / Out of Scope)

### 2.1 In Scope

**Moduły:**

1. Zapisy na zawody (online)
2. Program minutowy
3. Lista startowa + rozstawianie zawodników
4. Import / eksport plików list startowych i wyników

**Integracje:**

- FinishLynx (EVT / SCH / LIF)
- Import / eksport CSV (wyniki, listy startowe, archiwizacja)
- Publiczne API + webhooki

### 2.2 Out of Scope (na teraz)

- Pełny moduł wyników dla konkurencji technicznych (próby, progresje, wysokości)
- Protesty, komisje, odwołania
- Akredytacje stadionowe
- Obsada sędziowska i zasoby (sprzęt)
- Aplikacje natywne

---

## 3. Role (RBAC)

- Organizator
- Sekretariat / obsługa techniczna
- Sędzia
- Trener / menedżer klubu
- Zawodnik
- Public (read-only)

---

## 4. Założenia

- Web-first, API-first.
- Pełna obsługa znaków diakrytycznych.
- Architektura przygotowana pod wieloboje i konkurencje łączone.
- Jednoznaczne identyfikatory zawodów, konkurencji, rund i serii – krytyczne dla integracji plikowej.

---

## 5. Cele biznesowe i jakościowe

- ≥95% zgłoszeń bez wsparcia helpdesku
- <1% ręcznych korekt danych
- Generowanie list dla 500+ zawodników ≤10 s
- Brak ręcznego przepisywania list do FinishLynx
- Spójne, estetyczne eksporty wyników

---

# 6. Wymagania funkcjonalne

---

## Moduł A – Zapisy na zawody

*(bez zmian względem wersji 1.0 – skrócone)*

- konfiguracja eventu i konkurencji
- formularz zgłoszeń online
- walidacje kategorii, limitów, minimów
- statusy zgłoszeń
- waitlist
- płatności (wg pakietu)
- eksport CSV/XLSX
- webhooki

---

## Moduł B – Program minutowy

*(bez zmian merytorycznych)*

- program manualny
- publikacja
- wersjonowanie
- sugestie liczby serii po zamknięciu zapisów

---

## Moduł C – Lista startowa i rozstawianie

*(bez zmian merytorycznych)*

- generowanie serii
- seeding
- przydział torów
- awanse Q/q
- publikacja list
- integracja FinishLynx

---

# 7. Wymagania niefunkcjonalne (NFR)

*(bez zmian względem wersji 1.0)*

---

# 8. Model danych – high level

*(bez zmian względem wersji 1.0)*

---

# 9. Integracje, API oraz formaty plików

---

## 9.1 API

*(jak w wersji 1.0)*

---

## 9.2 FinishLynx – kanały wymiany

System musi obsługiwać natywną integrację plikową:

- eksport list startowych → pliki **EVT**
- import harmonogramu (opcjonalnie) → pliki **SCH**
- import wyników biegów → pliki **LIF**

Każdy eksport i import musi być powiązany z:

- EventId
- CompetitionId
- RoundId
- HeatId

---

# 9.3 Standard plików i kolumn (krytyczna funkcjonalność)

Na podstawie dostarczonych plików referencyjnych:

- EVT (FinishLynx – listy startowe)
- SCH (FinishLynx – harmonogram)
- LIF (FinishLynx – wyniki biegów)
- CSV – wyniki/listy startowe (format archiwalny / publikacyjny)

system MUSI posiadać warstwę mapowania kolumn.

Celem jest:

- zachowanie kompletności danych,
- prawidłowe przypisanie wyników do zawodnika,
- estetyczne i kompletne raporty wyników.

---

## 9.3.1 CSV – oficjalny format eksportu wyników i list startowych

System musi umożliwiać eksport oraz import CSV o strukturze kompatybilnej z poniższym zakresem pól.

### Kolumny identyfikujące zawody

Wymagane:

- `MeetingId`
- `MeetingName`
- `MeetingDate`
- `VenueName`
- `City`
- `Country`
- `Season`

---

### Kolumny identyfikujące zawodnika i wpis

Wymagane:

- `EntryId` – unikalny wpis zawodnika do konkurencji
- `StartListId`
- `FullName`
- `FirstName`
- `LastName`
- `Gender`
- `CountryCode`
- `YearOfBirth`
- `DateOfBirth`
- `ClubName`
- `ShortClubName`
- `BibNumber`

Opcjonalne (jeśli dostępne):

- `TilastopajaId`
- `RelayId`
- `TeamName`
- `TeamGender`

---

### Kolumny identyfikujące konkurencję

Wymagane:

- `EventCode`
- `EventName`
- `EventGender`
- `AgeGroup`
- `EventStage`  (np. Heats / Semi / Final)
- `EventGroup`
- `HeatName`

Dodatkowe (jeżeli wykorzystywane przez federacje):

- `PZLAEventCode`
- `PZLAEventCodeNum`
- `UKAEventCode`
- `CombinedEventRelation`

---

### Kolumny seedingowe (listy startowe)

Wymagane:

- `PersonalBest`
- `SeasonBest`
- `SeedingResult`

---

### Kolumny startowe

Wymagane:

- `Lane`
- `PositionHeat`
- `StartStatus`

---

### Kolumny wynikowe (biegi)

Wymagane:

- `Result`
- `ResultRounded`
- `ResultNET`
- `ResultStatus`
- `Place`
- `PlaceGender`
- `BreakDownPlace`

---

### Kolumny wspomagające estetykę i publikację

Silnie zalecane:

- `ReactionTime`
- `WindReading`
- `Promotion`  (Q / q / DSQ / DNS / SCR)
- `ResultRecord` (np. NR, PB, SB)
- `ResultRecords`

---

### Kolumny dla wielobojów

- `CombinedPoints`

---

### Kolumny dla rund (jeżeli eksportowane wielorundowo)

- `Round1Status`
- `Round1Result`
- `Round1Record`
- `Round1Records`
- `Round1Attempts`
- `Round1TargetHeight`
- `Round1Wind`

---

## 9.3.2 CSV federacyjny (format PZLA / regionalny)

System musi obsługiwać import plików CSV w formacie średnikowym (semicolon separated), z kodowaniem:

- Windows-1250 / Latin-1

Minimalny zakres obsługiwanych kolumn:

Wymagane:

- `Impreza`
- `NrKonkur`
- `NazwaPZLA`
- `Pełna nazwa`
- `Runda`
- `Seria`
- `Tor`
- `Miejsce`
- `NrStart`
- `Nazwisko`
- `Imię`
- `DataUr`
- `Klub`
- `Wynik`
- `Wiatr`
- `SB`
- `PB`
- `NrZawodnika`
- `TOKEN`

Dodatkowe wspierane:

- `Licencja PZLA`
- `Licencja ważność`
- `Weryfikacja elektr.`
- `Trener`
- `Sztafeta`
- `skład`

System musi posiadać:

- mapowanie znaków narodowych (np. Imię / Pełna nazwa),
- normalizację nazw kolumn,
- walidację brakujących pól.

---

## 9.3.3 EVT – eksport list startowych do FinishLynx

System musi generować pliki EVT zawierające:

Dla każdej serii:

- identyfikator konkurencji
- identyfikator rundy
- numer serii
- numer toru
- numer startowy (Bib)
- imię i nazwisko
- klub
- kod kraju (jeżeli dostępny)

Minimalne dane logiczne wymagane w strukturze EVT:

- Event / Round / Heat
- Lane
- Bib
- LastName
- FirstName
- Club

System MUSI:

- zachować jednoznaczne mapowanie StartListEntry → rekord EVT,
- blokować eksport jeśli lista jest w stanie „dirty”.

---

## 9.3.4 SCH – eksport / import harmonogramu

System musi umożliwiać:

- generowanie SCH z programu minutowego,
- odczyt SCH w celu weryfikacji harmonogramu.

Minimalne dane:

- identyfikator konkurencji
- runda
- planowana godzina
- arena / lokalizacja

---

## 9.3.5 LIF – import wyników biegów z FinishLynx

System musi obsługiwać import plików LIF i mapować:

- konkurencję
- rundę
- serię
- tor

oraz:

- czas
- miejsce
- status zawodnika

na rekordy:

`StartListEntry`.

### Wymagania krytyczne

- import nie może opierać się wyłącznie na nazwisku,
- podstawą mapowania MUSI być:

  - kombinacja:
    - EventId
    - Round
    - Heat
    - Lane
    - Bib

---

### Importowane pola z LIF

Wymagane:

- czas biegu
- miejsce w serii
- status (OK / DNS / DQ / FS itp.)
- reaction time (jeśli dostępne)

Zalecane:

- wiatr (jeśli występuje w pliku)
- rekord (jeśli flagowany przez operatora)

---

## 9.3.6 Warstwa mapowania i walidacji

System musi posiadać osobny komponent:

**File Mapping Engine**

odpowiedzialny za:

- mapowanie kolumn CSV ↔ model domenowy,
- mapowanie rekordów LIF ↔ StartListEntry,
- walidację:

  - braków danych,
  - konfliktów torów / numerów startowych,
  - duplikatów wpisów.

Każdy import musi generować raport:

- liczba rekordów poprawnie zaimportowanych,
- liczba odrzuconych,
- lista błędów.

---

## 9.3.7 Estetyka wyników (wymaganie produktowe)

System MUSI zapewniać:

- poprawną prezentację:

  - imię + nazwisko,
  - klub,
  - wynik,
  - wiatr,
  - reakcja,
  - kwalifikacja (Q/q),

- spójne formatowanie czasów:

  - ss.hh
  - mm:ss.hh

- jednolity sposób prezentacji rekordów:

  - PB
  - SB
  - NR
  - CR

---

# 10. Edge case’y i ryzyka

*(jak w wersji 1.0 + dodatkowo)*

- niezgodność torów między EVT i LIF,
- zmiana listy startowej po eksporcie do FinishLynx,
- import wyników do nieaktualnej wersji list,
- brak numerów startowych w danych wejściowych.

---

# 11. Model subskrypcyjny

*(jak w wersji 1.0, bez zmian merytorycznych)*

---

# 12. MVP vs Phase 2

## MVP (rozszerzony o pliki)

- Zapisy online
- Program minutowy
- Listy startowe + seeding manual/losowy
- Eksport CSV
- Import CSV federacyjny
- Integracja plikowa EVT (export)
- RBAC + audyt

## Phase 2

- LIF import (pełny, automatyczny)
- SCH synchronizacja
- Automatyczne awanse z LIF
- Zaawansowane reguły WA
- Wieloboje i konkurencje łączone

---

# 13. Kryteria akceptacji (E2E)

1. Organizator tworzy zawody i uruchamia zapisy.
2. Zawodnicy zgłaszają się online.
3. Organizator publikuje program.
4. Sekretariat generuje listy startowe.
5. System eksportuje EVT.
6. FinishLynx zapisuje LIF.
7. System importuje LIF.
8. System poprawnie przypisuje wyniki do zawodników i generuje kolejną rundę.

---
