import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { HttpError } from './http'

const base = (c: Context<AppEnv>) => c.env.SUPABASE_URL.replace(/\/$/, '')
const serviceHeaders = (c: Context<AppEnv>, extra: HeadersInit = {}) => ({
  apikey: c.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${c.env.SUPABASE_SECRET_KEY}`, ...extra
})

export async function supabase(c: Context<AppEnv>, path: string, init: RequestInit = {}) {
  const response = await fetch(`${base(c)}${path}`, { ...init, headers: serviceHeaders(c, init.headers) })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new HttpError(response.status, data?.message || data?.hint || 'Database request failed.')
  return data
}

export async function requireUser(c: Context<AppEnv>) {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Sign in to continue.')
  const response = await fetch(`${base(c)}/auth/v1/user`, { headers: { apikey: c.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new HttpError(401, 'Your session has expired. Please sign in again.')
  const user = await response.json() as { id: string; email?: string; user_metadata?: { full_name?: string } }
  return { id: user.id, email: user.email || '', displayName: user.user_metadata?.full_name || user.email || 'Customer' }
}

export async function requireAdmin(c: Context<AppEnv>) {
  const user = await requireUser(c)
  const rows = await supabase(c, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`)
  if (rows[0]?.role !== 'admin') throw new HttpError(403, 'Admin access is required.')
  return user
}
