# Integracja Roster Athletics - Dokumentacja

## Przegląd

Aplikacja jest teraz w pełni zintegrowana z systemem Roster Athletics, umożliwiając import i eksport danych w formacie CSV zgodnym z Roster Athletics.

## Funkcje

### 1. Automatyczne generowanie EventCode

Podczas tworzenia nowej konkurencji, kod Roster Athletics (eventCode) jest automatycznie generowany na podstawie nazwy konkurencji:

**Biegi:**
- "60 metrów" → `60`
- "100 metrów" → `100`
- "60 metrów przez płotki" → `60H`
- "100 metrów przez płotki" → `100H`
- "110 metrów przez płotki" → `110H`
- "400 metrów przez płotki" → `400H`
- etc.

**Konkurencje techniczne:**
- "Skok wzwyż" → `HJ` (High Jump)
- "Skok o tyczce" → `PV` (Pole Vault)
- "Skok w dal" → `LJ` (Long Jump)
- "Trójskok" → `TJ` (Triple Jump)
- "Pchnięcie kulą" → `SP` (Shot Put)
- "Rzut dyskiem" → `DT` (Discus Throw)
- "Rzut oszczepem" → `JT` (Javelin Throw)
- "Rzut młotem" → `HT` (Hammer Throw)

**Sztafety:**
- "4x100 metrów" → `4x100`
- "4x400 metrów" → `4x400`

Możesz ręcznie edytować automatycznie wygenerowany kod.

### 2. Konfigurowalne wysokości dla skoków pionowych

Podczas tworzenia konkurencji skok wzwyż (HJ) lub skok o tyczce (PV), pojawia się dodatkowe pole do wprowadzenia wysokości:

```
Wysokości: 1.40, 1.45, 1.50, 1.55, 1.60, 1.65, 1.70
```

Wysokości wprowadza się jako listę wartości oddzielonych przecinkami. Te wysokości będą:
- Zapisane w bazie danych jako JSON
- Wyświetlone w protokołach sędziowskich
- Wyeksportowane do Roster Athletics

### 3. Import/Eksport Roster Athletics CSV

#### Import Zgłoszeń
1. Przejdź do szczegółów mityngu
2. Kliknij przycisk **"Import Roster (Zgłoszenia)"**
3. Wybierz plik CSV z Roster Athletics
4. System automatycznie:
   - Utworzy brakujące konkurencje na podstawie eventCode
   - Zaimportuje wszystkie zgłoszenia z kompletnymi danymi (imię, nazwisko, klub, data urodzenia, etc.)
   - Dopasuje istniejące zgłoszenia po entryId lub startListId

#### Import Wyników
1. Kliknij przycisk **"Import Roster (Wyniki)"**
2. Wybierz plik CSV z wynikami z Roster Athletics
3. System automatycznie zaktualizuje wyniki dla wszystkich zawodników, w tym:
   - Miejsca (ogólne i w kategoriach płci)
   - Czasy/odległości/wysokości
   - Wyniki poszczególnych prób (dla konkurencji technicznych)
   - Wiatr

#### Eksport Zgłoszeń
1. Kliknij przycisk **"Eksport Roster (Zgłoszenia)"**
2. Pobierz plik CSV zgodny z formatem Roster Athletics
3. Plik zawiera:
   - Wszystkie dane zawodników (imię, nazwisko, data urodzenia, klub, kraj)
   - Dane konkurencji (eventCode, ageGroup, stage)
   - Dane wydajnościowe (PB, SB, seedingResult)

#### Eksport Wyników
1. Kliknij przycisk **"Eksport Roster (Wyniki)"**
2. Pobierz plik CSV z wynikami zgodny z formatem Roster Athletics
3. Plik zawiera wszystkie dane ze zgłoszeń oraz:
   - Miejsca (Place, PlaceGender)
   - Wyniki (Result, ResultRounded)
   - Wyniki prób Round1-6 (dla konkurencji technicznych)
   - Pomiary wiatru

### 4. Rozszerzona baza danych

#### Event (Konkurencja)
Nowe pola:
- `eventCode` - kod Roster Athletics (np. "100", "HJ", "SP")
- `ageGroup` - grupa wiekowa (np. "U18", "U20", "Senior")
- `stage` - etap konkurencji ("Final", "Heat", "Semi-Final", "Qualification")
- `heights` - wysokości dla skoków pionowych (JSON array jako string)

#### Entry (Zgłoszenie)
Nowe pola:
- `firstName`, `middleName`, `lastName` - podzielone imię i nazwisko
- `countryCode` - kod kraju (domyślnie "POL")
- `dateOfBirth` - pełna data urodzenia
- `yearOfBirth` - rok urodzenia
- `gender` - płeć zawodnika (może różnić się od płci konkurencji dla mixów)
- `tilastopajaId` - ID z systemu Tilastopaja (dla Fińskich zawodów)
- `entryId` - ID zgłoszenia z Roster Athletics
- `startListId` - ID listy startowej z Roster Athletics
- `seedingResult` - wynik do rozstawienia

