import { normalize } from './searchDemo.js'

export const locationLabel = location => location.postal_code
  ? `${location.name} (${location.postal_code})`
  : `${location.name} — toute la ville${location.department && location.department !== location.name ? ` (${location.department})` : ''}`

export function resolveTypedLocation(text, locations) {
  const query = normalize(text)
  const numeric = /^\d+$/.test(query)
  const matches = locations.filter(location => numeric
    ? location.postal_code === query
    : normalize(location.name) === query)
  const unique = [...new Map(matches.map(location => [location.code || `${location.name}-${location.lat}-${location.lon}`, location])).values()]
  if (unique.length === 1) return unique[0]
  if (unique.length > 1) throw new Error('Plusieurs communes correspondent. Choisissez celle souhaitée dans les suggestions.')
  throw new Error('Ville introuvable ou nom incomplet. Choisissez une suggestion ou précisez le nom de la ville.')
}
