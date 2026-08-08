import { useEffect, useState } from 'react'
import '../styles/index.css'


export default function Profil() {
    const [user, setUser] = useState(null)
    const [erreur, setErreur] = useState(null)

    useEffect(() => {
        fetch('/api/me', {credentials: 'same-origin'})
        .then((rest) => {
            if(rest.status === 401) {
                window.location.href = '/connexion'
                return null
            }
            if(!rest.ok) throw new Error()
                return rest.json()
        })
        .then((data) => data && setUser(data))
        .catch(() => setErreur('Impossible de charger votre profil.'))
    }, [])
    
    if (erreur) {
        return (
            <main className="auth">
                <div className="auth__card">
                    <p className="auth__error" role="alert">{erreur}</p>
                </div>
            </main>
        )
    }
    if (!user) {
        return (
            <main className="auth">
                <div className="auth__card">
                    <p className="auth__lead">Chargement...</p>
                </div>
            </main>
        )
    }
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Mon profil</h1>
          <p className="auth__lead">Vos informations personnelles.</p>
        
          <div className="field">
            <span className="field__label">Prenom</span>
            <span>{user.first_name}</span>
          </div>
    
          <div className="field">
            <span className="field__label">Nom</span>
            <span>{user.last_name}</span>
          </div>
          <div className="field">
            <span className="field__label">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="field">
            <span className="field__label">Telephone</span>
            <span>{user.phone}</span>
          </div>
          
          <a className="btn btn--outline btn--block" href="/">Retour a l'accueil</a>
        </div>
      </main>
    )
}