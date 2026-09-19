import { api, getCurrentUser } from './api.js'
import { escapeHtml, money } from './ui.js'
const page = location.pathname.split('/').pop().replace('admin_', '').replace('.html', '') || 'index'
const endpoint = { index: 'dashboard', products: 'products', orders: 'orders', customers: 'customers', payments: 'payments', activity: 'activity', shipping: 'orders' }[page] || 'dashboard'
const labels = { index: 'Bakery overview', products: 'Products', orders: 'Orders', customers: 'Customers', payments: 'Demo payments', activity: 'Admin activity', shipping: 'Shipping' }
function nav() { return ['index','products','orders','shipping','customers','payments','activity'].map((key) => `<a href="admin_${key}.html" class="${key === page ? 'pb-button' : ''}">${labels[key]}</a>`).join('') }
function rows(data) { const list = Array.isArray(data) ? data : [data]; if (!list.length) return '<p class="pb-card">Nothing here yet.</p>'; const columns = Object.keys(list[0]).filter((key) => !['description','image_url','address1','address2'].includes(key)); return `<div style="overflow:auto"><table class="pb-admin-table"><thead><tr>${columns.map((key) => `<th>${escapeHtml(key.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${list.map((item) => `<tr>${columns.map((key) => { const value = item[key]; return `<td>${key.includes('cents') && typeof value === 'number' ? money(value) : escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value ?? '—')}</td>` }).join('')}</tr>`).join('')}</tbody></table></div>` }
async function init() {
  const user = await getCurrentUser(); if (!user) { location.href = '/login/?next=' + encodeURIComponent(location.pathname); return }
  let data; try { data = await api(`/api/admin/${endpoint}`) } catch (error) { document.body.innerHTML = `<main class="pb-main"><h1 class="pb-display">Admin only</h1><p>${escapeHtml(error.message)}</p><a class="pb-button" href="/">Back to shop</a></main>`; return }
  const value = endpoint === 'dashboard' ? data : data[endpoint] || data.orders
  document.body.innerHTML = `<header class="pb-shell"><div class="pb-nav"><a class="pb-brand" href="/"><span>PetitBakery</span></a><a href="/account/">${escapeHtml(user.displayName)}</a></div></header><main class="pb-main"><span class="pb-kicker">Back office</span><h1 class="pb-display" style="font-size:clamp(2.5rem,6vw,5rem)">${labels[page]}</h1><nav class="pb-admin-nav">${nav()}</nav><section class="pb-admin-card">${endpoint === 'dashboard' ? `<div class="pb-admin-metrics">${Object.entries(data).map(([k,v]) => `<div><b>${escapeHtml(k)}</b><strong>${k === 'revenue' ? money(v) : escapeHtml(v)}</strong></div>`).join('')}</div>` : rows(value)}</section></main>`
}
init()
