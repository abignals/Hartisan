import { useEffect, useState } from 'react'
import { bookingAPI, postJSON, bookingDate, bookingTime, statuses, kinds } from '../lib/booking.js'

import Entete from './Entete.jsx'
import { useUtilisateur } from '../hooks/useUtilisateur.js'
import '../styles/etabli.css'
import '../styles/booking.css'

export default function AppointmentDetails() {
  const { utilisateur } = useUtilisateur()
  const artisan = utilisateur?.role === 'artisan'
  const id = window.location.pathname.split('/').at(-1)
  const [event, setEvent] = useState(null)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try { const data = await bookingAPI(`/api/appointments/${id}`, { signal: controller.signal }); if (!controller.signal.aborted) { setEvent(data); setLoadError('') } }
      catch (e) { if (!controller.signal.aborted) setLoadError(e.message) }
    }
    load(); const timer = setInterval(load, 5000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [id])
  async function onAction(id, action, reason) {
    await bookingAPI(`/api/appointments/${id}/action`, postJSON({ action, reason }))
    setEvent(await bookingAPI(`/api/appointments/${id}`))
  }
  return <div className="etb"><Entete /><main className="page booking-page booking-detail-page">
    <a className="booking-back" href={artisan ? '/pro/planning' : '/rdv'}>← Retour {artisan ? 'au planning' : 'à mes rendez-vous'}</a>
    <h1>Détails du rendez-vous</h1>
    {loadError && <p className="booking-error" role="alert">{loadError}</p>}
    {event ? <Details event={event} artisan={artisan} onAction={onAction} /> : !loadError && <p>Chargement…</p>}
  </main></div>
}

function Details({ event, artisan, onAction }) {
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = ['pending', 'confirmed'].includes(event.status)
  const canCancel = active && (artisan || new Date(event.starts_at) > new Date())
  async function execute() {
    setBusy(true); setError('')
    try { await onAction(event.id, action, reason); setAction('') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <section className="booking-card booking-detail-content">
    <h2>{event.title}</h2>
    <span className={`booking-status status-${event.status}`}>{statuses[event.status]}</span>
    <p>{kinds[event.kind]}</p>
    {event.conversation_id ? <div className="booking-notice"><p>Échangez directement pour préparer votre rendez-vous.</p><a className="btn btn-primary" href={`${artisan ? '/pro/messages' : '/messages'}?c=${event.conversation_id}`}>{artisan ? 'Écrire au client' : 'Écrire à l’artisan'}</a></div> : event.status === 'pending' && <p className="booking-notice">La conversation sera accessible dès l’enregistrement de la demande.</p>}
    <dl className="booking-summary">
      <div><dt>Début</dt><dd>{bookingDate(event.starts_at)} à {bookingTime(event.starts_at)}</dd></div>
      <div><dt>Fin</dt><dd>{bookingDate(event.ends_at)} à {bookingTime(event.ends_at)}</dd></div>
      {artisan && event.busy_until !== event.ends_at && <div><dt>Trajet réservé jusqu’à</dt><dd>{bookingTime(event.busy_until)}</dd></div>}
      {event.kind === 'diagnostic' && <>
        <div><dt>{artisan ? 'Réservé par' : 'Artisan'}</dt><dd>{artisan ? event.client_name : event.artisan_name.replace('[TEST] ', '')}</dd></div>
        <div><dt>Besoin</dt><dd>{event.description}</dd></div>
        <div><dt>Adresse</dt><dd>{event.address}, {event.postal_code} {event.city}</dd></div>
        <div><dt>Contact sur place</dt><dd>{event.contact_name} · {event.contact_phone}</dd></div>
      </>}
      {event.status === 'pending' && <div><dt>Réponse avant le</dt><dd>{bookingDate(event.expires_at)} à {bookingTime(event.expires_at)}</dd></div>}
      {event.change_reason && <div><dt>Motif de modification</dt><dd>{event.change_reason}</dd></div>}
    </dl>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!action ? <div className="booking-actions">
      {artisan && event.kind === 'diagnostic' && event.status === 'pending' && <><button className="btn btn-primary" onClick={() => setAction('accept')}>Accepter</button><button className="btn btn-ghost" onClick={() => setAction('reject')}>Refuser</button></>}
      {canCancel && <button className="btn booking-danger" onClick={() => setAction('cancel')}>{event.kind === 'diagnostic' ? 'Annuler ce rendez-vous' : 'Libérer cette période'}</button>}
    </div> : <div className="booking-confirm-action">
      <h3>{action === 'accept' ? 'Confirmer ce rendez-vous ?' : action === 'reject' ? 'Refuser cette demande ?' : 'Libérer ce créneau ?'}</h3>
      {action !== 'accept' && <label>Motif (facultatif)<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>}
      <div className="booking-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => setAction('')}>Retour</button><button className="btn btn-primary" disabled={busy} onClick={execute}>{busy ? 'Enregistrement…' : 'Confirmer'}</button></div>
    </div>}
  </section>
}
