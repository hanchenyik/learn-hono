import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { HttpError, safeText } from '../lib/http'
import { supabase } from '../lib/supabase'

export const productRoutes = new Hono<AppEnv>()

productRoutes.get('/', async (c) => {
  const query = safeText(c.req.query('q'), 80)
  const category = safeText(c.req.query('category'), 40)

  const filters = ['active=eq.true', 'select=id,slug,name,description,category,price_cents,stock,image_url', 'order=created_at.desc', 'limit=50']
  if (query) filters.push(`or=(name.ilike.*${encodeURIComponent(query)}*,description.ilike.*${encodeURIComponent(query)}*)`)
  if (category) filters.push(`category=eq.${encodeURIComponent(category)}`)
  return c.json({ products: await supabase(c, `/rest/v1/products?${filters.join('&')}`) })
})

productRoutes.get('/:id', async (c) => {
  const id = safeText(c.req.param('id'), 80)
  const [product] = await supabase(c, `/rest/v1/products?id=eq.${encodeURIComponent(id)}&active=eq.true&select=id,slug,name,description,category,price_cents,stock,image_url`)

  if (!product) throw new HttpError(404, 'Product not found.')
  return c.json({ product })
})
