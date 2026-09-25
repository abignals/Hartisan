import { useEffect, useState } from 'react'
import '../styles/etabli.css'
import '../styles/inscription.css'

function RegistrationHeader() {
  return <div className="auth-top"><a href="/" className="brand"><span className="brand-mark">H</span><span className="brand-name">Artisan</span></a></div>
}

export default function Inscription() {
  return <div className="etb"><RegistrationHeader /><main className="auth-shell registration-choice">
    <div className="auth-card wide"><p className="eyebrow">Bienvenue sur Hartisan</p><h1>Quel compte souhaitez-vous créer ?</h1><p className="auth-lead">Choisissez le parcours qui correspond à votre besoin.</p>
      <div className="registration-options">
        <a href="/inscription/client"><span className="registration-choice-icon" aria-hidden="true">⌂</span><h2>Je suis client</h2><p>Je cherche un artisan pour mon logement.</p><ul><li>Trouver un professionnel</li><li>Demander un rendez-vous</li><li>Échanger et conserver mes documents</li></ul><strong>Créer mon compte client →</strong></a>
        <a href="/inscription/artisan"><span className="registration-choice-icon" aria-hidden="true">⚒</span><h2>Je suis artisan</h2><p>Je souhaite proposer mes services.</p><ul><li>Présenter mon entreprise et mes métiers</li><li>Gérer mes disponibilités</li><li>Recevoir des demandes et échanger</li></ul><strong>Créer mon compte artisan →</strong></a>
      </div>
      <p className="auth-switch">Déjà inscrit ? <a href="/connexion">Se connecter</a></p>
    </div>
  </main></div>
}

export function InscriptionClient() { return <RegistrationForm artisan={false} /> }
export function InscriptionArtisan() { return <RegistrationForm artisan /> }

