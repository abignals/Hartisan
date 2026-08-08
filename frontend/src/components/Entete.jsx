import { useUtilisateur } from "../hooks/useUtilisateur";

export default function Entete() {
  const { utilisateur, chargement } = useUtilisateur()

  const lienProfil = utilisateur?.role === 'artisan' ? '/pro/profil' : '/profil'

  async function deconnexion() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/'
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <a className="logo" href="/">docto</a>

        <nav className="nav">
          <a className="nav__link" href="/recherche">Trouver un artisan</a>
          <a className="nav__link" href="/metiers">Métiers</a>
          {utilisateur?.role !== 'artisan' && (
            <a className="nav__link" href="/pro">Vous êtes artisan ?</a>
          )}
        </nav>

        <div className="header__actions">
          {chargement ? null : utilisateur ? (
            <>
              <a className="btn btn--ghost" href={lienProfil}>
                {utilisateur.first_name}
              </a>
              <button className="btn btn--primary" type="button" onClick={deconnexion}>
                Deconnexion
              </button>
            </>
          ) : (
            <>
              <a className="btn btn--ghost" href="/connexion">Connexion</a>
              <a className="btn btn--primary" href="/inscription">Inscription</a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}