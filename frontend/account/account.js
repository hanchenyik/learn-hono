import { api, getCurrentUser, supabase } from '../js/api.js'
import { escapeHtml, money, renderShell, toast } from '../js/ui.js'

const ordersRoot = document.getElementById('orders')
const orderDate = (value) => new Date(typeof value === 'number' ? value * 1000 : value).toLocaleDateString()

function renderOrders(orders) {
  ordersRoot.innerHTML = orders.length ? orders.map((order, index) => `
    <article class="rounded-2xl border border-slate-200 bg-white p-5">
      <button type="button" data-order-id="${escapeHtml(order.id)}" aria-expanded="false" aria-controls="order-detail-${index}" class="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <span><span class="block font-mono text-xs text-slate-400">${escapeHtml(order.id)}</span><span class="mt-1 block font-bold">Order · ${escapeHtml(orderDate(order.created_at))}</span></span>
        <span class="text-right"><span class="block font-black">${money(order.total_cents)}</span><span class="text-xs uppercase tracking-wide text-emerald-700">${escapeHtml(order.status)}</span></span>
      </button>
      <div id="order-detail-${index}" class="mt-4 hidden border-t border-slate-200 pt-4" aria-live="polite"></div>
    </article>`).join('') : '<p class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">No orders yet. Your order history will appear here.</p>'

  ordersRoot.querySelectorAll('[data-order-id]').forEach((button) => button.addEventListener('click', async () => {
    const panel = document.getElementById(button.getAttribute('aria-controls'))
    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden')
      button.setAttribute('aria-expanded', 'false')
      return
    }
    panel.classList.remove('hidden')
    button.setAttribute('aria-expanded', 'true')
    if (panel.dataset.loaded) return
    panel.innerHTML = '<p class="text-sm text-slate-500">Loading order details…</p>'
    try {
      const { order, items } = await api(`/api/orders/${encodeURIComponent(button.dataset.orderId)}`)
      panel.dataset.loaded = 'true'
      panel.innerHTML = `<div class="flex flex-wrap justify-between gap-2 text-sm"><p><span class="font-semibold">Order status:</span> ${escapeHtml(order.status)}</p><p><span class="font-semibold">Shipping:</span> ${escapeHtml(order.shipping_status || 'Pending')}</p></div>
        <ul class="mt-4 divide-y divide-slate-200">${items.map((item) => `<li class="flex justify-between gap-4 py-3 text-sm"><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><span>${money(item.unit_price_cents * item.quantity)}</span></li>`).join('')}</ul>
        <dl class="ml-auto mt-4 max-w-xs space-y-2 text-sm"><div class="flex justify-between"><dt>Subtotal</dt><dd>${money(order.subtotal_cents)}</dd></div><div class="flex justify-between"><dt>Shipping</dt><dd>${money(order.shipping_cents)}</dd></div><div class="flex justify-between"><dt>Tax</dt><dd>${money(order.tax_cents)}</dd></div><div class="flex justify-between border-t border-slate-200 pt-2 font-black"><dt>Total</dt><dd>${money(order.total_cents)}</dd></div></dl>
        <p class="mt-4 text-sm text-slate-500">Shipping to ${escapeHtml([order.shipping_name, order.address1, order.address2, order.city, order.postal_code, order.country].filter(Boolean).join(', '))}</p>`
    } catch (error) {
      panel.innerHTML = `<p class="text-sm text-red-700">Could not load this order: ${escapeHtml(error.message)} <button type="button" data-retry class="font-semibold underline">Try again</button></p>`
      panel.querySelector('[data-retry]').addEventListener('click', () => { delete panel.dataset.loaded; panel.classList.add('hidden'); button.click() })
    }
  }))
}

async function init() {
  await renderShell()
  const user = await getCurrentUser()
  if (!user) {
    location.href = '/login/?next=/account/'
    return
  }

  document.getElementById('account-name').textContent = user.displayName
  document.getElementById('account-email').textContent = user.email
  const { orders } = await api('/api/orders')
  renderOrders(orders)

  document.getElementById('logout').addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      location.href = '/'
    } catch (error) {
      toast(error.message, 'error')
    }
  })
}

init().catch((error) => {
  ordersRoot.innerHTML = `<p role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">Could not load your account: ${escapeHtml(error.message)} <button type="button" onclick="location.reload()" class="font-semibold underline">Try again</button></p>`
  toast(error.message, 'error')
})
