# PetitBakery

PetitBakery is a Cloudflare Pages storefront with Supabase Auth/Postgres and a Hono API. The browser uses only the Supabase publishable key; the Hono Worker keeps the Supabase secret key and is the trusted path for checkout and admin data.

## Setup

1. Create a Supabase project and configure its Auth redirect URLs for `http://localhost:8788/verify/`, `http://localhost:8788/reset-password/`, `https://petitbakery.pages.dev/verify/`, and `https://petitbakery.pages.dev/reset-password/`. Signup and password-reset redirects must be on this allowlist ([Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)).
2. Copy `.env.example` to `.env` and fill every value. Do not commit it. For a manual migration, use the Supabase connection string and percent-encode special characters in its password: `npx supabase db push --db-url "postgresql://postgres:ENCODED_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"`.
3. Apply the fresh schema and seed with that command.
4. Put `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the Worker secret store. The production storefront is `https://petitbakery.pages.dev` and its API is `https://petitbakery-api.velozz.workers.dev`; the deployment workflow writes the browser-safe URL and publishable key configuration.
5. On macOS or Windows, install Node 22, run `npm ci --prefix backend`, then `npm start`. This starts the Hono API at `http://localhost:8787` and the static storefront at `http://localhost:8788`; press Ctrl+C to stop both. Run `npm run typecheck --prefix backend` before committing.

GitHub Actions expects every `.env` name as a repository secret: `APP_ORIGIN`, `CORS_ORIGIN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, and `POSTGRESQL_DB_PASSWORD`. Also set `SUPABASE_DB_POOLER_HOST` to the hostname from Supabase Dashboard → Connect → Session pooler; GitHub-hosted runners need this IPv4-compatible endpoint for migrations. Pull requests only run checks; pushes to `main` and manual dispatches deploy production.

## Signup confirmation email

The hosted Supabase project uses dashboard-managed email templates. In Authentication → Email → Templates → Confirm signup, set the subject to `Confirm your PetitBakery account` and paste the HTML from [`supabase/templates/confirmation.html`](supabase/templates/confirmation.html). The template uses Supabase's `{{ .ConfirmationURL }}` variable ([email template guide](https://supabase.com/docs/guides/auth/auth-email-templates)). Keep `/verify/` on the redirect allowlist for both localhost and the deployed Pages origin. The app sends new signups there and shows confirmation success or an expired-link recovery action.

The guarded admin reset keeps or invites `whalo8040@gmail.com`, sets its `profiles.role` to `admin`, and removes every other Auth user. It also resets user-created database entities, replays migrations (which seed the products), and resets customer orders. This is for an explicitly selected disposable hosted project only; it is not part of CI or deployment. The Supabase CLI documents that remote `db reset` drops user-created entities and replays migrations ([CLI `db reset`](https://supabase.com/docs/reference/cli/supabase#supabase-db-reset)).

Preview the target without making requests or changing data:

```sh
npm run reset:remote -- --remote --project-ref YOUR_PROJECT_REF --dry-run
```

For an actual reset, omit `--dry-run`. Review the printed project URL and database host, then type the exact project reference when prompted. The command also requires `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `POSTGRESQL_DB_PASSWORD`, and `SUPABASE_DB_POOLER_HOST` in `.env`; it refuses CI and mismatched project references. Do not add it to an Action or deployment workflow.

Checkout creates an order and demo payment record, but does not collect payment details or charge money.
