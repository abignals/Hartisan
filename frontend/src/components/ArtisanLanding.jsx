import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import '../styles/etabli.css'
import '../styles/artisan-landing.css'

export default function ArtisanLanding() {
  const [form, setForm] = useState({ first_name: '', last_name: '', company_name: '', email: '', phone: '', trade: '', postal_code: '', availability: 'indifferent', message: '', consent: false, website: '' })
  const [trades, setTrades] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/trades', { signal: controller.signal }).then(r => r.ok ? r.json() : []).then(setTrades).catch(() => {})
    return () => controller.abort()
  }, [])
  const update = e => setForm(previous => ({ ...previous, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  function field(name, label, props = {}) {
    return <label>{label}<input name={name} value={form[name]} required maxLength={100} onChange={update} {...props} /></label>
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/pro/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer votre demande.')
      setSuccess(true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="etb artisan-landing"><Entete />
    <div className="pro-access"><span>Hartisan, pour les professionnels du logement</span><a href="/connexion?role=artisan">Déjà partenaire ? Se connecter →</a></div>
    <main>
      <section className="pro-hero">
        <div className="pro-hero-copy"><p className="pro-eyebrow">VOTRE MÉTIER, AU PREMIER PLAN</p><h1>Votre savoir-faire<br />mérite d’être <em>trouvé.</em></h1><p className="pro-intro">Faites connaître votre activité aux particuliers qui cherchent un artisan près de chez eux. Présentez vos spécialités, proposez vos créneaux et échangez avant de vous déplacer.</p><a className="btn btn-primary" href="#conseiller">Parlons de votre activité <span aria-hidden="true">↗</span></a><p className="pro-hero-note">Plombiers, électriciens, chauffagistes et professionnels du bâtiment.</p></div>
        <div className="pro-illustration" aria-label="Illustration des fonctionnalités Hartisan">
          <span className="pro-example-label">Votre activité, en un seul endroit</span>
          <div className="pro-preview"><div className="pro-preview-header"><span className="pro-monogram" aria-hidden="true">H</span><div><strong>Votre entreprise</strong><p>Votre métier · Votre ville</p></div></div><hr /><h2>Le bon professionnel,<br />près de chez soi.</h2><div className="pro-preview-tags"><span>Vos spécialités</span><span>Votre zone</span></div><div className="pro-preview-slots"><span>Votre fiche</span><span>Votre planning</span><span>Vos messages</span></div><p className="pro-preview-caption">Une présentation claire pour aider le client à vous choisir.</p></div>
          <div className="pro-preview-note"><span aria-hidden="true">↗</span><div><strong>Un premier contact mieux préparé</strong><p>Le besoin, l’adresse et les photos avant le rendez-vous.</p></div></div>
        </div>
      </section>
      <section className="pro-figures" aria-label="Les fonctionnalités en chiffres">
        <article><strong>24 h<span>/24</span></strong><h2>Des demandes en ligne</h2><p>Les particuliers peuvent consulter votre fiche et demander un créneau, même lorsque vous êtes sur un chantier.</p></article>
        <article><strong>1</strong><h2>Fiche pour vous présenter</h2><p>Votre entreprise, vos métiers et votre secteur réunis pour rendre votre activité plus facile à découvrir.</p></article>
        <article><strong>3</strong><h2>Outils au même endroit</h2><p>Votre profil, votre planning et votre messagerie pour organiser les premiers échanges avec vos clients.</p></article>
      </section>
      <section className="pro-benefits"><div><p className="pro-eyebrow">MOINS DE FLOU, PLUS DE LIEN</p><h2>Vous connaissez votre métier.<br />Aidez vos futurs clients<br />à vous connaître.</h2><a href="#conseiller">Découvrir Hartisan avec un conseiller →</a></div><div className="pro-benefit-list">
        <article><span>01</span><div><h3>Montrez ce qui vous distingue</h3><p>Présentez vos spécialités et votre expérience sur une fiche professionnelle visible dans la recherche après validation.</p></div></article>
        <article><span>02</span><div><h3>Gardez la main sur votre planning</h3><p>Définissez vos horaires, bloquez vos indisponibilités et acceptez les demandes adaptées à votre organisation.</p></div></article>
        <article><span>03</span><div><h3>Comprenez le besoin avant d’intervenir</h3><p>Discutez avec le client et consultez ses photos dès sa demande de rendez-vous.</p></div></article>
      </div></section>
      <section className="pro-contact" id="conseiller">
        <div className="pro-contact-copy"><p className="pro-eyebrow">PARLONS DE VOTRE ENTREPRISE</p><h2>Et si on faisait<br />connaissance ?</h2><p>Vous souhaitez comprendre comment Hartisan peut accompagner votre activité ? Laissez vos coordonnées pour demander un échange avec un conseiller.</p><ul><li>Faire le point sur vos besoins</li><li>Découvrir le fonctionnement de la plateforme</li><li>Préparer votre arrivée sur Hartisan</li></ul><p className="pro-contact-note">Cette demande ne crée pas de compte et ne vous engage pas.</p></div>
        <div className="pro-contact-card">
          {success ? <div role="status"><span className="stamp confirmed">Demande enregistrée</span><h2>Merci pour votre intérêt.</h2><p>Vos coordonnées et votre demande ont bien été enregistrées pour préparer un échange avec notre équipe.</p><a className="btn btn-ghost" href="/">Retour à l’accueil</a></div> : <form onSubmit={submit}>
            <h2>Échanger avec un conseiller</h2><p>Les champs marqués d’un * sont obligatoires.</p>
            {error && <p role="alert" className="pro-contact-error">{error}</p>}
            <fieldset disabled={busy}>
              <div className="pro-contact-row">{field('first_name', 'Prénom *', { autoComplete: 'given-name' })}{field('last_name', 'Nom *', { autoComplete: 'family-name' })}</div>
              {field('company_name', 'Nom de l’entreprise', { autoComplete: 'organization', required: false, maxLength: 160 })}
              <div className="pro-contact-row"><label>Métier principal *<select name="trade" required value={form.trade} onChange={update}><option value="">Choisir votre métier</option>{trades.map(trade => <option key={trade.slug} value={trade.slug}>{trade.label}</option>)}<option value="autre">Autre métier du bâtiment</option></select></label>{field('postal_code', 'Code postal *', { inputMode: 'numeric', pattern: '[0-9]{5}', maxLength: 5, autoComplete: 'postal-code' })}</div>
              {field('email', 'Email professionnel *', { type: 'email', autoComplete: 'email', maxLength: 254 })}
              {field('phone', 'Téléphone *', { type: 'tel', autoComplete: 'tel', maxLength: 40 })}
              <label>Quand êtes-vous plutôt disponible ?<select name="availability" value={form.availability} onChange={update}><option value="indifferent">Pas de préférence</option><option value="matin">Le matin</option><option value="apres-midi">L’après-midi</option></select></label>
              <label>Un besoin ou une question ?<textarea name="message" rows={3} maxLength={2000} value={form.message} onChange={update} placeholder="Parlez-nous de votre activité et de ce que vous recherchez…" /></label>
              <div className="pro-contact-trap" aria-hidden="true"><label>Site internet<input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update} /></label></div>
              <label className="pro-contact-consent"><input type="checkbox" name="consent" required checked={form.consent} onChange={update} />J’accepte que Hartisan utilise ces coordonnées pour me recontacter au sujet de cette demande.</label>
              <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Demander à être recontacté'}</button>
            </fieldset>
            <p className="pro-contact-privacy">Ces informations servent à traiter votre demande de contact.</p>
          </form>}
        </div>
      </section>
      <footer className="pro-landing-footer"><a href="/">HArtisan</a><a href="/connexion?role=artisan">Se connecter à mon espace artisan</a><a href="/connexion">Je suis un particulier</a></footer>
    </main>
  </div>
}
