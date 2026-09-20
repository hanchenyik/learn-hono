import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => args[args.indexOf(name) + 1]
const fail = (message) => { console.error(`Reset refused: ${message}`); process.exit(1) }

if (args.some((arg) => !['--remote', '--dry-run', '--project-ref'].includes(arg) && arg !== option('--project-ref'))) fail('unknown argument.')
if (!flag('--remote')) fail('pass --remote to confirm this command targets a hosted project.')
if (/^(true|1)$/i.test(process.env.CI || '')) fail('remote reset is a manual operation and cannot run in CI.')

const projectRef = option('--project-ref')
const projectUrl = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const databasePassword = process.env.POSTGRESQL_DB_PASSWORD
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST
if (!projectRef || !/^[a-z0-9-]+$/.test(projectRef)) fail('provide --project-ref with the hosted project reference.')
if (!projectUrl || !secretKey || !databasePassword || !poolerHost) fail('set SUPABASE_URL, SUPABASE_SECRET_KEY, POSTGRESQL_DB_PASSWORD, and SUPABASE_DB_POOLER_HOST.')

let url
try { url = new URL(projectUrl) } catch { fail('SUPABASE_URL must be a valid project URL.') }
const urlRef = url.hostname.endsWith('.supabase.co') ? url.hostname.split('.')[0] : ''
if (url.protocol !== 'https:' || urlRef !== projectRef) fail('--project-ref must exactly match the HTTPS SUPABASE_URL project reference.')
if (!/^[a-z0-9.-]+$/.test(poolerHost) || poolerHost.includes('..')) fail('SUPABASE_DB_POOLER_HOST is invalid.')

const migrations = (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()
const databaseUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(databasePassword)}@${poolerHost}:5432/postgres`
console.log(`Remote reset target: ${projectRef}`)
console.log(`Supabase URL: ${url.origin}`)
console.log(`Database host: ${poolerHost}:5432`)
console.log(`Migrations to replay: ${migrations.join(', ') || '(none)'}`)
console.log('Auth cleanup: retain or invite whalo8040@gmail.com; delete all other Auth users; set the retained profile role to admin.')
if (flag('--dry-run')) {
  console.log('Dry run only. No database or Auth request was made.')
  process.exit(0)
}

if (!process.stdin.isTTY || !process.stdout.isTTY) fail('a terminal is required for typed project confirmation.')
const readline = createInterface({ input: process.stdin, output: process.stdout })
const confirmation = await readline.question(`Type ${projectRef} to reset this remote project: `)
readline.close()
if (confirmation !== projectRef) fail('project reference did not match.')

const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const reset = spawnSync(cli, ['supabase', 'db', 'reset', '--db-url', databaseUrl], { stdio: 'inherit' })
if (reset.error) fail(`could not start Supabase CLI: ${reset.error.message}`)
if (reset.status !== 0) fail(`Supabase CLI reset exited with status ${reset.status ?? 'unknown'}.`)

const apiBase = `${url.origin}/auth/v1`
const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { ...headers, ...init.headers } })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(data?.msg || data?.message || `Supabase Auth request failed (${response.status}).`)
  return data
}
async function listUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const data = await request(`/admin/users?page=${page}&per_page=100`)
    users.push(...(data.users || []))
    if (!data.users || data.users.length < 100) return users
  }
}

const adminEmail = 'whalo8040@gmail.com'
const appOrigin = (process.env.APP_ORIGIN || 'https://petitbakery.pages.dev').replace(/\/$/, '')
let users = await listUsers()
let admin = users.find((user) => user.email?.toLowerCase() === adminEmail)
if (!admin) {
  const invited = await request(`/invite?redirect_to=${encodeURIComponent(`${appOrigin}/verify/`)}`, { method: 'POST', body: JSON.stringify({ email: adminEmail }) })
  admin = invited.user || invited
  if (!admin.id) admin = (await listUsers()).find((user) => user.email?.toLowerCase() === adminEmail)
  if (!admin?.id) throw new Error('Supabase sent the admin invitation but did not return the new Auth user.')
}

const profileResponse = await fetch(`${url.origin}/rest/v1/profiles?on_conflict=id`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: admin.id, email: adminEmail, display_name: 'PetitBakery Admin', role: 'admin' })
})
const profileText = await profileResponse.text()
if (!profileResponse.ok) throw new Error(`Could not set admin profile: ${profileText || profileResponse.status}.`)

users = await listUsers()
for (const user of users) {
  if (user.id !== admin.id) await request(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
}

const remaining = await listUsers()
const profiles = await fetch(`${url.origin}/rest/v1/profiles?id=eq.${encodeURIComponent(admin.id)}&select=id,email,role`, { headers }).then((response) => response.json())
if (remaining.length !== 1 || remaining[0].id !== admin.id || profiles[0]?.role !== 'admin') throw new Error('Reset finished, but the sole-admin verification failed.')
console.log(`Remote reset complete. ${adminEmail} is the only Auth user and has the admin profile role.`)
