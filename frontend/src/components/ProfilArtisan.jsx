import { useEffect, useState } from 'react'
import AccountSettings from './AccountSettings.jsx'
import Entete from './Entete.jsx'
import '../styles/etabli.css'

const STATUTS = {
  pending:   { libelle: 'En attente de validation', classe: 'pending' },
  approved:  { libelle: 'Vérifié',                  classe: 'confirmed' },
  rejected:  { libelle: 'Refusé',                   classe: 'none' },
  suspended: { libelle: 'Suspendu',                 classe: 'none' },
}

const RAIL = [
  { id: 'informations', libelle: 'Informations et sécurité' },
  { id: 'verification', libelle: 'Vérification pro' },
  { id: 'activite',     libelle: 'Mon activité' },
  { id: 'zone',         libelle: "Zone d'intervention" },
  { id: 'danger',       libelle: 'Supprimer le compte' },
]

function PillInerte({ libelle, danger }) {
  return (
    <span
      className={`pill-link disabled${danger ? ' danger' : ''}`}
      aria-disabled="true"
      title="Bientot disponible"
    >
      {libelle}
    </span>
  )
}

export default function ProfilArtisan() {
  const [form, setForm] = useState(null)
  const [metiers, setMetiers] = useState([])
  const [erreur, setErreur] = useState(null)
  const [succes, setSucces] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [ancre, setAncre] = useState('verification')

  useEffect(() => {
    Promise.all([
      fetch('/api/artisan/profile', { credentials: 'same-origin' }),
      fetch('/api/trades', { credentials: 'same-origin' }),
    ])
      .then(async ([resProfil, resMetiers]) => {
        if (resProfil.status === 401) {
          window.location.href = '/connexion?role=artisan'
          return
        }
        if (resProfil.status === 403) {
          window.location.href = '/profil'
          return
        }
        if (!resProfil.ok || !resMetiers.ok) throw new Error()

        const profil = await resProfil.json()
        // la base stocke des metres, l'artisan raisonne en kilometres
        setForm({ ...profil, rayon_km: String(profil.service_radius_m / 1000) })
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
          company_name: form.company_name,
          siret: form.siret,
          description: form.description,
          address_line: form.address_line,
          postal_code: form.postal_code,
          city: form.city,
          // les inputs renvoient des chaines, Go attend des entiers
          service_radius_m: Number(form.rayon_km) * 1000,
          default_slot_minutes: Number(form.default_slot_minutes),
          trade_ids: form.trade_ids,
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

  async function deconnexion() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/'
  }

  if (!form) {
    return (
      <div className="etb">
        <Entete />
        <div className="page">
          <p className="state-card" role={erreur ? 'alert' : undefined}>
            {erreur ?? 'Chargement…'}
          </p>
        </div>
      </div>
    )
  }

  const statut = STATUTS[form.status] ?? { libelle: form.status, classe: 'pending' }

  return (
    <div className="etb">
      <Entete />

      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Mon compte pro</p>
          <h1>Profil</h1>
          <p>Vos informations, votre vérification professionnelle et votre zone d'intervention.</p>
        </div>

        <div className="layout-with-rail">
          <div className="rail">
            {RAIL.map((r) => (
              <a
                key={r.id}
                href={`#${r.id}`}
                className={ancre === r.id ? 'current' : undefined}
                onClick={() => setAncre(r.id)}
              >
                {r.libelle}
              </a>
            ))}
          </div>

          <div>
          <AccountSettings />
          <form onSubmit={handleSubmit}>
            {erreur && <p className="alert alert-error" role="alert">{erreur}</p>}
            {succes && <p className="alert alert-ok">Modifications enregistrées.</p>}

            {/* VÉRIFICATION PRO */}
            <section className="section" id="verification">
              <div className="section-head">
                <h2>Vérification professionnelle</h2>
                <span className={`stamp ${statut.classe}`}>{statut.libelle}</span>
              </div>

              <div className="field-row">
                <span className="field-label">SIRET</span>
                <input
                  className="input"
                  type="text"
                  name="siret"
                  inputMode="numeric"
                  placeholder="Optionnel"
                  value={form.siret}
                  onChange={handleChange}
                />
              </div>
              <div className="field-row">
                <span className="field-label">Diplôme / certification</span>
                <span className="field-value muted">Aucun document</span>
                <PillInerte libelle="Ajouter" />
              </div>
              <div className="field-row">
                <span className="field-label">Assurance décennale</span>
                <span className="field-value muted">Aucun document</span>
                <PillInerte libelle="Ajouter" />
              </div>

              <p className="note">
                Ces documents sont revérifiés périodiquement. Un profil non vérifié
                n'apparaît pas dans les résultats de recherche client tant que les
                justificatifs ne sont pas validés.
              </p>
            </section>

            {/* ACTIVITÉ */}
            <section className="section" id="activite">
              <div className="section-head">
                <h2>Mon activité</h2>
                <span className="hint">Visible sur votre fiche publique</span>
              </div>

              <div className="field-row">
                <span className="field-label">Nom de l'entreprise</span>
                <input
                  className="input"
                  type="text"
                  name="company_name"
                  required
                  value={form.company_name}
                  onChange={handleChange}
                />
              </div>

              <div className="field-row">
                <span className="field-label">Description</span>
                <textarea
                  className="input"
                  name="description"
                  rows={4}
                  placeholder="Présentez votre activité, vos spécialités…"
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              <div className="field-row">
                <span className="field-label">Métiers exercés</span>
                <div className="chips">
                  {metiers.map((m) => (
                    <label className="chip" key={m.id}>
                      <input
                        type="checkbox"
                        checked={form.trade_ids.includes(m.id)}
                        onChange={() => basculeMetier(m.id)}
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <span className="field-label">Durée d'un RDV</span>
                <span>
                  <input
                    className="input"
                    type="number"
                    name="default_slot_minutes"
                    min={15}
                    max={480}
                    step={15}
                    required
                    value={form.default_slot_minutes}
                    onChange={handleChange}
                  />
                  <span className="input-hint">en minutes, entre 15 et 480</span>
                </span>
              </div>
            </section>

            {/* ZONE D'INTERVENTION */}
            <section className="section" id="zone">
              <div className="section-head">
                <h2>Zone d'intervention</h2>
              </div>

              <div className="field-row">
                <span className="field-label">Adresse</span>
                <input
                  className="input"
                  type="text"
                  name="address_line"
                  autoComplete="street-address"
                  value={form.address_line}
                  onChange={handleChange}
                />
              </div>

              <div className="field-row">
                <span className="field-label">Code postal</span>
                <input
                  className="input"
                  type="text"
                  name="postal_code"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  required
                  value={form.postal_code}
                  onChange={handleChange}
                />
              </div>

              <div className="field-row">
                <span className="field-label">Ville</span>
                <input
                  className="input"
                  type="text"
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={form.city}
                  onChange={handleChange}
                />
              </div>

              <div className="field-row">
                <span className="field-label">Rayon d'intervention</span>
                <span>
                  <input
                    className="input"
                    type="number"
                    name="rayon_km"
                    min={1}
                    max={100}
                    required
                    value={form.rayon_km}
                    onChange={handleChange}
                  />
                  <span className="input-hint">en kilomètres, entre 1 et 100</span>
                </span>
              </div>

              <p className="note">
                Le positionnement géographique exact n'est pas encore calculé à partir de
                cette adresse : la recherche par distance restera approximative tant que
                le géocodage ne sera pas branché.
              </p>
            </section>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={envoi}>
                {envoi ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <a className="btn btn-ghost" href="/">Retour à l'accueil</a>
            </div>

            {/* DANGER ZONE */}
            <section className="section danger-zone section-spaced" id="danger">
              <div className="section-head">
                <h2>Supprimer le compte</h2>
              </div>
              <p>
                Cette action est définitive et supprime votre historique clients,
                messages et documents.
              </p>
              <PillInerte libelle="Supprimer mon compte" danger />
            </section>

            <button className="pill-link" type="button" onClick={deconnexion}>
              Se déconnecter
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
