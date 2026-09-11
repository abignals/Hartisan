export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const demoTrades = [
  { slug: 'plombier', label: 'Plombier' },
  { slug: 'electricien', label: 'Électricien' },
  { slug: 'chauffagiste', label: 'Chauffagiste' },
  { slug: 'serrurier', label: 'Serrurier' },
]
export const demoLocations = [
  { name: 'Lyon', postal_code: '69003', lat: 45.76, lon: 4.85 },
  { name: 'Villeurbanne', postal_code: '69100', lat: 45.77, lon: 4.88 },
  { name: 'Paris', postal_code: '75011', lat: 48.86, lon: 2.38 },
]
export const demoArtisans = [
  { id: 'demo-1', test_key: 'plombier-lyon', name: 'Atelier plomberie Lyon', city: 'Lyon', postal_code: '69003', trade: 'plombier', trades: 'Plombier', lat: 45.76, lon: 4.85 },
  { id: 'demo-2', test_key: 'plombier-villeurbanne', name: 'Plomberie Villeurbanne', city: 'Villeurbanne', postal_code: '69100', trade: 'plombier', trades: 'Plombier', lat: 45.77, lon: 4.88 },
  { id: 'demo-3', test_key: 'electricien-lyon', name: 'Électricité Lyon', city: 'Lyon', postal_code: '69007', trade: 'electricien', trades: 'Électricien', lat: 45.74, lon: 4.84 },
  { id: 'demo-4', test_key: 'chauffagiste-lyon', name: 'Chauffage Lyon', city: 'Lyon', postal_code: '69008', trade: 'chauffagiste', trades: 'Chauffagiste', lat: 45.73, lon: 4.87 },
  { id: 'demo-5', test_key: 'plombier-paris', name: 'Plomberie Paris', city: 'Paris', postal_code: '75011', trade: 'plombier', trades: 'Plombier', lat: 48.86, lon: 2.38 },
  { id: 'demo-6', test_key: 'electricien-paris', name: 'Électricité Paris', city: 'Paris', postal_code: '75012', trade: 'electricien', trades: 'Électricien', lat: 48.84, lon: 2.40 },
].map(a => ({ ...a, radius_km: 20, description: 'Profil fictif pour essayer la recherche. Aucune intervention réelle.' }))
export function distance(a, b) {
  const rad = n => n * Math.PI / 180
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
