import { useUtilisateur } from '../hooks/useUtilisateur.js'

const NAV_VISITEUR = [
  { libelle: 'Trouver un artisan', href: '/recherche' },
  { libelle: 'Métiers', href: '/metiers' },
  { libelle: 'Vous êtes artisan ?', href: '/pro' },
]

const NAV_CLIENT = [
  { libelle: 'Profil', href: '/profil' },
  { libelle: 'Messages', href: '/messages' },
  { libelle: 'RDV & interventions', href: '/rdv' },
  { libelle: 'Documents', href: '/documents' },
]

const NAV_PRO = [
  { libelle: 'Emploi du temps', href: '/pro/planning' },
  { libelle: 'Messages', href: '/pro/messages' },
  { libelle: 'Documents', href: '/pro/documents' },
  { libelle: 'Profil', href: '/pro/profil' },
]

function initiales(utilisateur) {
  const lettres = [utilisateur.first_name, utilisateur.last_name]
    .filter(Boolean)
    .map((mot) => mot[0])
    .join('')
  return lettres.toUpperCase() || '?'
}

export default function Entete() {
  const { utilisateur, chargement } = useUtilisateur()

  const estPro = utilisateur?.role === 'artisan'
  const lienProfil = estPro ? '/pro/profil' : '/profil'

  const liens = !utilisateur ? NAV_VISITEUR : estPro ? NAV_PRO : NAV_CLIENT
  const chemin = window.location.pathname

  async function deconnexion() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/'
  }

  return (
    <nav className="topbar">
      <a href="/" className="brand">
        <span className="brand-mark">É</span>
        <span className="brand-name">L'Établi</span>
        {estPro ? (
          <span className="pro-tag">Espace pro</span>
        ) : (
          <span className="brand-tag">l'artisan qu'on connaît, l'heure qu'on respecte</span>
        )}
      </a>

      {/* on attend /api/me : afficher la nav visiteur puis la remplacer ferait clignoter */}
      <ul className="nav-links">
        {chargement
          ? null
          : liens.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={chemin === l.href ? 'active' : undefined}>
                  {l.libelle}
                </a>
              </li>
            ))}
      </ul>

      <div className="nav-end">
        {chargement ? null : utilisateur ? (
          <>
            <a
              className="nav-user"
              href={lienProfil}
              title={`${utilisateur.first_name} ${utilisateur.last_name}`}
            >
              {initiales(utilisateur)}
            </a>
            <button className="btn btn-ghost" type="button" onClick={deconnexion}>
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <a className="btn btn-ghost" href="/connexion">Connexion</a>
            <a className="btn btn-primary" href="/inscription">Inscription</a>
          </>
        )}
      </div>
    </nav>
  )
}
