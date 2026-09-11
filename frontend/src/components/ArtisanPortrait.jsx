import { useState } from 'react'

export default function ArtisanPortrait({ artisan, large = false }) {
  const [failed, setFailed] = useState(false)
  const index = artisan.example?.portrait
  const label = artisan.example?.person || artisan.name.replace('[TEST] ', '')
  if (index === undefined || failed) {
    return <div className={`artisan-portrait artisan-portrait-fallback ${large ? 'is-large' : ''}`} aria-label={`Photo non renseignée : ${label}`}>
      <span aria-hidden="true">{label.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>
    </div>
  }
  return <div className={`artisan-portrait ${large ? 'is-large' : ''}`}>
    <img src="/images/artisans/portraits-fictifs.png" alt={`Portrait fictif de ${label}`}
      onError={() => setFailed(true)} loading={large ? 'eager' : 'lazy'}
      style={{ left: `${-(index % 3) * 100}%`, top: `${-Math.floor(index / 3) * 100}%` }} />
  </div>
}
