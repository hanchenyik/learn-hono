import { readFile } from 'node:fs/promises'
const required = async (file, terms) => { const text = await readFile(file, 'utf8'); for (const term of terms) if (!text.includes(term)) throw new Error(`${file} is missing ${term}`) }
await required('supabase/migrations/202609190001_petitbakery.sql', ['create_profile', 'checkout_order', 'enable row level security', 'service_role'])
await required('backend/src/lib/supabase.ts', ['requireUser', 'requireAdmin'])
await required('backend/src/index.ts', ['/api/admin', '/api/orders'])
await required('frontend/js/api.js', ['@supabase/supabase-js@2.49.1', 'Authorization'])
console.log('✓ Supabase migration and Hono integration present')
