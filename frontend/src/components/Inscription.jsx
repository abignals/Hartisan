import { useState } from 'react'

export default function Inscription() {
    const[email, setEmail] = useState('')
    const[password, setPassword] = useState('')
    const[erreur, setErreur] = useState(null)
    const[succes, setSucces] = useState(false)
    const[envoi, setEnvoi] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setErreur(null)

        if (password.length < 8) {
            setErreur('Le mot de passe doit faire au moins 8 caracteres.')
            return
        }

        setEnvoi(true)
        try {
            const res = await fetch('api/register', {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setErreur(data.error ?? 'Inscription impossible.')
                return
            }
            
            setSucces(true)
        } catch {
            setErreur('Serveur injoignable.')
        } finally {
            setEnvoi(false)
        }
    }

      if (succes) {
        return (
            <main className="auth">
                <div className="auth__card">
                    <h1 className="auth__title">Compte cree</h1>
                    <p className="auth__lead">Vous pouvez maintenant vous connecter.</p>
                    <a className="btn btn--primary btn--block" href="/connexion">Se connecter</a>
                </div>
            </main>
    )
  }

  return (
    <main className="auth">
        <form className="auth__card" onSubmit={handleSubmit}>
            <h1 className="auth__title">Inscription</h1>
            <p className="auth__lead">Creez votre compte en quelques secondes.</p>

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
                    className='field__input'
                    type='password'
                    name='password'
                    autoComplete='new-password'
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <span className='field__hint'>8 caracteres minimum</span>
            </label>

            <button className='btn btn--primary btn--block' type="submit" disabled={envoi}>
                {envoi ? 'Creation...' : 'Creer mon compte'}
            </button>

            <p className='auth__switch'>
                Deja inscrit ? <a href="/connexion">Se connecter</a>
            </p>
        </form>
    </main>
  )
}