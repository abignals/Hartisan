import { useEffect, useRef, useState } from 'react'
import Entete from './Entete.jsx'
import Autocomplete from './Autocomplete.jsx'
import ArtisanPortrait from './ArtisanPortrait.jsx'
import { demoTrades, demoLocations, demoArtisans, normalize, distance } from '../data/searchDemo.js'
import { enrichArtisan, profileHref } from '../data/artisanExamples.js'
import { locationLabel, resolveTypedLocation } from '../data/searchLocations.js'
import '../styles/etabli.css'
import '../styles/recherche.css'

async function api(url, signal) {
  const res = await fetch(url, { signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Le service est indisponible. Veuillez réessayer.')
  return data
}

function demoSuggestions(text) {
  const query = normalize(text)
  return demoLocations.filter(p => normalize(p.name).includes(query) || p.postal_code.startsWith(query))
    .map(p => /^\d+$/.test(query) ? p : { ...p, postal_code: '' })
}

export default function Recherche() {
  const initial = useRef(new URLSearchParams(window.location.search)).current
  const [demo, setDemo] = useState(initial.get('demo') === '1')
  const [trades, setTrades] = useState([])
  const [tradeText, setTradeText] = useState(initial.get('metier') || '')
  const [placeText, setPlaceText] = useState(initial.get('lieu') || '')
  const [place, setPlace] = useState(null)
  const [places, setPlaces] = useState([])
  const [placeError, setPlaceError] = useState('')
  const [placesLoading, setPlacesLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState('')
  const [more, setMore] = useState(false)
  const [returnTo, setReturnTo] = useState('/recherche')
  const searchRequest = useRef(null)
  const form = useRef(null)
  const initialSearch = useRef(initial.get('chercher') === '1')

  useEffect(() => {
    const controller = new AbortController()
    if (demo) setTrades(demoTrades)
    else {
      setTrades([])
      api('/api/trades', controller.signal).then(setTrades).catch(e => {
        if (!controller.signal.aborted) setError(e.message)
      })
    }
    return () => { controller.abort(); searchRequest.current?.abort() }
  }, [demo])

  useEffect(() => {
    if (!trades.length || !initialSearch.current) return
    const timer = setTimeout(() => {
      initialSearch.current = false
      form.current?.requestSubmit()
    }, 0)
    return () => clearTimeout(timer)
  }, [trades])

  useEffect(() => {
    const controller = new AbortController()
    setPlaces([]); setPlaceError(''); setPlacesLoading(false)
    if (place || placeText.trim().length < 2) return () => controller.abort()
    const timer = setTimeout(async () => {
      setPlacesLoading(true)
      try {
        const items = demo ? demoSuggestions(placeText)
          : await api(`/api/search/locations?q=${encodeURIComponent(placeText.trim())}`, controller.signal)
        if (!controller.signal.aborted) setPlaces(items)
      } catch (e) { if (!controller.signal.aborted) setPlaceError(e.message) }
      finally { if (!controller.signal.aborted) setPlacesLoading(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [placeText, place, demo])

  function switchMode() {
    searchRequest.current?.abort()
    setDemo(!demo); setResults(null); setError(''); setPlace(null); setPlaceText(''); setBusy(false)
    window.history.replaceState(null, '', demo ? '/recherche' : '/recherche?demo=1')
  }

  async function search(e) {
    e.preventDefault(); setError('')
    const chosen = trades.find(t => normalize(t.label) === normalize(tradeText) || t.slug === normalize(tradeText))
    if (!chosen) { setError('Choisissez un métier proposé dans les suggestions.'); return }
    if (placeText.trim().length < 2) { setError('Indiquez une ville ou un code postal.'); return }
    searchRequest.current?.abort()
    const controller = new AbortController(); searchRequest.current = controller
    setBusy(true); setResults(null)
    try {
      let target = place
      if (!target || target.resolve) {
        const query = target?.resolve ? target.postal_code : placeText.trim()
        const suggestions = demo ? demoSuggestions(query)
          : await api(`/api/search/locations?q=${encodeURIComponent(query)}`, controller.signal)
        target = resolveTypedLocation(target?.resolve ? target.name : query, suggestions)
      }
      const data = demo
        ? { artisans: demoArtisans.filter(a => a.trade === chosen.slug).map(a => ({ ...a, distance_km: distance(a, target) })).filter(a => a.distance_km <= a.radius_km).sort((a, b) => a.distance_km - b.distance_km), more: false }
        : await api(`/api/search/artisans?${new URLSearchParams({ trade: chosen.slug, lat: target.lat, lon: target.lon })}`, controller.signal)
      if (controller.signal.aborted) return
      setResults(data.artisans.map(enrichArtisan)); setMore(data.more)
      setSummary(`${chosen.label} à ${target.name}${target.postal_code ? ` (${target.postal_code})` : ''}`)
      setPlace(target); setPlaceText(target.postal_code ? `${target.name} (${target.postal_code})` : target.name)
      const query = new URLSearchParams({ metier: chosen.slug, lieu: target.name, chercher: '1' })
      if (target.postal_code) query.set('lieu', target.postal_code)
      if (demo) query.set('demo', '1')
      const url = `/recherche?${query}`
      setReturnTo(url); window.history.replaceState(null, '', url)
    } catch (e) { if (!controller.signal.aborted) setError(e.message) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }

  return <div className="etb"><Entete /><main className="page artisan-search-page">
    <div className="artisan-search-heading">
      <div><h1>Trouvez votre artisan</h1><p>Le bon professionnel pour vos travaux et dépannages à domicile.</p></div>
      <button className="btn btn-ghost" onClick={switchMode}>{demo ? 'Rechercher les comptes enregistrés' : 'Essayer avec des exemples'}</button>
    </div>
    {demo && <p className="search-demo-banner"><strong>Démonstration</strong> — Personnes, photos, tarifs et avis fictifs. Aucun rendez-vous réel.</p>}
    <form ref={form} className="artisan-search-form" onSubmit={search}>
      <Autocomplete label="Métier" value={tradeText} placeholder="Ex. Plombier" onChange={setTradeText}
        options={trades.filter(t => normalize(t.label).includes(normalize(tradeText)) || t.slug.includes(normalize(tradeText)))}
        onSelect={t => setTradeText(t.label)} />
      <Autocomplete label="Ville ou code postal" value={placeText} placeholder="Ex. Paris" onChange={text => { setPlaceText(text); setPlace(null) }}
        options={places.map(p => ({ ...p, label: locationLabel(p) }))}
        onSelect={p => { setPlace(p); setPlaceText(p.postal_code ? `${p.name} (${p.postal_code})` : p.name); setPlaces([]) }}
        hint={placeError || (placesLoading ? 'Recherche de villes…' : 'Le nom de la ville suffit, par exemple Paris.')} />
      <button className="btn btn-primary" disabled={busy || !trades.length}>{busy ? 'Recherche…' : 'Rechercher'}</button>
    </form>
    {error && <p role="alert" className="search-error">{error}</p>}
    {busy && <p role="status">Recherche des artisans qui interviennent dans ce secteur…</p>}
    {!busy && results === null && !error && <div className="search-start">
      <h2>De quel artisan avez-vous besoin ?</h2><p>Choisissez un métier, indiquez votre ville et comparez les professionnels.</p>
      <div>{trades.slice(0, 4).map(t => <button key={t.slug} onClick={() => setTradeText(t.label)}>{t.label}</button>)}</div>
    </div>}
    {results && <section aria-label="Résultats de recherche">
      <div className="search-results-heading" aria-live="polite"><div><h2>{summary}</h2><p>{results.length} professionnel{results.length > 1 ? 's' : ''}{more ? ' affichés' : ''} dans ce secteur</p></div><span>Les plus proches en premier</span></div>
      {results.length > 0 && <p className="search-distance-note">Distances indicatives depuis le centre de la commune. La zone d’intervention sera à confirmer.</p>}
      {more && <p>Les 50 premiers résultats sont affichés. Précisez votre ville pour affiner la recherche.</p>}
      {!results.length && <div className="search-start"><h3>Aucun artisan trouvé dans ce secteur</h3><p>Essayez une autre ville ou un autre métier.</p></div>}
      <div className="search-results-list">{results.map(a => {
        const href = profileHref(a, demo, returnTo)
        const example = a.example
        return <article className="search-result" key={a.id}>
          <div className="search-result-main">
            <a href={href} className="search-portrait-link" aria-label={`Voir le profil de ${example?.person || a.name}`}><ArtisanPortrait artisan={a} /></a>
            <div className="search-result-info">
              {example && <span className="search-test-tag">Profil de démonstration · informations fictives</span>}
              <h3><a href={href}>{example?.person || a.name.replace('[TEST] ', '')}</a></h3>
              <p className="search-result-trades">{example?.headline || a.trades}</p>
              <p className="search-result-company">{a.name.replace('[TEST] ', '')}</p>
              <p className="search-result-location">{a.city} ({a.postal_code}) · environ {a.distance_km.toFixed(1)} km</p>
              {example && <>
                <p className="search-result-rating"><span aria-hidden="true">★</span> {example.rating}/5 <span>({example.reviews} avis fictifs)</span></p>
                <div className="artisan-specialties">{example.specialties.slice(0, 3).map(item => <span key={item}>{item}</span>)}</div>
              </>}
              {!example && <p className="search-result-description">{a.description || 'Présentation à compléter.'}</p>}
            </div>
          </div>
          <div className="search-result-side">
            {example ? <><p className="search-side-eyebrow">Exemples de tarifs</p><p className="search-side-price">{example.travel} € <span>de déplacement</span></p><p>Main-d’œuvre : {example.hourly} €/h</p><small>Montants TTC fictifs, pièces non comprises.</small></> : <><p className="search-side-eyebrow">Intervention à domicile</p><p>Rayon déclaré : {a.radius_km} km</p><small>Tarifs et disponibilités à confirmer.</small></>}
            <a href={href} className="btn btn-primary">Voir le profil complet</a>
            <span className="search-side-note">Présentation, prestations et informations pratiques</span>
          </div>
        </article>
      })}</div>
    </section>}
  </main></div>
}
