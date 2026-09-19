# Security

- Supabase Auth owns passwords, confirmation, recovery, and PKCE browser sessions.
- Every public table has RLS enabled. The Worker checks the caller with Supabase Auth before it uses server credentials; `/api/admin/*` additionally checks `profiles.role = 'admin'`.
- Checkout is a security-definer Postgres function executable only by `service_role`. It locks product rows, recalculates totals, decrements stock, creates the demo payment, and makes retries idempotent.
- Rotate the exposed legacy Supabase keys immediately. Keep `SUPABASE_SECRET_KEY` only in Cloudflare secrets and never commit a database URL or secret key.
