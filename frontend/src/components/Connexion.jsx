import { useState } from 'react'
import '../styles/etabli.css'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const role = new URLSearchParams(window.location.search).get('role') === 'artisan' || new URLSearchParams(window.location.search).get('retour')?.startsWith('/pro/') ? 'artisan' : 'client'

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, role }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErreur(data.error ?? 'Connexion impossible.')
        return
      }

      const data = await res.json().catch(() => ({}))
      const retour = new URLSearchParams(window.location.search).get('retour') || ''
      const clientReturn = data.role === 'client' && (/^\/artisan\/[0-9a-f-]+\/reserver$/.test(retour) || retour === '/rdv')
      const artisanReturn = data.role === 'artisan' && retour === '/pro/planning'
      window.location.href = clientReturn || artisanReturn ? retour : data.role === 'artisan' ? '/pro/profil' : '/'
    } catch {
      setErreur('Serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="etb">
      <div className="auth-top">
        <a href="/" className="brand">
          <span className="brand-mark">H</span>
          <span className="brand-name">Artisan</span>
        </a>
      </div>

      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleSubmit}>
          <p className="eyebrow">Mon compte</p>
          <h1>{role === 'artisan' ? 'Se connecter à mon espace artisan' : 'Se connecter'}</h1>
          <p className="auth-lead">Accédez à votre espace HArtisan.</p>

          {erreur && <p className="alert alert-error" role="alert">{erreur}</p>}

          <div className="field-stack">
            <label className="fld">
              <span className="fld-label">Email</span>
              <input
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="fld">
              <span className="fld-label">Mot de passe</span>
              <input
                className="input"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>

          <div className="auth-actions">
            <button className="btn btn-primary btn-block" type="submit" disabled={envoi}>
              {envoi ? 'Connexion…' : 'Se connecter'}
            </button>
          </div>

          <p className="auth-switch">
            {role === 'artisan' ? <>Vous souhaitez rejoindre Hartisan ? <a href="/pro#conseiller">Contacter un conseiller</a></> : <>Pas encore de compte ? <a href="/inscription">Vous inscrire</a></>}
          </p>
        </form>
      </div>
    </div>
  )
}
