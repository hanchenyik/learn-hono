import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { HttpError, readJson, safeText } from '../lib/http'
import { requireUser, supabase } from '../lib/supabase'

type CheckoutItem = { productId?: string; quantity?: number }
export const orderRoutes = new Hono<AppEnv>()

orderRoutes.post('/', async (c) => {
  if (c.req.header('Origin') !== c.env.CORS_ORIGIN) throw new HttpError(403, 'Invalid request origin.')
  const user = await requireUser(c)
  const idempotencyKey = safeText(c.req.header('Idempotency-Key'), 100)
  if (idempotencyKey.length < 8) throw new HttpError(400, 'Idempotency-Key header is required.')
  const body = await readJson<{ items?: CheckoutItem[]; fullName?: string; address1?: string; address2?: string; city?: string; postalCode?: string; country?: string; paymentMethod?: string; saveAsDefault?: boolean }>(c)
  const items = Array.isArray(body.items) ? body.items.slice(0, 20).map((item) => ({ product_id: safeText(item.productId, 80), quantity: Number(item.quantity) })) : []
  if (!items.length || items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) throw new HttpError(400, 'Cart contains an invalid item.')
  const shipping = { full_name: safeText(body.fullName, 80), address1: safeText(body.address1, 120), address2: safeText(body.address2, 120), city: safeText(body.city, 80), postal_code: safeText(body.postalCode, 20), country: safeText(body.country, 60) }
  if (!shipping.full_name || !shipping.address1 || !shipping.city || !shipping.postal_code || !shipping.country) throw new HttpError(400, 'Complete the shipping address.')
  const paymentMethod = body.paymentMethod === 'qr' ? 'qr' : body.paymentMethod === 'card' ? 'card' : ''
  if (!paymentMethod) throw new HttpError(400, 'Choose a payment method.')
  if (body.saveAsDefault) await supabase(c, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ default_shipping: { fullName: shipping.full_name, address1: shipping.address1, address2: shipping.address2, city: shipping.city, postalCode: shipping.postal_code, country: shipping.country } }) })
  const result = await supabase(c, '/rest/v1/rpc/create_pending_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user_id: user.id, p_idempotency_key: idempotencyKey, p_items: items, p_shipping: shipping, p_method: paymentMethod }) })
  return c.json({ ok: true, ...result }, result.duplicate ? 200 : 201)
})
orderRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  return c.json({ orders: await supabase(c, `/rest/v1/orders?user_id=eq.${encodeURIComponent(user.id)}&select=id,status,shipping_status,payment_status,payment_method,subtotal_cents,shipping_cents,tax_cents,total_cents,created_at&order=created_at.desc&limit=50`) })
})
orderRoutes.get('/payment/scan/:token', async (c) => {
  const token = safeText(c.req.param('token'), 80)
  const [order] = await supabase(c, `/rest/v1/orders?payment_token=eq.${encodeURIComponent(token)}&select=id,payment_method&limit=1`)
  if (!order) throw new HttpError(404, 'Payment link is invalid.')
  if (order.payment_method !== 'qr') throw new HttpError(400, 'This payment link is not a QR payment.')
  return c.json(await supabase(c, '/rest/v1/rpc/complete_demo_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_order_id: order.id, p_token: token }) }))
})
orderRoutes.get('/:id/payment', async (c) => {
  const user = await requireUser(c), id = safeText(c.req.param('id'), 80)
  const [order] = await supabase(c, `/rest/v1/orders?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,total_cents,payment_method,payment_status,payment_expires_at,payment_token&limit=1`)
  if (!order) throw new HttpError(404, 'Order not found.')
  if (order.payment_status === 'pending' && new Date(order.payment_expires_at).getTime() < Date.now()) await supabase(c, '/rest/v1/rpc/complete_demo_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_order_id: order.id, p_token: order.payment_token }) })
  const [fresh] = await supabase(c, `/rest/v1/orders?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,total_cents,payment_method,payment_status,payment_expires_at,payment_token&limit=1`)
  return c.json({ payment: fresh })
})
orderRoutes.post('/:id/payment/card', async (c) => {
  const user = await requireUser(c), id = safeText(c.req.param('id'), 80)
  // The browser validates the demo PIN locally; this endpoint receives no card or PIN data.
  const [order] = await supabase(c, `/rest/v1/orders?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,payment_token,payment_method&limit=1`)
  if (!order) throw new HttpError(404, 'Order not found.')
  if (order.payment_method !== 'card') throw new HttpError(400, 'This order uses QR payment.')
  return c.json(await supabase(c, '/rest/v1/rpc/complete_demo_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_order_id: order.id, p_token: order.payment_token }) }))
})
orderRoutes.post('/:id/payment/retry', async (c) => {
  const user = await requireUser(c), id = safeText(c.req.param('id'), 80)
  return c.json(await supabase(c, '/rest/v1/rpc/retry_demo_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_order_id: id, p_user_id: user.id }) }))
})
orderRoutes.post('/:id/cancel', async (c) => {
  const user = await requireUser(c), id = safeText(c.req.param('id'), 80)
  return c.json(await supabase(c, '/rest/v1/rpc/cancel_demo_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_order_id: id, p_user_id: user.id }) }))
})
orderRoutes.get('/:id', async (c) => {
  const user = await requireUser(c), id = safeText(c.req.param('id'), 80)
  const [order] = await supabase(c, `/rest/v1/orders?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`)
  if (!order) throw new HttpError(404, 'Order not found.')
  return c.json({ order, items: await supabase(c, `/rest/v1/order_items?order_id=eq.${encodeURIComponent(id)}&select=product_id,product_name,unit_price_cents,quantity`) })
})
