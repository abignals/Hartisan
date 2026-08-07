import { useState } from 'react'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErreur(data.error ?? 'Connexion impossible.')
        return
      }

      //le cookie session_id est pose par le serveur, on recharge sur l'accueil
      window.location.href = '/'
    } catch {
      setErreur('Serveur injoignable.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <h1 className="auth__title">Connexion</h1>
        <p className="auth__lead">Accedez a votre espace DOCTO.</p>

        {erreur && <p className="auth__error" role="alert">{erreur}</p>}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Mot de passe</span>
          <input
            className="field__input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="btn btn--primary btn--block" type="submit" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="auth__switch">
          Pas encore de compte ? <a href="/inscription">S'inscrire</a>
        </p>
      </form>
    </main>
  )
}
