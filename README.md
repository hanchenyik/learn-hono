# PetitBakery

PetitBakery is a Cloudflare Pages storefront with Supabase Auth/Postgres and a Hono API. The browser uses only the Supabase publishable key; the Hono Worker keeps the Supabase secret key and is the trusted path for checkout and admin data.

## Setup

1. Create a Supabase project and configure its Auth redirect URLs for `http://localhost:8788/verify/`, `http://localhost:8788/reset-password/`, `https://petitbakery.pages.dev/verify/`, and `https://petitbakery.pages.dev/reset-password/`.
2. Copy `.env.example` to `.env` and fill every value. Do not commit it. For a manual migration, use the Supabase connection string and percent-encode special characters in its password: `npx supabase db push --db-url "postgresql://postgres:ENCODED_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"`.
3. Apply the fresh schema and seed with that command.
4. Put `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the Worker secret store. The production storefront is `https://petitbakery.pages.dev` and its API is `https://petitbakery-api.velozz.workers.dev`; the deployment workflow writes the browser-safe URL and publishable key configuration.
5. On macOS or Windows, install Node 22, run `npm ci --prefix backend`, then `npm start`. This starts the Hono API at `http://localhost:8787` and the static storefront at `http://localhost:8788`; press Ctrl+C to stop both. Run `npm run typecheck --prefix backend` and `npm run check` before committing.

GitHub Actions expects every `.env` name as a repository secret: `APP_ORIGIN`, `CORS_ORIGIN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, and `POSTGRESQL_DB_PASSWORD`. Pull requests only run checks; pushes to `main` and manual dispatches deploy production.

Promote a signed-up account manually:

```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
```

Checkout is intentionally a fake gateway: it confirms an immediate `demo` payment and never asks for card or bank details.
