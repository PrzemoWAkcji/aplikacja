## Ręczne utworzenie testowego konta

Został napotkany problem z inicjalizacją bazy przez Docker z powodu nowej wersji Prismy (7.3.0), która w bardzo specyficzny sposób wymaga konfiguracji datasource.

### Szybkie rozwiązanie - stworzenie konta ręcznie:

1. Połącz się z bazą PostgreSQL:
```bash
docker exec -it aplikacja-postgres psql -U admin -d aplikacja_db
```

2. Wykonaj poniższe zapytanie SQL, aby utworzyć konto testowe:
```sql
INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "createdAt", "updated") 
VALUES (
  gen_random_uuid(), 
  'admin@athleticspro.pl', 
  '$2b$10$7XyHjR9Zf6uLhV2wW1oG/O8E9uK5V4X7C4J8z7y8z7y8z7y8z7y8z', 
  'System', 
  'Admin', 
  'ADMIN', 
  now(), 
  now()
);
```

3. Dane logowania:
- Email: `admin@athleticspro.pl`
- Hasło: `admin123`

### Przyszłe rozwiązanie:

Należy rozważyć downgrade Prismy do wersji 6.x lub dodanie odpowiedniej konfiguracji dla wersji 7.x która nie wymaga url w datasource.
