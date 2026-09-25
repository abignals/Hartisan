import { useEffect, useRef, useState } from 'react'
import PhotoPicker from './PhotoPicker.jsx'
import { sendPhoto } from '../lib/messagePhotos.js'
import '../styles/booking.css'
import Entete from './Entete.jsx'
import '../styles/etabli.css'

// Pas de WebSocket pour l'instant : on redemande au serveur a intervalle regulier.
const INTERVALLE_MS = 5000

async function api(url, options) {
  const res = await fetch(url, { credentials: 'same-origin', ...options })
  if (res.status === 401) {
    window.location.href = window.location.pathname.startsWith('/pro') ? '/connexion?role=artisan' : '/connexion'
    throw new Error('Session expiree.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Le service est indisponible. Reessayez.')
  }
  return res.json()
}

function initiales(nom) {
  return nom
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase()
}

function libelleRole(role) {
  return role === 'artisan' ? 'Artisan' : 'Particulier'
}

// Nombre de jours calendaires entre une date et aujourd'hui.
// Math.round absorbe les journees de 23 h / 25 h des changements d'heure.
function joursEcoules(date) {
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((minuit(new Date()) - minuit(date)) / 86400000)
}

function heure(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Heure dans la liste : "10:42", "Hier", "lun.", puis "07/09"
function horodatageCourt(iso) {
  const date = new Date(iso)
  const ecart = joursEcoules(date)
  if (ecart === 0) return heure(iso)
  if (ecart === 1) return 'Hier'
  if (ecart < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' })
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Separateur de jour dans le fil : les bulles n'affichent que l'heure
function libelleJour(iso) {
  const date = new Date(iso)
  const ecart = joursEcoules(date)
  if (ecart === 0) return "Aujourd'hui"
  if (ecart === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function trierParActivite(conversations) {
  return [...conversations].sort(
    (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at),
  )
}

// Garde l'id de la conversation ouverte dans l'URL : un rechargement la rouvre
function memoriserDansUrl(id) {
  const url = new URL(window.location.href)
  url.searchParams.delete('artisan')
  if (id) url.searchParams.set('c', id)
  else url.searchParams.delete('c')
  window.history.replaceState(null, '', url)
}

export default function Messages() {
  const estPro = window.location.pathname.startsWith('/pro')

  const [conversations, setConversations] = useState(null)
  const [actifId, setActifId] = useState(null)
  const [messages, setMessages] = useState(null)
  const [brouillon, setBrouillon] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [photos, setPhotos] = useState([])
  const [contextMenu, setContextMenu] = useState(null)
  const menuRef = useRef(null)
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  const messageTarget = useRef(null)
  const reportDialog = useRef(null)
  const [reportId, setReportId] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportNotice, setReportNotice] = useState('')
  const [erreur, setErreur] = useState(null)
  const [erreurFil, setErreurFil] = useState(null)

  const corpsFil = useRef(null)
  const champ = useRef(null)
  useEffect(() => {
    if (!champ.current) return
    champ.current.style.height = '42px'
    champ.current.style.height = `${Math.min(champ.current.scrollHeight + 2, 140)}px`
  }, [brouillon, actifId])

  // incremente a chaque envoi : une reponse de polling partie AVANT l'envoi
  // ne doit pas ecraser le fil (le message envoye disparaitrait quelques secondes)
  const versionFil = useRef(0)

  useEffect(() => {
    if (!contextMenu) return
    menuRef.current?.querySelector('button')?.focus()
    function close(e) {
      if (e.type === 'keydown' && e.key !== 'Escape' && e.key !== 'Tab') return
      if (e.type === 'pointerdown' && menuRef.current?.contains(e.target)) return
      setContextMenu(null)
      if (e.type === 'keydown' && e.key === 'Escape') messageTarget.current?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])
  useEffect(() => {
    if (!reportId) return
    const dialog = reportDialog.current
    dialog.showModal()
    return () => { dialog.close(); messageTarget.current?.focus() }
  }, [reportId])
  useEffect(() => () => clearTimeout(pressTimer.current), [])
  function showMenu(e, message) {
    if (!estPro || message.de_moi || reportBusy) return
    e.preventDefault()
    messageTarget.current = e.currentTarget
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({ message, x: Math.max(8, Math.min(e.clientX || rect.left, window.innerWidth - 228)), y: Math.max(8, Math.min(e.clientY || rect.bottom, window.innerHeight - 64)) })
  }

  const actif = conversations?.find((c) => c.id === actifId) ?? null

  function ouvrir(id) {
    setContextMenu(null); clearTimeout(pressTimer.current)
    setPhotos([]); setReportId(null); setReportNotice('')
    setActifId(id)
    memoriserDansUrl(id)
  }

  // Chargement initial de la liste, puis rafraichissement periodique.
  // ?artisan=<id> ouvre (ou retrouve) la conversation avec cet artisan :
  // c'est le lien que posera le bouton "Contacter" d'une fiche artisan.
  useEffect(() => {
    let annule = false

    async function demarrer() {
      try {
        const params = new URLSearchParams(window.location.search)
        let cible = params.get('c')
        const artisan = params.get('artisan')

        if (artisan) {
          // rejouable : le serveur renvoie la conversation existante si elle existe deja
          const conv = await api('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artisan_id: artisan }),
          })
          cible = conv.id
        }

        const liste = await api('/api/conversations')
        if (annule) return
        setConversations(liste)

        const bureau = window.matchMedia('(min-width: 721px)').matches
        if (cible && liste.some((c) => c.id === cible)) ouvrir(cible)
        else if (bureau && liste.length > 0) ouvrir(liste[0].id)
        else memoriserDansUrl(null)
      } catch (e) {
        if (!annule) {
          setErreur(e.message)
          setConversations([])
        }
      }
    }

    demarrer()

    const minuterie = setInterval(() => {
      if (document.hidden) return
      api('/api/conversations')
        .then((liste) => { if (!annule) setConversations(liste) })
        .catch(() => {}) // silencieux : la prochaine tentative suffit
    }, INTERVALLE_MS)

    return () => {
      annule = true
      clearInterval(minuterie)
    }
  }, [])

  // Fil de la conversation ouverte, rafraichi tant qu'elle reste ouverte
  useEffect(() => {
    if (!actifId) return
    let annule = false

    function charger() {
      const version = versionFil.current
      return api(`/api/conversations/${actifId}/messages`).then((data) => {
        if (annule || version !== versionFil.current) return
        setMessages(data)
        setErreurFil(null)
        // le GET vient de tout marquer comme lu cote serveur : on aligne la liste
        setConversations((cs) => cs?.map((c) => (c.id === actifId ? { ...c, non_lus: 0 } : c)))
      })
    }

    setMessages(null)
    setErreurFil(null)
    setBrouillon('')
    charger().catch((e) => { if (!annule) setErreurFil(e.message) })

    const minuterie = setInterval(() => {
      if (!document.hidden) charger().catch(() => {})
    }, INTERVALLE_MS)

    return () => {
      annule = true
      clearInterval(minuterie)
    }
  }, [actifId])

  // Descend en bas du fil seulement quand un message ARRIVE :
  // le polling qui renvoie le meme contenu ne doit pas faire sauter la lecture
  const dernierId = messages?.at(-1)?.id
  useEffect(() => {
    if (corpsFil.current) corpsFil.current.scrollTop = corpsFil.current.scrollHeight
  }, [dernierId])

  async function signaler(e) {
    e.preventDefault(); setReportBusy(true); setReportError('')
    try {
      await api(`/api/messages/${reportId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reportReason }) })
      setMessages(ms => ms?.map(m => m.id === reportId ? { ...m, reported: true } : m))
      setReportId(null); setReportReason(''); setReportNotice('Signalement enregistré. Il ne bloque pas automatiquement la conversation.')
    } catch (e) { setReportError(e.message) }
    finally { setReportBusy(false) }
  }

  async function envoyer(e) {
    e.preventDefault()
    const body = brouillon.trim()
    if ((!body && !photos.length) || envoi || !actifId) return
    setEnvoi(true); setErreurFil(null)
    const remaining = [...photos]
    function append(m) {
      versionFil.current += 1
      setMessages(ms => (ms ?? []).some(existing => existing.id === m.id) ? ms : [...(ms ?? []), m])
      setConversations(cs => trierParActivite(cs.map(c => c.id === actifId ? { ...c, dernier_message: m.body, last_message_at: m.created_at } : c)))
    }
    try {
      if (body) {
        append(await api(`/api/conversations/${actifId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }))
        setBrouillon('')
      }
      while (remaining.length) {
        append(await sendPhoto(actifId, remaining[0]))
        remaining.shift(); setPhotos([...remaining])
      }
    } catch (err) { setErreurFil(`${err.message} Les éléments déjà envoyés sont conservés ; vous pouvez réessayer pour le reste.`) }
    finally { setEnvoi(false); champ.current?.focus() }
  }

  return (
    <div className="etb messages-page">
      <Entete />
      {reportId && <dialog ref={reportDialog} className="booking-dialog message-report-dialog" aria-labelledby="report-title" onCancel={e => { e.preventDefault(); if (!reportBusy) setReportId(null) }}>
        <div className="booking-dialog-heading"><h2 id="report-title">Signaler un message</h2><button type="button" aria-label="Fermer" disabled={reportBusy} onClick={() => setReportId(null)}>×</button></div>
        <p>Expliquez ce qui pose problème dans ce message ou cette photo.</p>
        <form className="booking-form" onSubmit={signaler}>
          <label>Motif du signalement<textarea autoFocus required minLength={3} maxLength={1000} rows={5} value={reportReason} disabled={reportBusy} onChange={e => setReportReason(e.target.value)} placeholder="Décrivez la situation…" /></label>
          {reportError && <p className="booking-error" role="alert">{reportError}</p>}
          <div className="booking-actions"><button className="btn btn-ghost" type="button" disabled={reportBusy} onClick={() => setReportId(null)}>Annuler</button><button className="btn btn-primary" disabled={reportBusy}>{reportBusy ? 'Enregistrement…' : 'Envoyer le signalement'}</button></div>
        </form>
      </dialog>}

      {contextMenu && <div ref={menuRef} className="message-context-menu" role="menu" aria-label="Actions du message" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button type="button" role="menuitem" aria-disabled={contextMenu.message.reported} onClick={() => {
          if (contextMenu.message.reported) { setContextMenu(null); messageTarget.current?.focus(); return }
          setReportId(contextMenu.message.id); setReportReason(''); setReportError(''); setContextMenu(null)
        }}>{contextMenu.message.reported ? 'Déjà signalé' : 'Signaler ce message'}</button>
      </div>}


      <div className="page">
        <div className="page-head">
          <h1>Messages</h1>
        </div>

        {erreur && <p className="alert alert-error" role="alert">{erreur}</p>}

        {conversations === null ? (
          <p className="state-card">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="state-card">
            {estPro
              ? 'Aucune conversation pour le moment. Les nouvelles demandes de rendez-vous ouvriront un échange ici.'
              : "Aucune conversation pour le moment. Contactez un artisan depuis sa fiche pour démarrer l'échange."}
          </p>
        ) : (
          <div className={`messages-shell${actifId ? ' has-active' : ''}`}>
            <ul className="conv-list" aria-label="Conversations">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`conv-item${c.id === actifId ? ' active' : ''}${c.non_lus > 0 ? ' unread' : ''}`}
                    aria-current={c.id === actifId ? 'true' : undefined}
                    disabled={envoi || reportBusy}
                    onClick={() => ouvrir(c.id)}
                  >
                    <span className="avatar" aria-hidden="true">{initiales(c.autre_nom)}</span>
                    <span className="conv-meta">
                      <span className="conv-top">
                        <span className="name">{c.autre_nom}</span>
                        <span className="time">{horodatageCourt(c.last_message_at)}</span>
                      </span>
                      <span className="conv-role">{libelleRole(c.autre_role)}</span>
                      <span className="conv-snippet">
                        {c.dernier_message || <em>Nouvelle conversation</em>}
                      </span>
                    </span>
                    {c.non_lus > 0 && (
                      <span className="unread-dot">
                        <span className="sr-only">{c.non_lus} non lu{c.non_lus > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <section className="thread" aria-label={actif ? `Conversation avec ${actif.autre_nom}` : 'Conversation'}>
              {!actif ? (
                <p className="thread-empty">Choisissez une conversation.</p>
              ) : (
                <>
                  <div className="thread-head">
                    <button
                      type="button"
                      className="thread-back"
                      disabled={envoi || reportBusy}
                      onClick={() => ouvrir(null)}
                      aria-label="Retour aux conversations"
                    >
                      ←
                    </button>
                    <span className="avatar" aria-hidden="true">{initiales(actif.autre_nom)}</span>
                    <div>
                      <div className="name">{actif.autre_nom}</div>
                      <div className="role">{libelleRole(actif.autre_role)}</div>
                    </div>
                  </div>

                  <div className="thread-body" ref={corpsFil}>
                    {messages === null ? (
                      <p className="thread-empty">{erreurFil ?? 'Chargement…'}</p>
                    ) : messages.length === 0 ? (
                      <p className="thread-empty">Aucun message. Écrivez le premier.</p>
                    ) : (
                      messages.map((m, i) => {
                        const jour = libelleJour(m.created_at)
                        const nouveauJour = i === 0 || libelleJour(messages[i - 1].created_at) !== jour
                        return (
                          <div key={m.id} className="bubble-row">
                            {nouveauJour && <p className="day-sep">{jour}</p>}
                            <div className={`bubble ${m.de_moi ? 'me' : 'them'}`}
                              tabIndex={estPro && !m.de_moi ? 0 : undefined}
                              aria-label={estPro && !m.de_moi ? 'Message reçu. Menu avec clic droit ou Majuscule F10.' : undefined}
                              onContextMenu={e => showMenu(e, m)}
                              onKeyDown={e => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) showMenu(e, m) }}
                              onPointerDown={e => {
                                longPressed.current = false
                                if (e.pointerType !== 'touch' || !estPro || m.de_moi || reportBusy) return
                                const target = e.currentTarget, x = e.clientX, y = e.clientY
                                clearTimeout(pressTimer.current)
                                pressTimer.current = setTimeout(() => { longPressed.current = true; showMenu({ preventDefault() {}, currentTarget: target, clientX: x, clientY: y }, m) }, 550)
                              }}
                              onPointerUp={() => clearTimeout(pressTimer.current)}
                              onPointerCancel={() => clearTimeout(pressTimer.current)}
                              onPointerMove={() => clearTimeout(pressTimer.current)}
                              onClickCapture={e => { if (longPressed.current) { e.preventDefault(); e.stopPropagation(); longPressed.current = false } }}>

                              {m.photo_url ? <a href={m.photo_url} target="_blank" rel="noreferrer"><img className="message-photo" src={m.photo_url} alt="Photo envoyée dans la conversation — ouvrir en grand" loading="lazy" /></a> : m.body}
                              <span className="stamp-time">{heure(m.created_at)}</span>
                            </div>

                          </div>
                        )
                      })
                    )}
                  </div>

                  {erreurFil && messages !== null && (
                    <p className="thread-error" role="alert">{erreurFil}</p>
                  )}

                  {reportNotice && <p role="status" className="booking-notice">{reportNotice}</p>}
                  <form className="thread-input" onSubmit={envoyer}>
                    <textarea
                      ref={champ}
                      rows={1}
                      title="Entrée : nouvelle ligne · Ctrl ou ⌘ + Entrée : envoyer"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          e.currentTarget.form.requestSubmit()
                        }
                      }}
                      placeholder="Écrire un message…"
                      aria-label="Votre message"
                      maxLength={5000}
                      value={brouillon}
                      onChange={(e) => setBrouillon(e.target.value)}
                      disabled={messages === null || envoi}
                    />
                    <PhotoPicker compact files={photos} onChange={setPhotos} disabled={envoi || messages === null} />
                    <button type="submit" disabled={envoi || messages === null || (!brouillon.trim() && !photos.length)}>
                      {envoi ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
