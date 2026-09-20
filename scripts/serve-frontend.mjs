import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'frontend')
const port = Number(process.env.PETIT_FRONTEND_PORT || process.env.PORT || 8788)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const redirects = new Map((await readFile(join(root, '_redirects'), 'utf8')).trim().split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).map((line) => {
  const [source, destination, code = '302'] = line.trim().split(/\s+/)
  return [source, { destination, code: Number(code) }]
}))

const browserConfig = {
  API_BASE: 'http://localhost:8787',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY
}

createServer(async (request, response) => {
  const incoming = new URL(request.url || '/', 'http://localhost')
  const requested = decodeURIComponent(incoming.pathname)
  if (requested === '/js/config.js') {
    const body = `window.APP_CONFIG = ${JSON.stringify(browserConfig)};\n`
    response.writeHead(200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' })
    response.end(body)
    return
  }

  const redirect = redirects.get(requested)
  const target = redirect && new URL(redirect.destination, incoming)
  if (redirect?.code === 200) incoming.pathname = target.pathname
  else if (redirect) {
    if (!target.search) target.search = incoming.search
    response.writeHead(redirect.code, { Location: `${target.pathname}${target.search}${target.hash}` })
    response.end()
    return
  }

  const rewritten = target?.pathname || requested
  const relative = rewritten === '/' ? 'index.html' : rewritten.replace(/^\/+/, '')
  let file = normalize(join(root, relative))
  if (!file.startsWith(root)) { response.writeHead(403); response.end('Forbidden'); return }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404); response.end('Not found')
  }
}).listen(port, () => console.log(`Static server ready on ${port}`))
