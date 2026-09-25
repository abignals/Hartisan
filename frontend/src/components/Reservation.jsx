import { useEffect, useState } from 'react'
import PhotoPicker from './PhotoPicker.jsx'
import { sendPhoto } from '../lib/messagePhotos.js'
import Entete from './Entete.jsx'
import { useUtilisateur } from '../hooks/useUtilisateur.js'
import { bookingAPI, postJSON, parisDate, addDays, bookingDate, bookingTime, minutesLabel } from '../lib/booking.js'
import '../styles/etabli.css'
import '../styles/booking.css'

const MOTIFS = ['Fuite ou problème de plomberie', 'Panne ou problème électrique', 'Chauffage ou eau chaude', 'Projet de travaux / besoin d’un devis', 'Je ne sais pas précisément']

export default function Reservation() {
  const id = window.location.pathname.split('/')[2]
  const { utilisateur, chargement } = useUtilisateur()
  const [artisan, setArtisan] = useState(null)
  const [from, setFrom] = useState(parisDate())
  const [slots, setSlots] = useState(null)
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [photos, setPhotos] = useState([])
  const [conversation, setConversation] = useState('')
  const [version, setVersion] = useState(0)
  const [details, setDetails] = useState({ title: '', description: '', address: '', postal_code: '', city: '', contact_name: '', contact_phone: '', authorized: false })

  useEffect(() => {
    const controller = new AbortController()
    bookingAPI(`/api/artisans/${id}`, { signal: controller.signal }).then(setArtisan).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    setSlots(null)
    bookingAPI(`/api/artisans/${id}/slots?from=${from}&until=${addDays(from, 7)}`, { signal: controller.signal })
      .then(setSlots).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [id, from, version])
  useEffect(() => {
    if (utilisateur) setDetails(previous => ({ ...previous, contact_name: `${utilisateur.first_name} ${utilisateur.last_name}`, contact_phone: utilisateur.phone || '' }))
  }, [utilisateur])
  const update = (name, value) => setDetails(previous => ({ ...previous, [name]: value }))

  async function uploadPhotos(id = conversation) {
    setBusy(true); setError('')
    const remaining = [...photos]
    try {
      while (remaining.length) {
        await sendPhoto(id, remaining[0])
        remaining.shift(); setPhotos([...remaining])
      }
    } catch (e) { setError(`La demande de rendez-vous est enregistrée. ${e.message} Les photos restantes n’ont pas été envoyées ; vous pouvez réessayer ou les retirer.`) }
    finally { setBusy(false) }
  }

  async function submit() {
    setBusy(true); setError('')
    try {
      const result = await bookingAPI('/api/appointments', postJSON({ ...details, artisan_id: id, starts_at: selected.starts_at }))
      setConversation(result.conversation_id)
      setSuccess(true)
      await uploadPhotos(result.conversation_id)
    } catch (e) {
      setError(e.message)
      if (e.status === 409) { setSelected(null); setStep(1); setVersion(v => v + 1) }
    } finally { setBusy(false) }
  }

  return <div className="etb"><Entete /><main className="page booking-page">
    <a href={`/artisan/${id}`} className="booking-back">← Retour au profil</a>
    <h1>Prendre un premier rendez-vous</h1>
    <p className="booking-subtitle">{artisan?.name.replace('[TEST] ', '') || (error ? 'Professionnel indisponible' : 'Chargement du professionnel…')}</p>
    {artisan?.test_key && <p className="booking-notice">Compte artisan fictif : les demandes sont enregistrées uniquement pour vos essais locaux.</p>}
    {error && <p role="alert" className="booking-error">{error}</p>}
    {success ? <section className="booking-card booking-success" role="status">
      <h2>Votre demande a été envoyée</h2>
      <p>{bookingDate(selected.starts_at)} à {bookingTime(selected.starts_at)}.</p>
      <p>Le créneau est bloqué pendant 24 heures, le temps que l’artisan accepte. <strong>Le rendez-vous n’est pas encore confirmé.</strong></p>
      <p>Sans réponse, la demande expirera automatiquement. Retrouvez son statut dans vos rendez-vous.</p>
      {busy && <p role="status">Envoi des photos… Restez sur cette page.</p>}
      {photos.length > 0 && !busy && <><PhotoPicker files={photos} onChange={setPhotos} /><button className="btn btn-primary" onClick={() => uploadPhotos()}>Réessayer l’envoi des photos</button></>}
      {!busy && <div className="booking-actions"><a className="btn btn-primary" href={`/messages?c=${conversation}`}>Écrire à l’artisan</a><a className="btn btn-ghost" href="/rdv">Voir mes rendez-vous</a></div>}
    </section> : <>
      <ol className="booking-steps" aria-label="Étapes de réservation">{['Choisir un créneau', 'Décrire votre besoin', 'Vérifier la demande'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
      {step === 1 && <section className="booking-card">
        <h2>Choisissez un créneau de diagnostic</h2>
        <p>Pour comprendre votre besoin et évaluer les travaux. Une réparation immédiate n’est pas garantie ; le prix devra être convenu avec l’artisan.</p>
        {slots && <p className="booking-notice">Sur place : <strong>{minutesLabel(slots.diagnostic_minutes)}</strong> · Marge de trajet : {minutesLabel(slots.buffer_minutes)} · Horaires de Paris.</p>}
        <div className="booking-period"><button className="btn btn-ghost" disabled={from <= parisDate()} onClick={() => { setFrom(previous => addDays(previous, -7) < parisDate() ? parisDate() : addDays(previous, -7)); setSelected(null); setError('') }}>← Précédent</button><strong>{bookingDate(`${from}T12:00:00Z`)} — {bookingDate(`${addDays(from, 6)}T12:00:00Z`)}</strong><button className="btn btn-ghost" disabled={addDays(from, 14) > addDays(parisDate(), 90)} onClick={() => { setFrom(addDays(from, 7)); setSelected(null); setError('') }}>Suivant →</button></div>
        {!slots ? (!error && <p role="status">Chargement des créneaux…</p>) : !slots.slots.length ? <p className="booking-empty">Aucun créneau proposé sur cette période. Essayez la semaine suivante. L’artisan doit avoir renseigné ses horaires pour proposer des rendez-vous.</p> : <div className="booking-slot-days">{Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(day => {
          const available = slots.slots.filter(slot => parisDate(slot.starts_at) === day)
          return <section key={day}><h3>{new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}</h3><div>{available.length ? available.map(slot => <button key={slot.starts_at} aria-pressed={selected?.starts_at === slot.starts_at} onClick={() => setSelected(slot)}>{bookingTime(slot.starts_at)}</button>) : <span className="booking-muted">Aucun créneau</span>}</div></section>
        })}</div>}
        <p className="booking-muted">Réservation au moins 24 heures à l’avance. Le créneau sera revérifié lors de l’envoi.</p>
        {!chargement && utilisateur?.role !== 'client' ? <p>{utilisateur ? 'La réservation est réservée aux comptes clients.' : <a className="btn btn-primary" href={`/connexion?retour=${encodeURIComponent(window.location.pathname)}`}>Se connecter pour continuer</a>}</p> : <button className="btn btn-primary" disabled={!selected || chargement} onClick={() => { setStep(2); setError('') }}>Continuer{selected ? ` · ${bookingTime(selected.starts_at)}` : ''}</button>}
      </section>}
      {step === 2 && <form className="booking-card booking-form" onSubmit={e => { e.preventDefault(); setStep(3); setError('') }}>
        <h2>Votre besoin et l’adresse d’intervention</h2>
        <p>{bookingDate(selected.starts_at)} · {bookingTime(selected.starts_at)}–{bookingTime(selected.ends_at)}</p>
        <label>Motif du rendez-vous<select required value={details.title} onChange={e => update('title', e.target.value)}><option value="">Choisir un motif</option>{MOTIFS.map(motif => <option key={motif}>{motif}</option>)}</select></label>
        <label>Décrivez le problème<textarea required minLength={10} maxLength={2000} rows={4} placeholder="Depuis quand ? Quel équipement ? Que constatez-vous ?" value={details.description} onChange={e => update('description', e.target.value)} /></label>
        <PhotoPicker files={photos} onChange={setPhotos} />
        <p>Les photos seront envoyées dans votre conversation dès la demande enregistrée, avant l’acceptation de l’artisan.</p>
        <label>Adresse complète<input required minLength={5} maxLength={500} autoComplete="street-address" placeholder="Numéro, rue, bâtiment, étage…" value={details.address} onChange={e => update('address', e.target.value)} /></label>
        <div className="booking-form-row"><label>Code postal<input required pattern="[0-9]{5}" maxLength={5} inputMode="numeric" autoComplete="postal-code" value={details.postal_code} onChange={e => update('postal_code', e.target.value)} /></label><label>Ville<input required minLength={2} maxLength={160} autoComplete="address-level2" value={details.city} onChange={e => update('city', e.target.value)} /></label></div>
        <h3>Qui accueillera l’artisan ?</h3><p>Vous pouvez réserver pour un proche. Indiquez la personne présente sur place et un numéro pour la joindre.</p>
        <div className="booking-form-row"><label>Nom du contact<input required minLength={2} maxLength={160} value={details.contact_name} onChange={e => update('contact_name', e.target.value)} /></label><label>Téléphone du contact<input required type="tel" minLength={6} maxLength={40} value={details.contact_phone} onChange={e => update('contact_phone', e.target.value)} /></label></div>
        <label className="booking-checkbox"><input type="checkbox" required checked={details.authorized} onChange={e => update('authorized', e.target.checked)} />J’ai l’accord de la personne concernée pour organiser ce rendez-vous et communiquer ses coordonnées à l’artisan.</label>
        <div className="booking-actions"><button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Retour aux créneaux</button><button className="btn btn-primary">Vérifier ma demande</button></div>
      </form>}
      {step === 3 && <section className="booking-card">
        <h2>Vérifiez votre demande</h2>
        <p>{photos.length} photo(s) à joindre à votre demande.</p>
        <dl className="booking-summary"><div><dt>Professionnel</dt><dd>{artisan?.name.replace('[TEST] ', '')}</dd></div><div><dt>Rendez-vous</dt><dd>{bookingDate(selected.starts_at)} · {bookingTime(selected.starts_at)}–{bookingTime(selected.ends_at)}</dd></div><div><dt>Motif</dt><dd>{details.title}</dd></div><div><dt>Votre besoin</dt><dd>{details.description}</dd></div><div><dt>Adresse</dt><dd>{details.address}, {details.postal_code} {details.city}</dd></div><div><dt>Contact sur place</dt><dd>{details.contact_name} · {details.contact_phone}</dd></div></dl>
        <p className="booking-notice">L’artisan a 24 heures pour accepter. Ce rendez-vous ne garantit ni un prix ni une réparation immédiate.</p>
        <div className="booking-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => setStep(2)}>Modifier</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Envoi…' : 'Envoyer ma demande'}</button></div>
      </section>}
    </>}
  </main></div>
}
