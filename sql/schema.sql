-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Note: To create a user, either use the /api/register endpoint provided by the server
-- or insert a bcrypt-hashed password directly here. For example, register via the API:
-- POST /api/register { "email": "you@example.com", "password": "yourPassword" }
