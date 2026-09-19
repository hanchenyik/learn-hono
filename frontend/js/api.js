import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { fallbackProducts } from './catalog-fallback.js'
const cfg = window.APP_CONFIG || {}, API_BASE = String(cfg.API_BASE || '').replace(/\/$/, '')
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true } })
function localFallback(path) { if (path === '/api/products') return { products: fallbackProducts }; const id = path.match(/^\/api\/products\/([^/]+)$/)?.[1], product = id && fallbackProducts.find((p) => p.id === decodeURIComponent(id)); return product ? { product } : null }
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {}), { data: { session } } = await supabase.auth.getSession()
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  let response; try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }) } catch (error) { const fallback = localFallback(path); if (fallback && (!options.method || options.method === 'GET')) return fallback; throw error }
  let data = null; try { data = await response.json() } catch {}
  if (!response.ok) { const error = new Error(data?.message || data?.error || `Request failed (${response.status})`); error.status = response.status; throw error }
  return data
}
export async function getCurrentUser() { const { data: { user } } = await supabase.auth.getUser(); return user ? { id: user.id, email: user.email, displayName: user.user_metadata?.full_name || user.email } : null }
