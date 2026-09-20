import { access, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const required = async (file, terms) => {
  const text = await readFile(file, 'utf8')
  for (const term of terms) if (!text.includes(term)) throw new Error(`${file} is missing ${term}`)
}

await required('supabase/migrations/202609190001_petitbakery.sql', ['create_profile', 'checkout_order', 'enable row level security', 'service_role'])
await required('backend/src/lib/supabase.ts', ['requireUser', 'requireAdmin'])
await required('backend/src/index.ts', ['/api/admin', '/api/orders'])
await required('frontend/js/api.js', ['@supabase/supabase-js@2.49.1', 'Authorization'])
await required('supabase/templates/confirmation.html', ['{{ .ConfirmationURL }}'])
await required('scripts/reset-remote.mjs', ['--remote', '--project-ref', '--dry-run', 'whalo8040@gmail.com', 'process.env.CI'])

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))).flat()
}

const frontendFiles = await filesUnder('frontend')
const htmlFiles = frontendFiles.filter((file) => file.endsWith('.html'))
const expectedRoutes = [
  'frontend/index.html', 'frontend/products/index.html', 'frontend/product/index.html',
  'frontend/cart/index.html', 'frontend/checkout/index.html', 'frontend/login/index.html',
  'frontend/register/index.html', 'frontend/verification/index.html', 'frontend/verify/index.html',
  'frontend/resend-verification/index.html', 'frontend/forgot-password/index.html',
  'frontend/reset-password/index.html', 'frontend/account/index.html',
  'frontend/admin/admin_index.html', 'frontend/admin/admin_products.html',
  'frontend/admin/admin_orders.html', 'frontend/admin/admin_shipping.html',
  'frontend/admin/admin_customers.html', 'frontend/admin/admin_payments.html', 'frontend/admin/admin_activity.html'
]
for (const route of expectedRoutes) await access(route)

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8')
  if (/href\s*=\s*(["'])#\1/i.test(html)) throw new Error(`${file} contains a placeholder href="#" link`)
  for (const [, script] of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    if (script.startsWith('/js/')) await access(join('frontend', script.slice(1)))
  }
  for (const [, href] of html.matchAll(/\bhref=["'](\/[^"]*?)["']/gi)) {
    const pathname = new URL(href, 'https://petitbakery.local').pathname
    if (pathname.startsWith('/assets/')) await access(join('frontend', pathname.slice(1)))
    else if (pathname.endsWith('.html')) await access(join('frontend', pathname.slice(1)))
    else if (pathname.endsWith('/')) await access(join('frontend', pathname.slice(1), 'index.html'))
  }
}

for (const file of frontendFiles.filter((path) => path.endsWith('.js') || path.endsWith('.html'))) {
  const text = await readFile(file, 'utf8')
  if (/href\s*=\s*(["'])#\1/i.test(text)) throw new Error(`${file} contains a placeholder href="#" link`)
  for (const match of text.matchAll(/\/assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|svg|gif)/gi)) {
    await access(join('frontend', match[0].slice(1)))
  }
}

console.log('✓ Supabase migration and Hono integration present')
console.log(`✓ ${expectedRoutes.length} storefront and admin routes; frontend references resolve`)
