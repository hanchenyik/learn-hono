import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { HttpError, readJson, safeText } from '../lib/http'
import { requireUser, supabase } from '../lib/supabase'

export const profileRoutes = new Hono<AppEnv>()
profileRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  const [profile] = await supabase(c, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=display_name,email,default_shipping&limit=1`)
  return c.json({ profile })
})
profileRoutes.patch('/', async (c) => {
  const user = await requireUser(c), body = await readJson<{ defaultShipping?: Record<string, unknown> }>(c)
  const value = body.defaultShipping
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Provide a shipping address.')
  const address = { fullName: safeText(value.fullName, 80), address1: safeText(value.address1, 120), address2: safeText(value.address2, 120), city: safeText(value.city, 80), postalCode: safeText(value.postalCode, 20), country: safeText(value.country, 60) }
  if (!address.fullName || !address.address1 || !address.city || !address.postalCode || !address.country) throw new HttpError(400, 'Complete the shipping address.')
  const [profile] = await supabase(c, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ default_shipping: address }) })
  return c.json({ profile })
})
