# PetitBakery

PetitBakery is a Cloudflare Pages storefront with Supabase Auth/Postgres and a Hono API. The browser uses only the Supabase publishable key; the Hono Worker keeps the Supabase secret key and is the trusted path for checkout and admin data.

## Setup

1. Create a Supabase project and configure its Auth redirect URLs for `http://localhost:8788/verify/` and `http://localhost:8788/reset-password/` (plus the production equivalents).
2. Copy `.env.example` to `.env`. `DATABASE_URL` is for local migrations only; percent-encode special characters in its password.
3. Apply the fresh schema and seed: `npx supabase db push`.
4. Put `SUPABASE_SECRET_KEY` in the Worker secret store and set `SUPABASE_URL` in `backend/wrangler.jsonc` or runtime configuration. Put the URL and publishable key in the deployed `frontend/js/config.js` build configuration.
5. Run `npm ci --prefix backend && npm run typecheck --prefix backend` and `npm run check`.

Promote a signed-up account manually:

```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
```

Checkout is intentionally a fake gateway: it confirms an immediate `demo` payment and never asks for card or bank details.