#### Result (Wynik)
Nowe pola:
- `placeGender` - miejsce w kategorii płci
- `resultRounded` - wynik zaokrąglony
- `windReading` - pomiar wiatru
- `round1Result` do `round6Result` - wyniki poszczególnych prób
- `bestResult` - najlepszy wynik z prób

### 5. Zaktualizowany importer federacyjny

Istniejący importer CSV z federacji został rozszerzony aby wykorzystywać nowe pola Roster:

**Rozpoznawane kolumny:**
- `Imię`, `Nazwisko` - parsowane do firstName/lastName
- `DataUrodzenia` - parsowana do dateOfBirth i yearOfBirth
- `RokUrodzenia` - parsowany do yearOfBirth (jeśli brak pełnej daty)
- `KrajKod` - kod kraju (domyślnie "POL")

System automatycznie:
1. Parsuje pełne imię i nazwisko z kolumny "Imię i Nazwisko" jeśli osobne kolumny nie istnieją
2. Wyciąga rok urodzenia z pełnej daty urodzenia
3. Przypisuje płeć na podstawie płci konkurencji (chyba że MIX)

## API Endpoints

### Import
```
POST /roster/import/entries/:meetingId
Content-Type: multipart/form-data
Body: file (CSV)
```

```
POST /roster/import/results/:meetingId
Content-Type: multipart/form-data
Body: file (CSV)
```

### Eksport
```
GET /roster/export/entries/:meetingId
Response: text/csv
```

```
GET /roster/export/results/:meetingId
Response: text/csv
```

## Format CSV Roster Athletics

### Zgłoszenia (Entries)
Wymagane kolumny:
- `MeetingId`, `EntryId`, `StartListId`
- `FullName`, `FirstName`, `MiddleName`, `LastName`
- `Gender`, `CountryCode`, `DateOfBirth`, `YearOfBirth`
- `EventCode`, `EventStage`, `AgeGroup`
- `ShortClubName`, `ClubName`
- `BibNumber`, `Lane`, `EventGroup`
- `PersonalBest`, `SeasonBest`, `SeedingResult`

### Wyniki (Results)
Wszystkie kolumny ze zgłoszeń plus:
- `Place`, `PlaceGender`
- `Result`, `ResultRounded`
- `WindReading`
- `Round1Result`, `Round2Result`, ..., `Round6Result`
- `Round1Wind`, `Round2Wind`, ..., `Round6Wind`

## Przykłady użycia

### Tworzenie konkurencji ze skokiem wzwyż
1. Kliknij "+" przy listach konkurencji
2. Nazwa: "Skok wzwyż kobiet"
3. Kod: "HJ_K"
4. Płeć: Kobiety
5. Kod Roster: "HJ" (auto-generowany)
6. Grupa wiekowa: "U18" (opcjonalnie)
7. Etap: "Finał"
8. Wysokości: "1.40, 1.45, 1.50, 1.55, 1.60, 1.65, 1.70"
9. Kliknij "Dodaj"

### Import danych z Roster Athletics
1. Eksportuj dane z Roster Athletics jako CSV
2. W aplikacji, przejdź do mityngu
3. Kliknij "Import Roster (Zgłoszenia)"
4. Wybierz pobrany plik CSV
5. Poczekaj na potwierdzenie importu
6. Zgłoszenia pojawią się automatycznie w odpowiednich konkurencjach

### Eksport wyników do Roster Athletics
1. Po zakończeniu zawodów, przejdź do mityngu
2. Kliknij "Eksport Roster (Wyniki)"
3. Zapisz plik CSV
4. Zaimportuj plik w Roster Athletics

## Protokoły sędziowskie

Protokoły automatycznie dostosowują się do typu konkurencji:

### Skoki pionowe (HJ, PV)
```
Lp. | Nr | Zawodnik/Klub | 1.40 | 1.45 | 1.50 | 1.55 | 1.60 | Wynik | Msc
```

### Rzuty i skoki poziome (SP, DT, JT, HT, LJ, TJ)
```
Lp. | Nr | Zawodnik/Klub | 1 | 2 | 3 | 4 | 5 | 6 | Najl. | Msc
```

### Biegi
```
Tor | Nr | Zawodnik/Klub | Wynik | Wiatr | Msc | Uwagi
```

## Wsparcie
Wszystkie wartości są opcjonalne - system działa również bez pełnych danych Roster. Pola Roster są wykorzystywane tylko gdy dostępne.
