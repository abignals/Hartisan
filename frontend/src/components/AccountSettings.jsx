import { useEffect, useState } from 'react'
import { bookingAPI, postJSON } from '../lib/booking.js'
import '../styles/booking.css'

const FIELDS = [
  { key: 'first_name', label: 'Prénom', max: 100 },
  { key: 'last_name', label: 'Nom', max: 100 },
  { key: 'address_line', label: 'Adresse personnelle', max: 500 },
  { key: 'phone', label: 'Téléphone', type: 'tel', sensitive: true },
  { key: 'email', label: 'Email / identifiant de connexion', type: 'email', sensitive: true },
  { key: 'password', label: 'Mot de passe', type: 'password', sensitive: true },
]

export default function AccountSettings() {
  const [user, setUser] = useState(null)
  const [editing, setEditing] = useState(null)
  const [value, setValue] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reconnect, setReconnect] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    bookingAPI('/api/account', { signal: controller.signal }).then(setUser).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [])
  function edit(field) {
    setEditing(field); setValue(field.key === 'password' ? '' : user[field.key]); setPassword(''); setConfirmation(''); setError(''); setNotice('')
  }
  async function save(e) {
    e.preventDefault(); setError('')
    if (editing.sensitive && value !== confirmation) { setError('Les deux saisies ne correspondent pas.'); return }
    setBusy(true)
    try {
      const result = await bookingAPI('/api/account', postJSON({ field: editing.key, value, current_password: password }, 'PUT'))
      setPassword(''); setConfirmation(''); setEditing(null)
      if (result.reauthenticate) { setReconnect(true); setNotice('Modification enregistrée. Toutes les sessions ont été fermées. Reconnectez-vous avec votre email et votre mot de passe à jour.') }
      else { setUser(await bookingAPI('/api/account')); setNotice('Modification enregistrée.') }
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <section className="section account-settings" id="informations">
    <div className="section-head"><h2>Informations personnelles et sécurité</h2></div>
    {error && <p className="booking-error" role="alert">{error}</p>}
    {notice && <p className="booking-notice" role="status">{notice}</p>}
    {reconnect ? <a className="btn btn-primary" href={window.location.pathname.startsWith('/pro') ? '/connexion?role=artisan' : '/connexion'}>Se reconnecter</a> : !user ? !error && <p>Chargement…</p> : <>
      {FIELDS.map(field => <div key={field.key}>
        <div className="field-row"><span className="field-label">{field.label}</span><span className="field-value">{field.key === 'password' ? '••••••••••' : user[field.key] || 'Non renseignée'}</span><button className="pill-link" type="button" disabled={busy} onClick={() => edit(field)}>Modifier</button></div>
        {editing?.key === field.key && <form className="booking-form account-edit" onSubmit={save}>
          <fieldset disabled={busy}>
            <label>{field.key === 'password' ? 'Nouveau mot de passe' : field.label}<input autoFocus required={field.key !== 'address_line'} type={field.type || 'text'} autoComplete={field.key === 'password' ? 'new-password' : 'off'} minLength={field.key === 'password' ? 12 : undefined} maxLength={field.max || (field.key === 'email' ? 254 : field.key === 'phone' ? 40 : 72)} value={value} onChange={e => setValue(e.target.value)} /></label>
            {field.key === 'password' && <p>Au moins 12 caractères. Choisissez un mot de passe différent de l’actuel.</p>}
            {field.sensitive && <>
              <label>Confirmer {field.key === 'password' ? 'le nouveau mot de passe' : field.key === 'email' ? 'le nouvel email' : 'le nouveau téléphone'}<input required type={field.type} autoComplete={field.key === 'password' ? 'new-password' : 'off'} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
              <label>Votre mot de passe actuel<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
              <p>Cette modification nécessite votre mot de passe actuel et vous déconnectera sur tous vos appareils.</p>
            </>}
          </fieldset>
          <div className="booking-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setEditing(null); setPassword(''); setError('') }}>Annuler</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>}
      </div>)}
      <p className="note">Votre email sert d’identifiant de connexion. La saisie du mot de passe actuel protège les changements sensibles ; la vérification par code email ou SMS n’est pas encore disponible.</p>
    </>}
  </section>
}
