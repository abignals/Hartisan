import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import '../styles/index.css'

const LIBELLES_STATUT = {
  pending:   'En attente de validation',
  approved:  'Profil valide',
  rejected:  'Profil refuse',
  suspended: 'Profil suspendu',
}

export default function ProfilArtisan() {
  const [form, setForm] = useState(null)
  const [metiers, setMetiers] = useState([])
  const [erreur, setErreur] = useState(null)
  const [succes, setSucces] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/artisan/profile', { credentials: 'same-origin' }),
      fetch('/api/trades', { credentials: 'same-origin' }),
    ])
      .then(async ([resProfil, resMetiers]) => {
        if (resProfil.status === 401) {
          window.location.href = '/connexion'
          return
        }
        if (resProfil.status === 403) {
          window.location.href = '/profil'
          return
        }
        if (!resProfil.ok || !resMetiers.ok) throw new Error()

        setForm(await resProfil.json())
        setMetiers(await resMetiers.json())
      })
      .catch(() => setErreur('Impossible de charger votre profil.'))
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  function basculeMetier(id) {
    setForm((f) => ({
      ...f,
      trade_ids: f.trade_ids.includes(id)
        ? f.trade_ids.filter((x) => x !== id)
        : [...f.trade_ids, id],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur(null)
    setSucces(false)
    setEnvoi(true)

    try {
      const res = await fetch('/api/artisan/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...form,
          // les inputs renvoient des chaines, Go attend des entiers
          service_radius_m: Number(form.service_radius_m),
          default_slot_minutes: Number(form.default_slot_minutes),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErreur(data.error ?? 'Enregistrement impossible.')
        return
      }
      setSucces(true)
    } catch {
      setErreur('Serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  if (erreur && !form) {
    return (
      <>
        <Entete />
        <main className="auth">
          <div className="auth__card">
            <p className="auth__error" role="alert">{erreur}</p>
          </div>
        </main>
      </>
    )
  }

  if (!form) {
    return (
      <>
        <Entete />
        <main className="auth">
          <div className="auth__card">
            <p className="auth__lead">Chargement...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Entete />
      <main className="auth">
        <form className="auth__card" onSubmit={handleSubmit}>
          <h1 className="auth__title">Mon activite</h1>
          <p className="auth__lead">
            Ces informations apparaitront sur votre fiche publique.
          </p>

          <span className="badge">{LIBELLES_STATUT[form.status] ?? form.status}</span>

          {erreur && <p className="auth__error" role="alert">{erreur}</p>}
          {succes && <p className="auth__lead">Modifications enregistrees.</p>}

          <label className="field">
            <span className="field__label">Nom de l'entreprise</span>
            <input
              className="field__input"
              type="text"
              name="company_name"
              required
              value={form.company_name}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span className="field__label">SIRET</span>
            <input
              className="field__input"
              type="text"
              name="siret"
              inputMode="numeric"
              placeholder="Optionnel"
              value={form.siret}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="field__input"
              name="description"
              rows={4}
              placeholder="Presentez votre activite, vos specialites..."
              value={form.description}
              onChange={handleChange}
            />
          </label>

          <fieldset className="roles">
            <legend className="field__label">Mes metiers</legend>
            {metiers.map((m) => (
              <label className="role" key={m.id}>
                <input
                  type="checkbox"
                  checked={form.trade_ids.includes(m.id)}
                  onChange={() => basculeMetier(m.id)}
                />
                <span className="role__box">
                  <span className="role__titre">{m.label}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="field__label">Adresse</span>
            <input
              className="field__input"
              type="text"
              name="address_line"
              autoComplete="street-address"
              value={form.address_line}
              onChange={handleChange}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Code postal</span>
              <input
                className="field__input"
                type="text"
                name="postal_code"
                autoComplete="postal-code"
                inputMode="numeric"
                required
                value={form.postal_code}
                onChange={handleChange}
              />
            </label>

            <label className="field">
              <span className="field__label">Ville</span>
              <input
                className="field__input"
                type="text"
                name="city"
                autoComplete="address-level2"
                required
                value={form.city}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Rayon d'intervention (km)</span>
              <input
                className="field__input"
                type="number"
                name="service_radius_m"
                min={1}
                max={100}
                required
                value={form.service_radius_m}
                onChange={handleChange}
              />
              <span className="field__hint">Entre 1 et 100 km</span>
            </label>

            <label className="field">
              <span className="field__label">Duree d'un RDV (min)</span>
              <input
                className="field__input"
                type="number"
                name="default_slot_minutes"
                min={15}
                max={480}
                step={15}
                required
                value={form.default_slot_minutes}
                onChange={handleChange}
              />
            </label>
          </div>

          <button className="btn btn--primary btn--block" type="submit" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          <a className="btn btn--outline btn--block" href="/">Retour a l'accueil</a>
        </form>
      </main>
    </>
  )
}
