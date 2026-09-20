import { supabase } from './api.js'
import { renderShell, setBusy, toast, escapeHtml } from './ui.js'

const state = document.body.dataset.authState || 'signin'
const root = document.getElementById('auth-root')
const requestedNext = new URLSearchParams(location.search).get('next') || ''
const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/account/'
const field = (name, type = 'text', label = name, value = '') => `<label class="mt-4 block text-sm font-bold">${label}<input required name="${name}" type="${type}" value="${escapeHtml(value)}" class="pb-field mt-1 w-full rounded-xl" /></label>`

function result(message, actions) {
  root.innerHTML = `<h1 class="pb-display text-3xl">${message.title}</h1><p class="mt-3">${message.body}</p><div class="mt-6 flex flex-wrap gap-3">${actions}</div>`
}

async function showVerification() {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.slice(1))
  const error = query.get('error_description') || hash.get('error_description')
  const { data: { session } } = await supabase.auth.getSession()

  if (error || !session?.user) {
    result({
      title: 'This link could not be confirmed',
      body: 'The link may have expired or already been used. Request a fresh confirmation email to continue.'
    }, '<a class="pb-button" href="/resend-verification/">Resend confirmation</a><a class="pb-button alt" href="/login/">Sign in</a>')
    return
  }

  if (query.get('type') === 'invite' || hash.get('type') === 'invite') {
    result({ title: 'Invitation accepted', body: 'Your email is confirmed. Choose a password to finish setting up your account.' }, '<a class="pb-button" href="/reset-password/">Choose a password</a>')
    return
  }

  result({ title: 'Email confirmed', body: 'You can now sign in to PetitBakery.' }, '<a class="pb-button" href="/login/">Sign in</a><a class="pb-button alt" href="/products/">Browse treats</a>')
}

async function init() {
  await renderShell()
  if (state === 'verified') return showVerification()
  if (state === 'reset') {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      result({ title: 'Password link expired', body: 'Request a fresh reset email, then follow its link to choose a password.' }, '<a class="pb-button" href="/forgot-password/">Request reset link</a><a class="pb-button alt" href="/login/">Sign in</a>')
      return
    }
  }
  if (state === 'sent') {
    const recovery = new URLSearchParams(location.search).get('flow') === 'recovery'
    result({ title: 'Check your inbox', body: recovery ? 'Follow the password reset link to choose a new password.' : 'Follow the confirmation link to finish creating your account.' }, '<a class="pb-button" href="/login/">Sign in</a><a class="pb-button alt" href="/resend-verification/">Resend confirmation</a>')
    return
  }

  const title = state === 'signup' ? 'Create your account' : state === 'forgot' ? 'Reset password' : state === 'resend' ? 'Resend confirmation' : state === 'reset' ? 'Choose a new password' : 'Welcome back'
  const email = new URLSearchParams(location.search).get('email') || ''
  const extras = state === 'signup' ? field('full_name', 'text', 'Your name') + field('email', 'email', 'Email') + field('password', 'password', 'Password') : state === 'forgot' || state === 'resend' ? field('email', 'email', 'Email', email) : state === 'reset' ? field('password', 'password', 'New password') : field('email', 'email', 'Email') + field('password', 'password', 'Password')
  root.innerHTML = `<h1 class="pb-display text-3xl">${title}</h1><form class="mt-5">${extras}<button class="pb-button mt-6 w-full">${state === 'signup' ? 'Create account' : state === 'forgot' ? 'Send reset link' : state === 'resend' ? 'Resend link' : state === 'reset' ? 'Update password' : 'Sign in'}</button></form>${state === 'signin' ? '<p class="mt-5 text-sm"><a href="/register/">Create account</a> · <a href="/forgot-password/">Forgot password?</a> · <a href="/resend-verification/">Resend confirmation</a></p>' : ''}`
  root.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const button = form.querySelector('button')
    const emailRedirectTo = `${location.origin}/verify/`
    setBusy(button, true, 'Please wait…')

    try {
      let error
      if (state === 'signup') ({ error } = await supabase.auth.signUp({ email: data.email, password: data.password, options: { data: { full_name: data.full_name }, emailRedirectTo } }))
      else if (state === 'forgot') ({ error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: `${location.origin}/reset-password/` }))
      else if (state === 'resend') ({ error } = await supabase.auth.resend({ type: 'signup', email: data.email, options: { emailRedirectTo } }))
      else if (state === 'reset') ({ error } = await supabase.auth.updateUser({ password: data.password }))
      else ({ error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password }))

      if (error) throw error
      location.href = state === 'signin' ? next : state === 'reset' ? '/login/' : state === 'forgot' ? '/verification/?flow=recovery' : '/verification/'
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(button, false)
    }
  })
}

init().catch((error) => toast(error.message, 'error'))
