import { useState } from 'react'
import '../styles/etabli.css'

const CHAMPS_VIDES = {
  role: 'client',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirm: '',
  //artisan
  companyName: '',
  addressLine: '',
  postalCode: '',
  city: '',
}

function Entete() {
  return (
    <div className="auth-top">
      <a href="/" className="brand">
        <span className="brand-mark">É</span>
        <span className="brand-name">L'Établi</span>
        <span className="brand-tag">l'artisan qu'on connaît, l'heure qu'on respecte</span>
      </a>
    </div>
  )
}

export default function Inscription() {
    const [form, setForm] = useState(CHAMPS_VIDES)
    const [erreur, setErreur] = useState(null)
    const [succes, setSucces] = useState(false)
    const [envoi, setEnvoi] = useState(false)

    function handleChange(e) {
        const { name, value } = e.target
        setForm((f) => ({ ...f, [name]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setErreur(null)

        if (form.password.length < 8) {
            setErreur('Le mot de passe doit faire au moins 8 caracteres')
            return
        }
        if (form.password !== form.passwordConfirm) {
            setErreur('Les deux mots de passe ne correspondent pas')
            return
        }

        setEnvoi(true)
        try {
            const corps = {
                role: form.role,
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                password: form.password,
            }
            if (form.role === 'artisan') {
                corps.company_name = form.companyName.trim()
                corps.address_line = form.addressLine.trim()
                corps.postal_code = form.postalCode.trim()
                corps.city = form.city.trim()
            }

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify(corps),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setErreur(data.error ?? 'Inscription impossible')
                return
            }

            setSucces(true)
        }   catch {
            setErreur('Serveur injoignable')
        }   finally {
            setEnvoi(false)
        }
    }

    if (succes) {
        return (
            <div className="etb">
                <Entete />
                <div className="auth-shell">
                    <div className="auth-card">
                        <span className="stamp confirmed">Compte créé</span>
                        <h1>Bienvenue</h1>
                        <p className="auth-lead">
                            Votre compte est enregistré. Vous pouvez maintenant vous connecter.
                        </p>
                        <a className="btn btn-primary btn-block" href="/connexion">Se connecter</a>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="etb">
            <Entete />

            <div className="auth-shell">
                <form className="auth-card wide" onSubmit={handleSubmit}>
                    <p className="eyebrow">Créer un compte</p>
                    <h1>Inscription</h1>
                    <p className="auth-lead">Créez votre compte en quelques secondes.</p>

                    {erreur && <p className="alert alert-error" role="alert">{erreur}</p>}

                    <fieldset className="role-fieldset">
                        <legend className="fld-label">Je suis</legend>
                        <div className="role-picker">
                            <label className="role-opt">
                                <input
                                    type="radio"
                                    name="role"
                                    value="client"
                                    checked={form.role === 'client'}
                                    onChange={handleChange}
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
                                    checked={form.role === 'artisan'}
                                    onChange={handleChange}
                                />
                                <span className="box">
                                    <span className="t">Artisan</span>
                                    <span className="s">Je propose mes services</span>
                                </span>
                            </label>
                        </div>
                    </fieldset>

                    <div className="field-stack">
                        <div className="duo">
                            <label className="fld">
                                <span className="fld-label">Prénom</span>
                                <input
                                    className="input"
                                    type="text"
                                    name="firstName"
                                    autoComplete="given-name"
                                    required
                                    value={form.firstName}
                                    onChange={handleChange}
                                />
                            </label>

                            <label className="fld">
                                <span className="fld-label">Nom</span>
                                <input
                                    className="input"
                                    type="text"
                                    name="lastName"
                                    autoComplete="family-name"
                                    required
                                    value={form.lastName}
                                    onChange={handleChange}
                                />
                            </label>
                        </div>

                        <label className="fld">
                            <span className="fld-label">Email</span>
                            <input
                                className="input"
                                type="email"
                                name="email"
                                autoComplete="email"
                                required
                                value={form.email}
                                onChange={handleChange}
                            />
                        </label>

                        <label className="fld">
                            <span className="fld-label">Téléphone</span>
                            <input
                                className="input"
                                type="tel"
                                name="phone"
                                autoComplete="tel"
                                required
                                placeholder="06 12 34 56 78"
                                value={form.phone}
                                onChange={handleChange}
                            />
                        </label>

                        {form.role === 'artisan' && (
                            <>
                                <label className="fld">
                                    <span className="fld-label">Nom de l'entreprise</span>
                                    <input
                                        className="input"
                                        type="text"
                                        name="companyName"
                                        autoComplete="organization"
                                        required
                                        value={form.companyName}
                                        onChange={handleChange}
                                    />
                                </label>

                                <label className="fld">
                                    <span className="fld-label">Adresse</span>
                                    <input
                                        className="input"
                                        type="text"
                                        name="addressLine"
                                        autoComplete="street-address"
                                        placeholder="1 rue des lilas"
                                        value={form.addressLine}
                                        onChange={handleChange}
                                    />
                                </label>

                                <div className="duo">
                                    <label className="fld">
                                        <span className="fld-label">Code postal</span>
                                        <input
                                            className="input"
                                            type="text"
                                            name="postalCode"
                                            autoComplete="postal-code"
                                            inputMode="numeric"
                                            required
                                            value={form.postalCode}
                                            onChange={handleChange}
                                        />
                                    </label>

                                    <label className="fld">
                                        <span className="fld-label">Ville</span>
                                        <input
                                            className="input"
                                            type="text"
                                            name="city"
                                            autoComplete="address-level2"
                                            required
                                            value={form.city}
                                            onChange={handleChange}
                                        />
                                    </label>
                                </div>
                            </>
                        )}

                        <label className="fld">
                            <span className="fld-label">Mot de passe</span>
                            <input
                                className="input"
                                type="password"
                                name="password"
                                autoComplete="new-password"
                                minLength={8}
                                required
                                value={form.password}
                                onChange={handleChange}
                            />
                            <span className="input-hint">8 caractères minimum</span>
                        </label>

                        <label className="fld">
                            <span className="fld-label">Confirmer le mot de passe</span>
                            <input
                                className="input"
                                type="password"
                                name="passwordConfirm"
                                autoComplete="new-password"
                                required
                                value={form.passwordConfirm}
                                onChange={handleChange}
                            />
                        </label>
                    </div>

                    <div className="auth-actions">
                        <button className="btn btn-primary btn-block" type="submit" disabled={envoi}>
                            {envoi ? 'Création…' : 'Créer mon compte'}
                        </button>
                    </div>

                    <p className="auth-switch">
                        Déjà inscrit ? <a href="/connexion">Se connecter</a>
                    </p>
                </form>
            </div>
        </div>
  )
}
