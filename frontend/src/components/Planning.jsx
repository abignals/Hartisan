import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import { useUtilisateur } from '../hooks/useUtilisateur.js'
import { bookingAPI, postJSON, parisDate, addDays, weekStart, bookingDate, bookingTime, parisInputToISO, statuses, minutesLabel } from '../lib/booking.js'
import '../styles/etabli.css'
import '../styles/booking.css'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function HoursForm({ settings, onSave, onClose }) {
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function updateWindow(index, field, value) {
    setDraft(previous => ({ ...previous, windows: previous.windows.map((window, i) => i === index ? { ...window, [field]: Number(value) } : window) }))
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSave(draft); onClose() }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <form className="booking-card booking-form" onSubmit={submit}>
    <h2>Mes horaires habituels</h2><p>Heure de Paris. Ajoutez plusieurs plages pour garder une pause le midi. Les rendez-vous existants restent inchangés.</p>
    <fieldset disabled={busy}>
      <div className="booking-form-row"><label>Durée du diagnostic<select value={draft.diagnostic_minutes} onChange={e => setDraft({ ...draft, diagnostic_minutes: Number(e.target.value) })}>{Array.from({ length: 16 }, (_, i) => (i + 1) * 15).map(n => <option key={n} value={n}>{minutesLabel(n)}</option>)}</select></label><label>Marge de déplacement après chaque diagnostic<select value={draft.buffer_minutes} onChange={e => setDraft({ ...draft, buffer_minutes: Number(e.target.value) })}>{Array.from({ length: 9 }, (_, i) => i * 15).map(n => <option key={n} value={n}>{minutesLabel(n)}</option>)}</select></label></div>
      <div className="booking-hours">{DAYS.map((day, i) => <div className="booking-hours-day" key={day}>
        <strong>{day}</strong>
        <div>{draft.windows.map((window, index) => window.weekday === i + 1 && <div className="booking-window" key={index}>
          <label>De<select aria-label={`${day}, début de plage`} value={window.start_minute} onChange={e => updateWindow(index, 'start_minute', e.target.value)}>{Array.from({ length: 96 }, (_, j) => j * 15).map(n => <option key={n} value={n}>{clock(n)}</option>)}</select></label>
          <label>À<select aria-label={`${day}, fin de plage`} value={window.end_minute} onChange={e => updateWindow(index, 'end_minute', e.target.value)}>{Array.from({ length: 96 }, (_, j) => (j + 1) * 15).map(n => <option key={n} value={n}>{clock(n)}</option>)}</select></label>
          <button type="button" className="btn btn-ghost" aria-label={`Supprimer la plage de ${day}`} onClick={() => setDraft({ ...draft, windows: draft.windows.filter((_, j) => j !== index) })}>Retirer</button>
        </div>)}{!draft.windows.some(w => w.weekday === i + 1) && <span className="booking-muted">Fermé</span>}</div>
        <button type="button" className="btn btn-ghost" disabled={draft.windows.length >= 28} onClick={() => setDraft({ ...draft, windows: [...draft.windows, { weekday: i + 1, start_minute: 8 * 60, end_minute: 18 * 60 }] })}>+ Plage</button>
      </div>)}</div>
    </fieldset>
    {error && <p className="booking-error" role="alert">{error}</p>}
    <div className="booking-actions"><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer mes horaires'}</button></div>
  </form>
}

