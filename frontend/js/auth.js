import { supabase } from './api.js'
import { renderShell, toast } from './ui.js'
const state = document.body.dataset.authState || 'signin', root = document.getElementById('auth-root')
const requestedNext = new URLSearchParams(location.search).get('next') || ''
const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/account/'
const field = (name, type = 'text', label = name) => `<label class="block mt-4 text-sm font-bold">${label}<input required name="${name}" type="${type}" class="pb-field mt-1 w-full rounded-xl" /></label>`
async function init() {
  await renderShell()
  if (state === 'verified') { root.innerHTML = '<h1 class="pb-display text-3xl">Email confirmed</h1><p class="mt-3">You can now sign in to PetitBakery.</p><a class="pb-button mt-6" href="/login/">Sign in</a>'; return }
  if (state === 'sent') { root.innerHTML = '<h1 class="pb-display text-3xl">Check your inbox</h1><p class="mt-3">Follow the email link to continue.</p>'; return }
  const title = state === 'signup' ? 'Create your account' : state === 'forgot' ? 'Reset password' : state === 'resend' ? 'Resend verification' : state === 'reset' ? 'Choose a new password' : 'Welcome back'
  const extras = state === 'signup' ? field('full_name','text','Your name') + field('email','email','Email') + field('password','password','Password') : state === 'forgot' || state === 'resend' ? field('email','email','Email') : state === 'reset' ? field('password','password','New password') : field('email','email','Email') + field('password','password','Password')
  root.innerHTML = `<h1 class="pb-display text-3xl">${title}</h1><form class="mt-5">${extras}<button class="pb-button mt-6 w-full">${state === 'signup' ? 'Create account' : state === 'forgot' ? 'Send reset link' : state === 'resend' ? 'Resend link' : state === 'reset' ? 'Update password' : 'Sign in'}</button></form>${state === 'signin' ? '<p class="mt-5 text-sm"><a href="/register/">Create account</a> · <a href="/forgot-password/">Forgot password?</a></p>' : ''}`
  root.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)), emailRedirectTo = `${location.origin}/verify/`; let error
    if (state === 'signup') ({ error } = await supabase.auth.signUp({ email: data.email, password: data.password, options: { data: { full_name: data.full_name }, emailRedirectTo } }))
    else if (state === 'forgot') ({ error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: `${location.origin}/reset-password/` }))
    else if (state === 'resend') ({ error } = await supabase.auth.resend({ type: 'signup', email: data.email, options: { emailRedirectTo } }))
    else if (state === 'reset') ({ error } = await supabase.auth.updateUser({ password: data.password }))
    else ({ error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password }))
    if (error) return toast(error.message, 'error'); location.href = state === 'signin' ? next : state === 'reset' ? '/login/' : state === 'signup' || state === 'resend' ? '/verification/' : '/verification/'
  })
}
init().catch((error) => toast(error.message, 'error'))
