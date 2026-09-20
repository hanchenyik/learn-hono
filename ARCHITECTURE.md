# Architecture

Pages serves the static PetitBakery UI. Supabase JS v2 handles Auth in the browser. Requests to Hono carry the access token; Hono validates it through Supabase Auth, then uses the server key for catalog, checkout, customer orders, and admin workflows. Supabase Postgres holds profiles, products, orders, order items, demo payments, and admin activity.
