import { useEffect, useRef, useState } from 'react'
import Entete from './Entete.jsx'
import DocumentPreview from './DocumentPreview.jsx'
import '../styles/etabli.css'
import '../styles/documents.css'

const CATEGORIES = { devis: 'Devis', facture: 'Factures', assurance: 'Assurances', garantie: 'Garanties', diagnostic: 'Diagnostics', photo: 'Photos', video: 'Vidéos', autre: 'Autres' }
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.mp4,.webm'
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
const DEMO_PROPERTIES = [{ id: 'paris', name: 'Appartement Paris' }, { id: 'lyon', name: 'Maison Lyon' }]
const EXAMPLES = [
  ['Facture entretien chaudière', 'facture', 'paris', '2026-09-02'],
  ['Devis rénovation salle de bain', 'devis', 'lyon', '2026-08-18'],
  ['Garantie chauffe-eau', 'garantie', 'paris', '2025-04-12'],
  ['Diagnostic électrique', 'diagnostic', 'lyon', '2024-06-03'],
  ['Assurance habitation', 'assurance', 'paris', '2026-01-01'],
]
function demoFile(title) {
  const content = `BT /F1 18 Tf 45 760 Td (HARTISAN - DOCUMENT FICTIF) Tj 0 -40 Td /F1 12 Tf (${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '')}) Tj 0 -30 Td (Exemple de demonstration - aucune valeur contractuelle.) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new File([pdf], `${title}.pdf`, { type: 'application/pdf' })
}
async function api(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Connectez-vous pour accéder à vos documents.')
    if (res.status === 403) throw new Error('Cette page est réservée aux comptes clients.')
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Le service est indisponible. Veuillez réessayer.')
  }
  return res.status === 204 || res.status === 201 ? null : res.json()
}
const dateLabel = value => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('fr-FR')
const sizeLabel = size => size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} Ko` : `${(size / 1048576).toFixed(1)} Mo`

export default function Documents() {
  const [demo, setDemo] = useState(new URLSearchParams(window.location.search).get('demo') === '1')
  const [documents, setDocuments] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [category, setCategory] = useState('')
  const [property, setProperty] = useState('')
  const [sort, setSort] = useState('desc')
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  const [formError, setFormError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const input = useRef(null)
  const dialog = useRef(null)
  const deleteDialog = useRef(null)
  const urls = useRef([])

  async function refresh() {
    const [docs, homes] = await Promise.all([api('/api/documents'), api('/api/properties')])
    setDocuments(docs); setProperties(homes)
  }
  useEffect(() => {
    let active = true
    setSelectedId(null); setLoading(true); setReady(false); setError(''); setNotice(''); setCategory(''); setProperty('')
    if (demo) {
      setReady(true); setProperties(DEMO_PROPERTIES)
      setDocuments(EXAMPLES.map(([title, category, property_id, document_date], i) => {
        const file = demoFile(title); const url = URL.createObjectURL(file); urls.current.push(url)
        return { id: `demo-${i}`, title, category, property_id, property_name: DEMO_PROPERTIES.find(p => p.id === property_id).name, document_date, created_at: '2026-09-10T12:00:00Z', original_filename: file.name, size: file.size, url }
      }))
      setLoading(false)
    } else {
      Promise.all([api('/api/documents'), api('/api/properties')]).then(([docs, homes]) => {
        if (active) { setDocuments(docs); setProperties(homes); setReady(true) }
      }).catch(e => { if (active) { setError(e.message); setDocuments([]); setProperties([]) } }).finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = [] }
  }, [demo])
  useEffect(() => { if (draft) dialog.current?.showModal() }, [draft])
  useEffect(() => { if (deleting) deleteDialog.current?.showModal() }, [deleting])

  function selectFiles(files) {
    setError(''); setNotice('')
    if (files.length !== 1) { setFormError('Ajoutez un fichier à la fois pour le classer dans le bon logement.'); return }
    const file = files[0]
    if (!TYPES.includes(file.type) || file.size === 0 || file.size > 20 * 1048576) { setFormError('Choisissez un PDF, JPG, PNG, WebP, MP4 ou WebM non vide de 20 Mo maximum.'); return }
    setFormError(''); setDraft({ file, title: file.name.replace(/\.[^.]+$/, '').slice(0, 200), category: file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'autre', property_id: property || properties[0]?.id || 'new', name: '', document_date: '' })
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setFormError('')
    try {
      if (!draft.file) throw new Error('Choisissez un fichier à ajouter.')
      if (!draft.title.trim()) throw new Error('Indiquez un titre pour le document.')
      let home = properties.find(p => p.id === draft.property_id)
      if (!home) {
        if (!draft.name.trim()) throw new Error('Indiquez le nom du logement.')
        home = demo ? { id: crypto.randomUUID(), name: draft.name.trim() } : await api('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draft.name.trim() }) })
        setProperties(prev => prev.some(p => p.id === home.id) ? prev : [...prev, home])
      }
      if (demo) {
        const url = URL.createObjectURL(draft.file); urls.current.push(url)
        setDocuments(prev => [{ ...draft, id: crypto.randomUUID(), property_id: home.id, property_name: home.name, original_filename: draft.file.name, size: draft.file.size, created_at: new Date().toISOString(), url }, ...prev])
      } else {
        const body = new FormData()
        for (const key of ['title', 'category', 'document_date', 'file']) body.append(key, draft[key])
        body.append('property_id', home.id)
        await api('/api/documents', { method: 'POST', body })
      }
      setDraft(null); setNotice(demo ? 'Document ajouté à la démonstration (temporaire).' : 'Document enregistré.')
      if (!demo) { try { await refresh() } catch { setError('Document enregistré, mais la liste n’a pas pu être actualisée. Rechargez la page.') } }
    } catch (e) { setFormError(e.message) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true)
    try {
      if (!demo) await api(`/api/documents/${deleting.id}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== deleting.id)); setDeleting(null); setNotice('Document supprimé.'); setError('')
    } catch (e) { setDeleting(null); setError(e.message) } finally { setBusy(false) }
  }
  const visible = documents.filter(d => (!category || d.category === category) && (!property || d.property_id === property)).sort((a, b) => {
    const difference = new Date(a.document_date || a.created_at) - new Date(b.document_date || b.created_at)
    return sort === 'asc' ? difference : -difference
  })
  const selected = visible.find(doc => doc.id === selectedId) || visible[0]
  function openUpload() {
    setFormError('')
    setDragging(false)
    setDraft({ file: null, title: '', category: 'autre', property_id: property || properties[0]?.id || 'new', name: '', document_date: '' })
  }

  const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }))

  return <div className="etb"><Entete /><main className="page documents-page">
    <div className="documents-heading">
      <div>
        <h1>Mes documents</h1>
        <p>Retrouvez vos factures, devis et garanties en un seul endroit.</p>
      </div>
      <button className="btn btn-primary documents-add" disabled={loading || !ready} onClick={openUpload}>
        <span aria-hidden="true">＋</span> Ajouter un document
      </button>
    </div>
    {demo && <div className="documents-demo" role="status"><strong>Mode démonstration</strong><span>Documents fictifs. Vos modifications ici sont temporaires.</span></div>}
    {error && <p className="documents-error" role="alert">{error} {!demo && <a href="/connexion">Connexion</a>}</p>}
    {notice && <p className="documents-notice" role="status">{notice}</p>}
    <section className="documents-library" aria-label="Mes documents">
      <div className="documents-toolbar">
        <div className="documents-selects">
          <label>Logement
            <select value={property} onChange={e => setProperty(e.target.value)}>
              <option value="">Tous</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Catégorie
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Toutes</option>
              {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <label>Trier par date
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="desc">Plus récents d’abord</option>
            <option value="asc">Plus anciens d’abord</option>
          </select>
        </label>
      </div>
      {loading ? <p role="status" className="documents-empty">Chargement de vos documents…</p> : visible.length ? (
        <div className="documents-explorer">
          <section className="documents-list-panel" aria-label="Liste des documents">
            <div className="documents-list-heading">
              <h2>{visible.length} document{visible.length > 1 ? 's' : ''}</h2>
            </div>
            <div className="documents-list-columns" aria-hidden="true"><span>Document / logement</span><span>Date</span></div>
            <ul className="documents-flat-list">
              {visible.map(doc => (
                <li key={doc.id}>
                  <button
                    className={`document-row ${selected?.id === doc.id ? 'is-selected' : ''}`}
                    aria-pressed={selected?.id === doc.id}
                    aria-controls="document-preview"
                    onClick={() => setSelectedId(doc.id)}
                  >
                    <span className={`document-file-icon type-${doc.category}`} aria-hidden="true">
                      {doc.original_filename.split('.').pop().toUpperCase()}
                    </span>
                    <span className="document-row-name">
                      <strong>{doc.title}</strong>
                      <span>{doc.property_name} <span aria-hidden="true">·</span> {CATEGORIES[doc.category]}</span>
                    </span>
                    <span className="document-row-date">{dateLabel(doc.document_date || doc.created_at)}</span>
                    <span className="document-row-arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {selected && (
            <aside className="document-preview-panel" id="document-preview" aria-label="Aperçu du document sélectionné">
              <div className="document-preview-label">Aperçu du document</div>
              <div className="document-preview-heading">
                <h3>{selected.title}</h3>
                <p>{selected.property_name} / {CATEGORIES[selected.category]}</p>
              </div>
              <div className="document-preview-content">
                <DocumentPreview key={`${demo}-${selected.id}`} document={selected} />
              </div>
              <div className="document-preview-details">
                <p className="document-filename">{selected.original_filename} · {sizeLabel(selected.size)}</p>
                <dl>
                  <div><dt>Date du document</dt><dd>{selected.document_date ? dateLabel(selected.document_date) : 'Non renseignée'}</dd></div>
                  <div><dt>Ajouté le</dt><dd>{dateLabel(selected.created_at)}</dd></div>
                </dl>
                <div className="document-actions">
                  <a href={selected.url || `/api/documents/${selected.id}/file`} target="_blank" rel="noreferrer">Ouvrir ↗</a>
                  <a href={selected.url || `/api/documents/${selected.id}/file?download=1`} download={selected.original_filename}>Télécharger</a>
                  <button onClick={() => setDeleting(selected)}>Supprimer</button>
                </div>
                <p className="document-preview-hint">Si votre navigateur n’affiche pas l’aperçu, utilisez « Ouvrir ».</p>
              </div>
            </aside>
          )}
        </div>
      ) : <div className="documents-empty"><h3>{documents.length ? 'Aucun document pour ces filtres' : 'Votre carnet de logement commence ici'}</h3><p>{documents.length ? 'Essayez un autre logement ou une autre catégorie.' : 'Ajoutez votre première facture, garantie ou diagnostic pour le retrouver facilement.'}</p>{documents.length > 0 && <button className="btn btn-ghost" onClick={() => { setProperty(''); setCategory('') }}>Réinitialiser les filtres</button>}</div>}
    </section>
    <div className="documents-demo-switch"><button onClick={() => setDemo(!demo)}>{demo ? 'Quitter la démonstration' : 'Essayer avec des exemples'}</button></div>
    {draft && <dialog ref={dialog} className="documents-dialog" onCancel={e => { if (busy) e.preventDefault(); else setDraft(null) }}><form onSubmit={save}><div className="documents-modal-head"><h2>Ajouter un document</h2><button type="button" aria-label="Fermer" disabled={busy} onClick={() => setDraft(null)}>×</button></div><input ref={input} type="file" accept={ACCEPT} hidden disabled={busy} onChange={e => { if (e.target.files.length) selectFiles(e.target.files); e.target.value = '' }} />
      <button type="button" autoFocus className={`documents-drop ${dragging ? 'is-dragging' : ''}`} disabled={busy}
        onClick={() => input.current.click()}
        onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) selectFiles(e.dataTransfer.files) }}>
        <strong>{dragging ? 'Relâchez votre fichier ici' : draft.file ? 'Changer de fichier' : 'Choisir un fichier'}</strong>
        <span>ou glissez-déposez votre document ici</span>
        <small>PDF, JPG, PNG, WebP, MP4, WebM · 20 Mo maximum</small>
      </button>
      {draft.file && <p className="documents-selected-file">{draft.file.name} · {sizeLabel(draft.file.size)}</p>}
      <fieldset disabled={busy || !draft.file}><label>Titre<input required maxLength={200} value={draft.title} onChange={e => update('title', e.target.value)} /></label><label>Logement<select value={draft.property_id} onChange={e => update('property_id', e.target.value)}>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="new">+ Ajouter un logement</option></select></label>{draft.property_id === 'new' && <label>Nom du logement<input required maxLength={120} placeholder="Ex. Appartement Paris" value={draft.name} onChange={e => update('name', e.target.value)} /></label>}<div className="documents-form-row"><label>Catégorie<select value={draft.category} onChange={e => update('category', e.target.value)}>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Date du document <small>(facultatif)</small><input type="date" value={draft.document_date} onChange={e => update('document_date', e.target.value)} /></label></div></fieldset>{formError && <p role="alert" className="documents-error">{formError}</p>}<div className="documents-modal-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>Annuler</button><button className="btn btn-primary" disabled={busy || !draft.file}>{busy ? 'Enregistrement…' : 'Ajouter le document'}</button></div></form></dialog>}
    {deleting && <dialog ref={deleteDialog} className="documents-dialog" onCancel={e => { if (busy) e.preventDefault(); else setDeleting(null) }}><h2>Supprimer ce document ?</h2><p>« {deleting.title} » sera supprimé{demo ? ' de la démonstration' : ' définitivement'}.</p><div className="documents-modal-actions"><button autoFocus className="btn btn-ghost" disabled={busy} onClick={() => setDeleting(null)}>Annuler</button><button className="btn documents-delete" disabled={busy} onClick={remove}>{busy ? 'Suppression…' : 'Supprimer'}</button></div></dialog>}
  </main></div>
}
