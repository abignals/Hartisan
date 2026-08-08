import { use, useState } from 'react'

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
            <main className="auth">
                <div className='auth__card'>
                    <h1 className='auth__title'>Compte cree</h1>
                    <p className='auth__lead'>Vous pouvez maintenant vous connecter.</p>
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

                {erreur && <p className='auth__error' role="alert">{erreur}</p>}

                <fieldset className="roles">
                    <legend className="field__label">Je suis</legend>
                    <label className="role">
                        <input
                            type="radio"
                            name="role"
                            value="client"
                            checked={form.role === 'client'}
                            onChange={handleChange}
                        />
                        <span className="role__box">
                            <span className="role__titre">Particulier</span>
                            <span className="role__texte">Je cherche un artisan</span>
                        </span>
                    </label>

                    <label className="role">
                        <input
                            type="radio"
                            name="role"
                            value="artisan"
                            checked={form.role === 'artisan'}
                            onChange={handleChange}
                        />
                        <span className="role__box">
                            <span className="role__titre">Artisan</span>
                            <span className="role__texte">Je propose mes services</span>
                        </span>
                    </label>
                </fieldset>

                <div className="field-row">
                    <label className="field">
                        <span className="field__label">Prenom</span>
                        <input
                            className="field__input"
                            type="text"
                            name="firstName"
                            autoComplete="given-name"
                            required
                            value={form.firstName}
                            onChange={handleChange}
                        />
                    </label>

                    <label className="field">
                        <span className="field__label">Nom</span>
                        <input
                            className="field__input"
                            type="text"
                            name="lastName"
                            autoComplete="family-name"
                            required
                            value={form.lastName}
                            onChange={handleChange}
                        />
                    </label>
                </div>

                <label className="field">
                    <span className="field__label">Email</span>
                    <input
                        className="field__input"
                        type="email"
                        name="email"
                        autoComplete="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                    />
                </label>

                <label className="field">
                    <span className="field__label">Telephone</span>
                    <input
                        className="field__input"
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
                        <label className="field">
                            <span className="field__label">Nom de l'entreprise</span>
                            <input
                                className="field__input"
                                type="text"
                                name="companyName"
                                autoComplete='organization'
                                required
                                value={form.companyName}
                                onChange={handleChange}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Adresse</span>
                            <input
                                className="field__input"
                                type="text"
                                name="addressLine"
                                autoComplete='street-address'
                                placeholder='1 rue des lilas'
                                value={form.addressLine}
                                onChange={handleChange}
                            />
                        </label>

                        <div className="field-row">
                            <label className="field">
                                <span className="field__label">Code Postal</span>
                                <input
                                    className='field__input'
                                    type='text'
                                    name='postalCode'
                                    autoComplete='postal-code'
                                    inputMode="numeric"
                                    required
                                    value={form.postalCode}
                                    onChange={handleChange}
                                />
                            </label>

                            <label className="field">
                                <span className="field__label">Ville</span>
                                <input
                                    className="field__input"
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

                <label className="field">
                    <span className="field__label">Mot de passe</span>
                    <input
                        className="field__input"
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={form.password}
                        onChange={handleChange}
                    />
                    <span className="field__hint">8 caracteres minimum</span>
                </label>

                <label className="field">
                    <span className="field__label">Confirmer le mot de passe</span>
                    <input
                        className="field__input"
                        type="password"
                        name="passwordConfirm"
                        autoComplete="new-password"
                        required
                        value={form.passwordConfirm}
                        onChange={handleChange}
                    />
                </label>

                <button className="btn btn--primary btn--block" type="submit" disabled={envoi}>
                    {envoi ? 'Creation…' : 'Creer mon compte'}
                </button>

                <p className="auth__switch">
                    Deja inscrit ? <a href="/connexion">Se connecter</a>
                </p>
            </form>
        </main>
  )
}
