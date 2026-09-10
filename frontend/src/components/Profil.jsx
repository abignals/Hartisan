import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import '../styles/etabli.css'

const RAIL = [
  { id: 'informations', libelle: 'Informations' },
  { id: 'paiements',    libelle: 'Paiements & facturation' },
  { id: 'parametres',   libelle: 'Paramètres' },
  { id: 'danger',       libelle: 'Supprimer le compte' },
]

// Les actions de la maquette qui n'ont pas encore d'endpoint cote API.
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

export default function Profil() {
  const [user, setUser] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [ancre, setAncre] = useState('informations')

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = '/connexion'
          return null
        }
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => data && setUser(data))
      .catch(() => setErreur('Impossible de charger votre profil.'))
  }, [])

  async function deconnexion() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/'
  }

  if (erreur || !user) {
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

  return (
    <div className="etb">
      <Entete />

      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Mon compte</p>
          <h1>Profil</h1>
          <p>Vos informations, vos moyens de paiement et les réglages de votre compte.</p>
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
            {/* INFORMATIONS */}
            <section className="section" id="informations">
              <div className="section-head">
                <h2>Informations personnelles</h2>
                <span className="hint">Compte particulier</span>
              </div>

              <div className="field-row">
                <span className="field-label">Prénom</span>
                <span className="field-value">{user.first_name}</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Nom</span>
                <span className="field-value">{user.last_name}</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Adresse</span>
                <span className="field-value muted">Non renseignée</span>
                <PillInerte libelle="Ajouter" />
              </div>
              <div className="field-row">
                <span className="field-label">Téléphone</span>
                <span className="field-value">{user.phone}</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Email</span>
                <span className="field-value">{user.email}</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Mot de passe</span>
                <span className="field-value muted">••••••••••</span>
                <PillInerte libelle="Modifier" />
              </div>

              <p className="note">
                Téléphone et email sont volontairement mis en avant : ce sont les infos
                que vous modifiez le plus souvent. Toute modification de ces deux champs
                déclenchera une confirmation (code envoyé sur l'ancien ET le nouveau
                contact) pour éviter qu'on vous vole votre compte.
              </p>
            </section>

            {/* PAIEMENTS */}
            <section className="section" id="paiements">
              <div className="section-head">
                <h2>Paiements &amp; facturation</h2>
              </div>

              <div className="field-row">
                <span className="field-label">Moyen de paiement</span>
                <span className="field-value muted">Aucune carte enregistrée</span>
                <PillInerte libelle="Ajouter" />
              </div>
              <div className="field-row">
                <span className="field-label">Nom de facturation</span>
                <span className="field-value">{user.first_name} {user.last_name}</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Adresse de facturation</span>
                <span className="field-value muted">Non renseignée</span>
                <PillInerte libelle="Ajouter" />
              </div>
            </section>

            {/* PARAMETRES */}
            <section className="section" id="parametres">
              <div className="section-head">
                <h2>Paramètres</h2>
              </div>

              <div className="field-row">
                <span className="field-label">Langue</span>
                <span className="field-value">Français</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Pays d'intervention</span>
                <span className="field-value">France</span>
                <PillInerte libelle="Modifier" />
              </div>
              <div className="field-row">
                <span className="field-label">Double authentification</span>
                <span className="field-value muted">Désactivée</span>
                <PillInerte libelle="Activer" />
              </div>

              <p className="note">
                Le pays d'intervention déterminera à terme le cadre légal appliqué
                (réglementations différentes entre pays) et donc les services disponibles.
              </p>
            </section>

            {/* DANGER ZONE */}
            <section className="section danger-zone" id="danger">
              <div className="section-head">
                <h2>Supprimer le compte</h2>
              </div>
              <p>
                Cette action est définitive et supprime l'historique de vos RDV,
                messages et documents.
              </p>
              <PillInerte libelle="Supprimer mon compte" danger />
            </section>

            <button className="pill-link" type="button" onClick={deconnexion}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