function RegistrationForm({ artisan }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmation: '', company_name: '', siret: '', description: '', address_line: '', postal_code: '', city: '', radius: '20', trade_ids: [] })
  const [step, setStep] = useState(1)
  const [trades, setTrades] = useState([])
  const [tradeError, setTradeError] = useState('')
  const [tradeVersion, setTradeVersion] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  useEffect(() => {
    if (!artisan) return
    const controller = new AbortController()
    setTradeError('')
    fetch('/api/trades', { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Impossible de charger les métiers.')
      const data = await res.json()
      if (!controller.signal.aborted) { setTrades(data); if (!data.length) setTradeError('Aucun métier disponible pour le moment.') }
    }).catch(e => { if (!controller.signal.aborted) setTradeError(e.message) })
    return () => controller.abort()
  }, [artisan, tradeVersion])
  function update(e) { setForm(previous => ({ ...previous, [e.target.name]: e.target.value })) }
  function field(name, label, options = {}) {
    return <label className="fld"><span className="fld-label">{label}</span><input className="input" name={name} value={form[name]} onChange={update} required maxLength={100} {...options} /></label>
  }
  async function submit(e) {
    e.preventDefault(); setError('')
    if (step === 1 && (form.password.length < 12 || new TextEncoder().encode(form.password).length > 72)) { setError('Le mot de passe doit contenir au moins 12 caractères, dans la limite de 72 octets.'); return }
    if (step === 1 && form.password !== form.confirmation) { setError('Les deux mots de passe ne correspondent pas.'); return }
    if (artisan && step === 2 && !form.trade_ids.length) { setError('Sélectionnez au moins un métier.'); return }
    if (artisan && step < 3) { setStep(step + 1); return }
    setBusy(true)
    try {
      const body = { role: artisan ? 'artisan' : 'client', first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password }
      if (artisan) Object.assign(body, { company_name: form.company_name.trim(), siret: form.siret.replaceAll(' ', ''), description: form.description.trim(), trade_ids: form.trade_ids, address_line: form.address_line.trim(), postal_code: form.postal_code.trim(), city: form.city.trim(), service_radius_m: Number(form.radius) * 1000 })
      const res = await fetch(`/api/register/${body.role}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Inscription impossible.')
      setForm(previous => ({ ...previous, password: '', confirmation: '' })); setSuccess(true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="etb"><RegistrationHeader /><main className="auth-shell">
    {success ? <section className="auth-card wide"><span className={`stamp ${artisan ? 'pending' : 'confirmed'}`}>{artisan ? 'Compte créé · validation en attente' : 'Compte créé'}</span><h1>{artisan ? 'Votre compte professionnel est créé' : 'Bienvenue chez Hartisan'}</h1>
      <p className="auth-lead">{artisan ? 'Vos informations professionnelles sont enregistrées. Votre fiche ne sera visible dans la recherche qu’après validation du profil.' : 'Vous pouvez vous connecter et chercher votre premier artisan.'}</p>
      {artisan && <p>Après connexion, retrouvez vos informations dans Profil et renseignez vos disponibilités dans Emploi du temps.</p>}
      <a className="btn btn-primary btn-block" href={`/connexion?role=${artisan ? 'artisan' : 'client'}`}>Se connecter</a>
    </section> : <form className="auth-card wide registration-form" onSubmit={submit}>
      <a className="registration-back" href={artisan ? '/pro' : '/connexion'}>← {artisan ? 'Découvrir Hartisan pour les artisans' : 'Se connecter'}</a>
      <p className="eyebrow">{artisan ? 'Espace professionnel' : 'Pour votre logement'}</p><h1>{artisan ? 'Créer mon compte artisan' : 'Créer mon compte client'}</h1>
      <p className="auth-lead">{artisan ? 'Présentez votre entreprise pour recevoir des demandes adaptées à votre activité.' : 'Vos coordonnées suffisent pour commencer.'}</p>
      {artisan && <ol className="registration-steps">{['Votre compte', 'Votre activité', 'Votre zone'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <fieldset disabled={busy} className="registration-fields">
        {step === 1 && <div className="field-stack">
          {artisan && <h2>Vos coordonnées de contact</h2>}
          <div className="duo">{field('first_name', 'Prénom', { autoComplete: 'given-name' })}{field('last_name', 'Nom', { autoComplete: 'family-name' })}</div>
          {field('email', artisan ? 'Email professionnel / identifiant de connexion' : 'Email / identifiant de connexion', { type: 'email', autoComplete: 'email', maxLength: 254 })}
          {field('phone', 'Téléphone', { type: 'tel', autoComplete: 'tel', maxLength: 40, placeholder: '06 12 34 56 78' })}
          {field('password', 'Mot de passe', { type: 'password', autoComplete: 'new-password', minLength: 12, maxLength: 72 })}<span className="input-hint">12 caractères minimum.</span>
          {field('confirmation', 'Confirmer le mot de passe', { type: 'password', autoComplete: 'new-password', maxLength: 72 })}
        </div>}
        {artisan && step === 2 && <div className="field-stack">
          <h2>Votre entreprise et vos savoir-faire</h2>
          {field('company_name', 'Nom de l’entreprise / nom commercial', { autoComplete: 'organization', maxLength: 160 })}
          {field('siret', 'SIRET', { inputMode: 'numeric', pattern: '[0-9 ]{14,20}', maxLength: 20, placeholder: '14 chiffres' })}
          <p className="input-hint">Le SIRET renseigné sera à vérifier ; il ne donne pas automatiquement le statut « Vérifié ».</p>
          <fieldset className="registration-trades"><legend className="fld-label">Métiers exercés — plusieurs choix possibles</legend>
            {tradeError ? <p role="alert">{tradeError} <button type="button" className="pill-link" onClick={() => setTradeVersion(v => v + 1)}>Réessayer</button></p> : !trades.length ? <p>Chargement des métiers…</p> : <div className="chips">{trades.map(trade => <label className="chip" key={trade.id}><input type="checkbox" checked={form.trade_ids.includes(trade.id)} onChange={e => setForm(previous => ({ ...previous, trade_ids: e.target.checked ? [...previous.trade_ids, trade.id] : previous.trade_ids.filter(id => id !== trade.id) }))} /><span>{trade.label}</span></label>)}</div>}
          </fieldset>
          <label className="fld"><span className="fld-label">Présentation et spécialités</span><textarea className="input" name="description" required minLength={20} maxLength={2000} rows={5} value={form.description} onChange={update} placeholder="Votre expérience, les équipements sur lesquels vous intervenez, vos spécialités et les types de travaux proposés…" /></label>
          <p className="input-hint">20 à 2 000 caractères. Cette présentation figurera sur votre fiche publique après validation.</p>
        </div>}
        {artisan && step === 3 && <div className="field-stack">
          <h2>Où intervenez-vous ?</h2>
          {field('address_line', 'Adresse professionnelle', { autoComplete: 'street-address', minLength: 5, maxLength: 500, placeholder: 'Numéro et nom de rue' })}
          <div className="duo">{field('postal_code', 'Code postal', { autoComplete: 'postal-code', inputMode: 'numeric', pattern: '[0-9]{5}', maxLength: 5 })}{field('city', 'Ville', { autoComplete: 'address-level2', minLength: 2, maxLength: 160 })}</div>
          {field('radius', 'Rayon d’intervention autour de votre adresse (km)', { type: 'number', min: 1, max: 100, step: 1 })}
          <p className="input-hint">L’adresse précise ne s’affiche pas dans votre fiche publique. La ville et la zone d’intervention y apparaissent.</p>
          <div className="registration-summary"><h3>Votre profil en résumé</h3><p><strong>{form.company_name}</strong> · SIRET {form.siret}</p><p>{trades.filter(trade => form.trade_ids.includes(trade.id)).map(trade => trade.label).join(' · ')}</p><p>{form.first_name} {form.last_name} · {form.email}</p><p>Votre profil sera créé en attente de validation. Vos horaires seront à renseigner depuis votre planning.</p></div>
        </div>}
      </fieldset>
      <div className="auth-actions registration-actions">
        {artisan && step > 1 && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setStep(step - 1); setError('') }}>← Précédent</button>}
        <button className="btn btn-primary" disabled={busy || (artisan && step === 2 && (!trades.length || !!tradeError))}>{busy ? 'Création…' : artisan && step < 3 ? 'Continuer →' : artisan ? 'Créer mon compte artisan' : 'Créer mon compte client'}</button>
      </div>
      <p className="auth-switch">Déjà inscrit ? <a href={`/connexion?role=${artisan ? 'artisan' : 'client'}`}>Se connecter</a></p>
    </form>}
  </main></div>
}
