INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "role", "createdAt", "updatedAt") 
VALUES (
  'admin-uuid-1', 
  'admin@athleticspro.pl', 
  '$2b$10$76.f/F/01v8nO7p7L9B1BeXn0zX8zX8zX8zX8zX8zX8zX8zX8zX8zX', 
  'System', 
  'Admin', 
  'ADMIN', 
  NOW(), 
  NOW()
) ON CONFLICT (email) DO NOTHING;
