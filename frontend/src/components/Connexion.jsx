import { useState } from 'react'
import '../styles/etabli.css'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [role, setRole] = useState('client')

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
      window.location.href = data.role === 'artisan' ? '/pro/profil' : '/'
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
          <span className="brand-mark">É</span>
          <span className="brand-name">L'Établi</span>
          <span className="brand-tag">l'artisan qu'on connaît, l'heure qu'on respecte</span>
        </a>
      </div>

      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleSubmit}>
          <p className="eyebrow">Mon compte</p>
          <h1>Connexion</h1>
          <p className="auth-lead">Accédez à votre espace L'Établi.</p>

          {erreur && <p className="alert alert-error" role="alert">{erreur}</p>}

          <fieldset className="role-fieldset">
            <legend className="fld-label">Je me connecte en tant que</legend>
            <div className="role-picker">
              <label className="role-opt">
                <input
                  type="radio"
                  name="role"
                  value="client"
                  checked={role === 'client'}
                  onChange={(e) => setRole(e.target.value)}
                />
                <span className="box">
                  <span className="t">Particulier</span>
                  <span className="s">Je cherche un artisan</span>
                </span>
              </label>

              <label className="role-opt">
                <input
                  type="radio"
                  name="role"
                  value="artisan"
                  checked={role === 'artisan'}
                  onChange={(e) => setRole(e.target.value)}
                />
                <span className="box">
                  <span className="t">Artisan</span>
                  <span className="s">Je propose mes services</span>
                </span>
              </label>
            </div>
          </fieldset>

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
            Pas encore de compte ? <a href="/inscription">S'inscrire</a>
          </p>
        </form>
      </div>
    </div>
  )
}
