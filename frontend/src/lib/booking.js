export async function bookingAPI(url, options) {
  const response = await fetch(url, { credentials: 'same-origin', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Connectez-vous pour continuer.' : data.error || 'Le service est indisponible. Veuillez réessayer.')
    error.status = response.status
    throw error
  }
  return data
}

export const postJSON = (value, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
export const bookingTime = value => new Date(value).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
export const bookingDate = value => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export function parisDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-')
}
export function addDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}
export function weekStart(day = parisDate()) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7
  return addDays(day, 1 - weekday)
}
export function parisInputToISO(value) {
  const desired = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(desired)) throw new Error('Date ou heure invalide.')
  let guess = desired
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess))
    const part = type => parts.find(p => p.type === type).value
    const rendered = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
    if (rendered === value) return new Date(guess).toISOString()
    guess += desired - Date.parse(`${rendered}:00Z`)
  }
  throw new Error('Cette heure n’existe pas lors du changement d’heure. Choisissez un autre horaire.')
}
export const statuses = { pending: 'En attente de l’artisan', confirmed: 'Confirmé', rejected: 'Refusé', cancelled: 'Annulé', expired: 'Demande expirée' }
export const kinds = { diagnostic: 'Premier rendez-vous · diagnostic', absence: 'Absence', external: 'Intervention hors Hartisan' }
export const minutesLabel = n => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60}` : ''}`
