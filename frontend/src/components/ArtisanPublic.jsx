import { useEffect, useState } from 'react'
import Entete from './Entete.jsx'
import ArtisanPortrait from './ArtisanPortrait.jsx'
import { demoArtisans } from '../data/searchDemo.js'
import { enrichArtisan, safeSearchReturn } from '../data/artisanExamples.js'
import '../styles/etabli.css'
import '../styles/recherche.css'
import '../styles/artisan-public.css'

export default function ArtisanPublic() {
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo') === '1'
  const returnTo = safeSearchReturn(params.get('retour') || (demo ? '/recherche?demo=1' : '/recherche'))
  const id = window.location.pathname.split('/')[2]
  const [artisan, setArtisan] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        let data
        if (demo) {
          data = demoArtisans.find(a => a.id === id)
          if (!data) throw new Error('Ce profil de démonstration est introuvable.')
        } else {
          const response = await fetch(`/api/artisans/${encodeURIComponent(id)}`, { signal: controller.signal })
          data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'Impossible de charger ce profil.')
        }
        if (!controller.signal.aborted) setArtisan(enrichArtisan(data))
      } catch (err) { if (!controller.signal.aborted) setError(err.message) }
    }
    load()
    return () => controller.abort()
  }, [demo, id])

  useEffect(() => {
    if (!artisan) return
    const previous = document.title
    document.title = `${artisan.example?.person || artisan.name} — ${artisan.trades} | HArtisan`
    return () => { document.title = previous }
  }, [artisan])

  if (!artisan || error) return <div className="etb"><Entete /><main className="page artisan-public-page">
    <a className="artisan-back" href={returnTo}>← Retour à la recherche</a>
    <p role={error ? 'alert' : 'status'} className={error ? 'search-error' : ''}>{error || 'Chargement du profil…'}</p>
  </main></div>

  const example = artisan.example
  const name = example?.person || artisan.name.replace('[TEST] ', '')
  const company = artisan.name.replace('[TEST] ', '')
  return <div className="etb"><Entete /><main className="page artisan-public-page">
    <a className="artisan-back" href={returnTo}>← Retour aux résultats</a>
    {example && <div className="search-demo-banner"><strong>Profil de démonstration</strong><p>Cette personne et son portrait sont fictifs. Tarifs, avis, parcours et réalisations sont des exemples ; aucune qualification ou assurance n’a été vérifiée.</p></div>}
    <header className="artisan-public-header">
      <ArtisanPortrait artisan={artisan} large />
      <div className="artisan-public-identity">
        <h1>{name}</h1>
        <p className="artisan-public-headline">{example?.headline || artisan.trades}</p>
        {example && <p>{company}</p>}
        <p>{artisan.city} ({artisan.postal_code}) · Interventions à domicile</p>
        {example && <div className="artisan-public-highlights"><span>{example.experience} ans d’expérience</span><a href="#avis">★ {example.rating}/5 · {example.reviews} avis fictifs</a></div>}
      </div>
    </header>
    <nav className="artisan-section-nav" aria-label="Sections du profil">
      <a href="#presentation">Présentation</a><a href="#prestations">Prestations</a><a href="#tarifs">Tarifs</a><a href="#pratique">Infos pratiques</a><a href="#parcours">Parcours</a>{example && <a href="#avis">Avis fictifs</a>}
    </nav>
    <div className="artisan-public-layout">
      <div className="artisan-public-content">
        <section className="artisan-info-section" id="presentation">
          <h2>Présentation</h2>
          <p>{example?.intro || artisan.description || 'Cet artisan n’a pas encore renseigné sa présentation.'}</p>
          {example && <><h3>Une intervention expliquée, du début à la fin</h3><p>Premier échange sur votre besoin, explication des solutions et accord sur le devis avant les travaux. À la fin de l’intervention, remise d’une facture et de conseils d’entretien.</p></>}
        </section>
        <section className="artisan-info-section" id="prestations">
          <h2>Prestations et spécialités</h2>
          {example ? <><div className="artisan-specialties">{example.specialties.map(item => <span key={item}>{item}</span>)}</div><ul>{example.services.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="artisan-note">Un problème caché ou complexe peut nécessiter un diagnostic sur place avant de chiffrer les travaux.</p></> : <p>{artisan.trades || 'Prestations non renseignées.'}</p>}
        </section>
        <section className="artisan-info-section" id="tarifs">
          <h2>Tarifs et moyens de paiement</h2>
          {example ? <><p className="artisan-note">Exemples fictifs, en euros TTC. Il ne s’agit pas d’une offre commerciale.</p>
            <dl className="artisan-price-list">
              <div><dt>Déplacement dans le secteur déclaré</dt><dd>{example.travel} €</dd></div>
              <div><dt>Main-d’œuvre, hors pièces</dt><dd>{example.hourly} € / heure</dd></div>
              <div><dt>Diagnostic sur place, déplacement inclus</dt><dd>À partir de {example.diagnostic} €</dd></div>
              <div><dt>Installation ou rénovation</dt><dd>Sur devis</dd></div>
            </dl>
            <p>Le montant final dépend du diagnostic, du matériel et de la durée de l’intervention. Une éventuelle majoration doit être annoncée avant votre accord.</p>
            <h3>Moyens de paiement acceptés</h3><p>{example.payments.join(' · ')}</p>
          </> : <p>Les tarifs et moyens de paiement ne sont pas encore renseignés.</p>}
        </section>
        <section className="artisan-info-section" id="pratique">
          <h2>Informations pratiques</h2>
          <dl className="artisan-facts">
            <div><dt>Ville de départ</dt><dd>{artisan.city} ({artisan.postal_code})</dd></div>
            <div><dt>Secteur d’intervention</dt><dd>{example ? example.zones.join(', ') : artisan.city} · rayon déclaré de {artisan.radius_km} km</dd></div>
            <div><dt>Horaires habituels</dt><dd>{example?.hours || 'Non renseignés'}</dd></div>
            <div><dt>Langues parlées</dt><dd>{example?.languages.join(', ') || 'Non renseignées'}</dd></div>
            {example && <><div><dt>Types de logement</dt><dd>Appartements et maisons, occupés ou en rénovation</dd></div><div><dt>Avant l’intervention</dt><dd>Décrivez le problème et préparez, si possible, une photo de l’équipement et sa référence.</dd></div></>}
          </dl>
          <p className="artisan-note">Les horaires d’activité ne sont pas des créneaux de rendez-vous disponibles.</p>
        </section>
        <section className="artisan-info-section" id="parcours">
          <h2>Parcours et informations professionnelles</h2>
          {example ? <><h3>Formations — exemples fictifs</h3><ul>{example.qualifications.map(item => <li key={item}>{item}</li>)}</ul>
            <dl className="artisan-facts"><div><dt>Expérience</dt><dd>{example.experience} ans dans le métier</dd></div><div><dt>Entreprise créée en</dt><dd>{example.since}</dd></div><div><dt>Statut d’activité</dt><dd>Entreprise individuelle (exemple)</dd></div><div><dt>Assurance professionnelle</dt><dd>Attestation à fournir et à vérifier ; aucune couverture certifiée pour ce profil fictif.</dd></div></dl>
          </> : <p>Les formations, l’expérience et les documents professionnels ne sont pas encore publiés sur ce profil.</p>}
        </section>
        {example && <>
          <section className="artisan-info-section" id="realisations"><h2>Exemple de réalisation</h2><p className="artisan-note">Projet fictif destiné à illustrer les informations d’un portfolio.</p><h3>{example.project}</h3><p>{example.projectDetail}</p></section>
          <section className="artisan-info-section" id="avis"><h2>Avis clients — démonstration</h2><div className="artisan-review-score">★ {example.rating}<span>/ 5 · {example.reviews} avis fictifs</span></div>
            <p>Ces exemples ne proviennent pas de clients réels.</p>
            <article className="artisan-review"><strong>Camille · avis fictif</strong><p>« Les explications étaient claires et le devis a été présenté avant l’intervention. Le logement a été laissé propre. »</p></article>
            <article className="artisan-review"><strong>Alex · avis fictif</strong><p>« J’ai apprécié de savoir à l’avance quelles pièces pouvaient être nécessaires et comment préparer l’accès à l’équipement. »</p></article>
          </section>
        </>}
      </div>
      <aside className="artisan-profile-sidebar" aria-label="Résumé de l’intervention">
        <div className="artisan-sidebar-heading"><h2>Votre intervention</h2><p>{artisan.trades}</p></div>
        <div className="artisan-sidebar-body">
          <p><strong>À domicile</strong><br />{artisan.city} et environs</p>
          {example && <><p><strong>{example.travel} € de déplacement</strong><br /><span>Tarif fictif pour cet exemple</span></p><p><strong>{example.experience} ans d’expérience</strong><br />{example.specialties.slice(0, 2).join(' · ')}</p></>}
          <a className="btn btn-primary" href="#tarifs">Consulter les tarifs</a>
          <a className="btn btn-ghost" href="#prestations">Voir les prestations</a>
          <p className="artisan-note">La réservation en ligne n’est pas encore disponible. Aucun créneau ne peut être réservé depuis cette page.</p>
        </div>
      </aside>
    </div>
  </main></div>
}
