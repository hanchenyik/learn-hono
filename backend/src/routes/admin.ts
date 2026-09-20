import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { readJson, safeText } from '../lib/http'
import { requireAdmin, supabase } from '../lib/supabase'
export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('*', async (c, next) => { await requireAdmin(c); await next() })
adminRoutes.get('/dashboard', async (c) => {
  const [products, orders, customers, payments] = await Promise.all([supabase(c, '/rest/v1/products?select=id,stock'), supabase(c, '/rest/v1/orders?select=id,total_cents'), supabase(c, '/rest/v1/profiles?select=id&role=eq.customer'), supabase(c, '/rest/v1/payments?select=id')])
  return c.json({ products: products.length, lowStock: products.filter((p: any) => p.stock < 5).length, orders: orders.length, revenue: orders.reduce((n: number, o: any) => n + o.total_cents, 0), customers: customers.length, payments: payments.length })
})
adminRoutes.get('/products', async (c) => c.json({ products: await supabase(c, '/rest/v1/products?select=*&order=created_at.desc') }))
adminRoutes.patch('/products/:id', async (c) => {
  const actor = await requireAdmin(c)
  const body = await readJson<Record<string, unknown>>(c), allowed = ['name', 'description', 'category', 'price_cents', 'stock', 'image_url', 'active']
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)))
  const [product] = await supabase(c, `/rest/v1/products?id=eq.${encodeURIComponent(safeText(c.req.param('id'), 80))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch) })
  await supabase(c, '/rest/v1/admin_activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_id: actor.id, action: 'updated', subject_type: 'product', subject_id: product.id }) })
  return c.json({ product })
})
adminRoutes.get('/orders', async (c) => c.json({ orders: await supabase(c, '/rest/v1/orders?select=*,profiles(email,display_name)&order=created_at.desc&limit=200') }))
adminRoutes.patch('/orders/:id', async (c) => {
  const actor = await requireAdmin(c)
  const body = await readJson<{ status?: string; shipping_status?: string }>(c), patch = Object.fromEntries(Object.entries(body).filter(([key, value]) => ['status', 'shipping_status'].includes(key) && typeof value === 'string'))
  const [order] = await supabase(c, `/rest/v1/orders?id=eq.${encodeURIComponent(safeText(c.req.param('id'), 80))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch) })
  await supabase(c, '/rest/v1/admin_activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_id: actor.id, action: 'updated', subject_type: 'order', subject_id: order.id }) })
  return c.json({ order })
})
adminRoutes.get('/customers', async (c) => c.json({ customers: await supabase(c, '/rest/v1/profiles?select=*&order=created_at.desc&limit=200') }))
adminRoutes.get('/payments', async (c) => c.json({ payments: await supabase(c, '/rest/v1/payments?select=*,orders(id,user_id)&order=created_at.desc&limit=200') }))
adminRoutes.get('/activity', async (c) => c.json({ activity: await supabase(c, '/rest/v1/admin_activity?select=*,profiles(display_name,email)&order=created_at.desc&limit=200') }))
