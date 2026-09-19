import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
if (!existsSync('.env')) console.warn('Copy .env.example to .env and set the Supabase URL and keys before checkout or auth will work.')
spawn('npm', ['run', 'dev', '--prefix', 'backend'], { stdio: 'inherit', shell: process.platform === 'win32' })
