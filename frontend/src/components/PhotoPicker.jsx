import { useEffect, useRef, useState } from 'react'

export default function PhotoPicker({ files, onChange, disabled = false, compact = false }) {
  const input = useRef(null)
  const [previews, setPreviews] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  function select(e) {
    const incoming = Array.from(e.target.files)
    e.target.value = ''
    if (incoming.some(file => !['image/jpeg', 'image/png'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setError('Choisissez des photos JPEG ou PNG de 8 Mo maximum chacune.'); return
    }
    if (files.length + incoming.length > 5) { setError('Vous pouvez sélectionner jusqu’à 5 photos à la fois.'); return }
    setError(''); onChange([...files, ...incoming])
  }
  if (compact) return <div className="photo-picker-compact">
    <input ref={input} type="file" accept="image/jpeg,image/png" multiple hidden disabled={disabled} onChange={select} />
    <button type="button" className="photo-add-button" title="Ajouter des photos" aria-label="Ajouter des photos" disabled={disabled} onClick={() => input.current?.click()}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
    {(files.length > 0 || error) && <div className="photo-compact-selection">
      {error && <p role="alert">{error}</p>}
      {files.map((file, i) => <div key={`${file.name}-${i}`}><img src={previews[i]} alt={file.name} /><button type="button" disabled={disabled} aria-label={`Retirer ${file.name}`} title={`Retirer ${file.name}`} onClick={() => onChange(files.filter((_, index) => index !== i))}>×</button></div>)}
    </div>}
  </div>
  return <div className="photo-picker">
    <label>Ajouter des photos (facultatif)<input type="file" accept="image/jpeg,image/png" multiple disabled={disabled} onChange={select} /></label>
    <p>JPEG ou PNG · 8 Mo et 20 mégapixels maximum par photo · 5 photos à la fois.</p>
    {error && <p role="alert">{error}</p>}
    <div className="photo-selection">{files.map((file, i) => <div key={`${file.name}-${i}`}><img src={previews[i]} alt={`Photo sélectionnée : ${file.name}`} /><span>{file.name}</span><button type="button" disabled={disabled} onClick={() => onChange(files.filter((_, index) => index !== i))}>Retirer</button></div>)}</div>
  </div>
}
