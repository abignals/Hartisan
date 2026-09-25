import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import { useUtilisateur } from '../hooks/useUtilisateur.js'
import { bookingAPI, parisDate, addDays, bookingDate, bookingTime, statuses } from '../lib/booking.js'
import '../styles/etabli.css'
import '../styles/booking.css'

export default function RendezVous() {
  const { utilisateur, chargement } = useUtilisateur()
  const [from, setFrom] = useState(parisDate())
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (utilisateur?.role !== 'client') return
    const controller = new AbortController()
    async function load() {
      try {
        const data = await bookingAPI(`/api/appointments?from=${from}&until=${addDays(from, 90)}`, { signal: controller.signal })
        if (!controller.signal.aborted) { setEvents(data); setError('') }
      } catch (e) { if (!controller.signal.aborted) setError(e.message) }
    }
    setEvents(null); load()
    const timer = setInterval(load, 30000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [utilisateur, from])
  return <div className="etb"><Entete /><main className="page booking-page">
    <div className="booking-page-heading"><div><h1>Mes rendez-vous</h1><p>Suivez vos demandes et vos interventions confirmées.</p></div><a className="btn btn-primary" href="/recherche">Trouver un artisan</a></div>
    {chargement ? <p>Chargement…</p> : !utilisateur ? <a className="btn btn-primary" href="/connexion?retour=%2Frdv">Se connecter pour voir mes rendez-vous</a> : utilisateur.role !== 'client' ? <a href="/pro/planning">Accéder à mon planning artisan</a> : <>
      <p className="booking-notice">Une demande reste en attente jusqu’à son acceptation par l’artisan. Sans réponse sous 24 heures, elle expire et le créneau est libéré.</p>
      <div className="booking-period"><button className="btn btn-ghost" onClick={() => setFrom(addDays(from, -90))}>← Période précédente</button><span>{bookingDate(`${from}T12:00:00Z`)} — {bookingDate(`${addDays(from, 89)}T12:00:00Z`)}</span><button className="btn btn-ghost" onClick={() => setFrom(addDays(from, 90))}>Période suivante →</button></div>
      {error && <p role="alert" className="booking-error">{error}</p>}
      {!events ? (!error && <p role="status">Chargement des rendez-vous…</p>) : !events.length ? <div className="booking-card booking-empty"><h2>Aucun rendez-vous sur cette période</h2><p>Choisissez un artisan pour demander votre premier diagnostic.</p></div> : <div className="booking-client-list">{events.map(event => <article className="booking-card" key={event.id}>
        <div><span className={`booking-status status-${event.status}`}>{statuses[event.status]}</span><h2>{event.artisan_name.replace('[TEST] ', '')}</h2><p>{event.title}</p><p><strong>{bookingDate(event.starts_at)}</strong> · {bookingTime(event.starts_at)}–{bookingTime(event.ends_at)}</p><p>{event.city} ({event.postal_code})</p></div>
        <button className="btn btn-ghost" onClick={() => { window.location.href = `/rdv/${event.id}` }}>Voir les détails</button>
      </article>)}</div>}
    </>}
  </main></div>
}
