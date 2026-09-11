import { useEffect, useState } from 'react'

export default function DocumentPreview({ document }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl

    async function load() {
      try {
        const response = await fetch(
          document.url || `/api/documents/${document.id}/file`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Aperçu indisponible. Essayez d’ouvrir ou de télécharger le document.')

        const blob = await response.blob()
        if (controller.signal.aborted) return

        objectUrl = URL.createObjectURL(blob)
        setPreview({ url: objectUrl, type: blob.type })
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message)
      }
    }

    load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.id, document.url])

  if (error) return <p className="document-preview-message" role="alert">{error}</p>
  if (!preview) return <p className="document-preview-message" role="status">Chargement de l’aperçu…</p>

  if (preview.type.startsWith('image/')) {
    return <img className="document-preview-image" src={preview.url} alt={document.title} onError={() => setError('Cette image ne peut pas être affichée. Vous pouvez la télécharger.')} />
  }
  if (preview.type.startsWith('video/')) {
    return <video className="document-preview-video" src={preview.url} controls preload="metadata" onError={() => setError('Cette vidéo ne peut pas être lue par votre navigateur. Vous pouvez la télécharger.')} />
  }
  if (preview.type === 'application/pdf') {
    return <iframe className="document-preview-pdf" src={preview.url} title={`Aperçu de ${document.title}`} />
  }
  return <p className="document-preview-message">L’aperçu de ce format n’est pas disponible. Vous pouvez ouvrir ou télécharger le fichier.</p>
}