function BlockForm({ onSave, onClose }) {
  const [draft, setDraft] = useState({ kind: 'external', title: '', start: `${addDays(parisDate(), 1)}T08:00`, end: `${addDays(parisDate(), 1)}T17:00`, with_buffer: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({ kind: draft.kind, title: draft.title, starts_at: parisInputToISO(draft.start), ends_at: parisInputToISO(draft.end), with_buffer: draft.with_buffer })
      onClose()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <form className="booking-card booking-form" onSubmit={submit}>
    <h2>Bloquer une période</h2><p>Quelques heures, une journée ou plusieurs jours. Les horaires sont ceux de Paris.</p>
    <fieldset disabled={busy}><label>Type<select value={draft.kind} onChange={e => update('kind', e.target.value)}><option value="external">Intervention prise hors Hartisan</option><option value="absence">Absence / congé / indisponibilité</option></select></label>
      <label>Titre (visible uniquement dans votre planning)<input required maxLength={160} value={draft.title} onChange={e => update('title', e.target.value)} placeholder="Ex. Rénovation salle de bain" /></label>
      <div className="booking-form-row"><label>Début<input required type="datetime-local" value={draft.start} onChange={e => update('start', e.target.value)} /></label><label>Fin<input required type="datetime-local" value={draft.end} onChange={e => update('end', e.target.value)} /></label></div>
      {draft.kind === 'external' && <label className="booking-checkbox"><input type="checkbox" checked={draft.with_buffer} onChange={e => update('with_buffer', e.target.checked)} />Ajouter ma marge de déplacement après l’intervention</label>}
    </fieldset>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <div className="booking-actions"><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Bloquer cette période'}</button></div>
  </form>
}

export default function Planning() {
  const { utilisateur, chargement } = useUtilisateur()
  const [week, setWeek] = useState(weekStart())
  const [settings, setSettings] = useState(null)
  const [events, setEvents] = useState([])
  const [pending, setPending] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (utilisateur?.role !== 'artisan') return
    const controller = new AbortController()
    async function load() {
      try {
        const [config, calendar, requests] = await Promise.all([
          bookingAPI('/api/calendar/settings', { signal: controller.signal }),
          bookingAPI(`/api/appointments?from=${week}&until=${addDays(week, 7)}`, { signal: controller.signal }),
          bookingAPI(`/api/appointments?from=${parisDate()}&until=${addDays(parisDate(), 91)}`, { signal: controller.signal }),
        ])
        if (!controller.signal.aborted) { setSettings(config); setEvents(calendar); setPending(requests.filter(e => e.status === 'pending')); setError('') }
      } catch (e) { if (!controller.signal.aborted) setError(e.message) }
    }
    load(); const timer = setInterval(load, 30000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [utilisateur, week, version])
  async function save(url, data, method = 'POST') {
    await bookingAPI(url, postJSON(data, method)); setVersion(v => v + 1); setNotice('Planning mis à jour.')
  }
  return <div className="etb"><Entete /><main className="page booking-planning-page">
    <div className="booking-page-heading"><div><h1>Mon emploi du temps</h1><p>Demandes, interventions et indisponibilités · Heure de Paris</p></div>{utilisateur?.role === 'artisan' && <div className="booking-actions"><button className="btn btn-ghost" disabled={!settings} onClick={() => setEditor(editor === 'hours' ? '' : 'hours')}>Mes horaires</button><button className="btn btn-primary" disabled={!settings} onClick={() => setEditor(editor === 'block' ? '' : 'block')}>+ Bloquer une période</button></div>}</div>
    {chargement ? <p>Chargement…</p> : !utilisateur ? <a className="btn btn-primary" href="/connexion?retour=%2Fpro%2Fplanning">Se connecter à mon espace artisan</a> : utilisateur.role !== 'artisan' ? <a href="/rdv">Accéder à mes rendez-vous client</a> : <>
      {error && <p className="booking-error" role="alert">{error}</p>}
      {notice && <p className="booking-notice" role="status">{notice}</p>}
      {settings && !settings.windows.length && <p className="booking-notice">Aucun horaire d’ouverture renseigné. Cliquez sur « Mes horaires » pour proposer vos premiers créneaux de diagnostic.</p>}
      {editor === 'hours' && settings && <HoursForm settings={settings} onSave={draft => save('/api/calendar/settings', draft, 'PUT')} onClose={() => setEditor('')} />}
      {editor === 'block' && <BlockForm onSave={draft => save('/api/calendar/blocks', draft)} onClose={() => setEditor('')} />}
      <section className="booking-pending"><h2>Demandes à traiter <span className="booking-count">{pending.length}</span></h2>{!pending.length ? <p className="booking-muted">Aucune demande en attente.</p> : <div className="booking-request-list">{pending.map(event => <button key={event.id} onClick={() => { window.location.href = `/rdv/${event.id}` }}><strong>{event.contact_name}</strong><span>{event.title}</span><span>{bookingDate(event.starts_at)} · {bookingTime(event.starts_at)}</span><small>Répondre avant {bookingDate(event.expires_at)} à {bookingTime(event.expires_at)}</small></button>)}</div>}</section>
      <div className="booking-period"><button className="btn btn-ghost" onClick={() => setWeek(addDays(week, -7))}>← Semaine précédente</button><strong>{bookingDate(`${week}T12:00:00Z`)} — {bookingDate(`${addDays(week, 6)}T12:00:00Z`)}</strong><button className="btn btn-ghost" onClick={() => setWeek(addDays(week, 7))}>Semaine suivante →</button><button className="btn btn-ghost" onClick={() => setWeek(weekStart())}>Aujourd’hui</button></div>
      <div className="booking-week">{DAYS.map((label, index) => {
        const day = addDays(week, index)
        const entries = events.filter(event => ['pending', 'confirmed'].includes(event.status) && parisDate(event.starts_at) <= day && parisDate(new Date(new Date(event.busy_until).getTime() - 1)) >= day)
        const windows = settings?.windows.filter(w => w.weekday === index + 1) || []
        return <section className={`booking-week-day ${day === parisDate() ? 'is-today' : ''}`} key={day}>
          <h2>{label}<span>{day.slice(8, 10)}/{day.slice(5, 7)}</span></h2>
          <p className="booking-week-hours">{windows.length ? windows.map(w => `${clock(w.start_minute)}–${clock(w.end_minute)}`).join(' / ') : 'Fermé aux diagnostics'}</p>
          {entries.map(event => <button key={event.id} className={`booking-event event-${event.kind} status-${event.status}`} onClick={() => { window.location.href = `/rdv/${event.id}` }}>
            <strong>{parisDate(event.starts_at) < day ? 'En cours' : bookingTime(event.starts_at)} — {parisDate(event.ends_at) > day ? 'Suite demain' : bookingTime(event.ends_at)}</strong>
            <span>{event.title}</span>{event.kind === 'diagnostic' && <span>{event.contact_name}</span>}<small>{event.kind === 'diagnostic' ? statuses[event.status] : event.kind === 'absence' ? 'Indisponible' : 'Hors Hartisan'}</small>
          </button>)}
          {!entries.length && <p className="booking-empty-day">Aucun événement</p>}
        </section>
      })}</div>
      <p className="booking-muted">Les demandes en attente bloquent aussi le créneau. La marge de trajet est incluse dans les indisponibilités. Les rendez-vous refusés, annulés ou expirés libèrent leur place.</p>
      {events.some(e => !['pending', 'confirmed'].includes(e.status)) && <details className="booking-card"><summary>Demandes annulées, refusées ou expirées cette semaine</summary>{events.filter(e => !['pending', 'confirmed'].includes(e.status)).map(event => <button className="booking-history-row" key={event.id} onClick={() => { window.location.href = `/rdv/${event.id}` }}>{bookingDate(event.starts_at)} · {event.title} — {statuses[event.status]}</button>)}</details>}
    </>}
  </main></div>
}
