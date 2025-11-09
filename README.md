# Auth Backend

Simple Express backend for handling register and login using PostgreSQL.

## Prerequisites
- Node.js (LTS recommended)
- PostgreSQL running and accessible

## Setup
1. Copy `.env.example` (if present) to `.env` and fill the DB and JWT values.
2. Install dependencies:

       npm install

   or, if you prefer pnpm:

       pnpm install

3. (Optional) Create the database schema. A minimal schema is available at `sql/schema.sql`.
   Example using psql with `DATABASE_URL`:

       psql "$DATABASE_URL" -f sql/schema.sql

## Run
- Development with live reload (nodemon):

      npm run dev

- Production:

      npm start

## Startup behavior
On start the server will check connectivity to the PostgreSQL database by running a simple `SELECT 1` query. If the DB is unreachable the process will log an error and exit. This prevents the HTTP server from starting when the database is not available.

## Configuration / Environment variables
Place configuration in a `.env` file in `backend/` (do NOT commit `.env`):

- `DATABASE_URL` - optional full Postgres connection string (preferred when set).
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` - alternative to `DATABASE_URL`.
- `DB_SSL` - `true` to enable TLS for DB connections.
- `DB_SSL_REJECT_UNAUTHORIZED` - set to `false` to allow self-signed certs (use with caution).
- `JWT_SECRET` - secret used to sign JWTs (set to a strong value in production).
- `FRONTEND_ORIGIN` - origin allowed for CORS (default: `http://localhost:3000`).
- `PORT` - server port (default: `4000`).
- `NODE_ENV` - `development` or `production`.

## Endpoints
- `GET /api/health` — simple health check
- `POST /api/register` — body: `{ email, password }` (creates a new user)
- `POST /api/login` — body: `{ email, password }` (sets an httpOnly `token` cookie and returns user info)
- `GET /api/me` — reads the `token` cookie and returns the authenticated user
- `POST /api/logout` — clears the `token` cookie

## Notes on authentication
- The server sets an HTTP-only cookie named `token` with the JWT on successful login. This cookie is used by `/api/me` to authenticate.
- Cookies use `sameSite: 'lax'` and will use `secure: true` in production (when `NODE_ENV === 'production'`).

## Troubleshooting
- If the server exits at startup, check DB connectivity and your database env variables.
- For DB SSL issues, toggle `DB_SSL` and `DB_SSL_REJECT_UNAUTHORIZED` appropriately (be careful in production).

## License
Add license information here if applicable.

## Deploy to Render

Quick steps to deploy the backend to Render:

1. Push your repository to GitHub (or connect your Git provider) and ensure `render.yaml` is in the repo root.
2. Open the Render dashboard and create a new service by connecting the repo/branch. Render will detect `render.yaml` and can create the services automatically.
3. For the backend service (named `ex-backend` in `render.yaml`) add the following secrets in Render's dashboard:
      - `DATABASE_URL` (your Postgres connection string)
      - `JWT_SECRET` (a strong secret for signing tokens)

4. Optionally set the `FRONTEND_ORIGIN` env var in Render to your frontend URL (for example `https://ex-frontend.onrender.com`) so CORS is restricted to your frontend.

Notes:
- Do NOT commit secret values into the repository. Use Render's Secrets to store `DATABASE_URL` and `JWT_SECRET`.
- Render will provide a public URL like `https://<service-name>.onrender.com`. The `render.yaml` uses `ex-backend`/`ex-frontend` as names; you can change them if you prefer a different subdomain.
- After deployment, double-check logs in Render if the service fails to start (common issues: missing secrets, DB connectivity, Node version mismatch).
