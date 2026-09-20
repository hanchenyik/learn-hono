import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

if (!existsSync('.env')) {
  console.error('Create a root .env from .env.example before starting the app.')
  process.exit(1)
}

process.loadEnvFile('.env')
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[name] || /YOUR_|your_project/i.test(process.env[name])) {
    console.error(`Set ${name} to your Supabase project value in the root .env.`)
    process.exit(1)
  }
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  spawn(npm, ['run', 'dev', '--prefix', 'backend'], { stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/serve-frontend.mjs'], { stdio: 'inherit' })
]
const stop = () => children.forEach((child) => child.kill())
process.once('SIGINT', stop); process.once('SIGTERM', stop)
