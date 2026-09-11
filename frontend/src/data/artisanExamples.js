// Données de conception uniquement : jamais appliquées à un compte réel.
const examples = {
  'plombier-lyon': {
    person: 'Thomas Laurent', portrait: 0, experience: 14, since: 2017,
    headline: 'Plombier · Dépannage et rénovation de salle de bain',
    intro: 'Je vous accompagne du petit dépannage à la rénovation de votre salle de bain. Je prends le temps d’expliquer le problème et les solutions possibles avant de commencer les travaux.',
    specialties: ['Recherche de fuite', 'Robinetterie', 'Salle de bain', 'Débouchage'],
    services: ['Réparation des fuites visibles et remplacement de joints', 'Pose de robinets, lavabos et WC', 'Rénovation des réseaux d’eau en appartement'],
    qualifications: ['CAP Installateur sanitaire — 2012', 'Formation entretien des réseaux d’eau — 2021'],
    languages: ['Français', 'Anglais'], zones: ['Lyon', 'Villeurbanne', 'Bron'],
    travel: 35, hourly: 65, diagnostic: 85, payments: ['Carte bancaire', 'Virement', 'Espèces'],
    hours: 'Du lundi au vendredi, de 8 h à 18 h', rating: '4,9', reviews: 38,
    project: 'Rénovation d’une salle de bain de 5 m²', projectDetail: 'Remplacement de la baignoire par une douche, reprise de l’alimentation et pose d’un meuble vasque. Durée indicative : 6 jours.',
  },
  'plombier-villeurbanne': {
    person: 'Karim Morel', portrait: 1, experience: 9, since: 2020,
    headline: 'Plombier · Fuites, canalisations et chauffe-eau',
    intro: 'Spécialisé dans les dépannages du quotidien, j’interviens dans les appartements et les maisons. Un premier échange et quelques photos permettent de préparer les pièces nécessaires.',
    specialties: ['Fuites', 'Chauffe-eau électrique', 'Canalisations', 'WC'],
    services: ['Remplacement de mécanismes de chasse d’eau', 'Diagnostic d’un chauffe-eau électrique', 'Débouchage des évacuations domestiques'],
    qualifications: ['CAP Monteur en installations sanitaires — 2017'],
    languages: ['Français', 'Arabe'], zones: ['Villeurbanne', 'Lyon', 'Vaulx-en-Velin'],
    travel: 30, hourly: 60, diagnostic: 75, payments: ['Carte bancaire', 'Virement'],
    hours: 'Du lundi au samedi, de 8 h 30 à 18 h', rating: '4,8', reviews: 24,
    project: 'Remplacement d’un chauffe-eau de 150 litres', projectDetail: 'Dépose de l’ancien appareil, remplacement du groupe de sécurité et mise en service. Intervention illustrative sur une demi-journée.',
  },
  'electricien-lyon': {
    person: 'Claire Dubois', portrait: 2, experience: 11, since: 2018,
    headline: 'Électricienne · Dépannage et rénovation électrique',
    intro: 'J’interviens sur les installations électriques des logements, avec une attention particulière à la sécurité et à la clarté des explications. Je propose des solutions adaptées à l’usage de chaque pièce.',
    specialties: ['Tableau électrique', 'Pannes de courant', 'Éclairage', 'Prises électriques'],
    services: ['Recherche de panne sur un circuit', 'Remplacement de prises et interrupteurs', 'Rénovation d’un tableau électrique après diagnostic'],
    qualifications: ['Bac professionnel Électrotechnique — 2014', 'Formation sécurité électrique — 2024'],
    languages: ['Français', 'Anglais'], zones: ['Lyon', 'Oullins', 'Bron'],
    travel: 40, hourly: 70, diagnostic: 95, payments: ['Carte bancaire', 'Virement'],
    hours: 'Du lundi au vendredi, de 8 h à 17 h 30', rating: '4,9', reviews: 46,
    project: 'Rénovation d’un tableau électrique', projectDetail: 'Repérage des circuits, remplacement du tableau et remise d’un compte rendu. Chantier fictif dans un appartement de 70 m².',
  },
  'chauffagiste-lyon': {
    person: 'Marc Renaud', portrait: 3, experience: 22, since: 2010,
    headline: 'Chauffagiste · Entretien et dépannage du chauffage',
    intro: 'Mon activité est centrée sur l’entretien et le dépannage des installations de chauffage domestique. Je privilégie un diagnostic expliqué et la réparation lorsque celle-ci est adaptée.',
    specialties: ['Chaudière', 'Radiateurs', 'Thermostat', 'Entretien annuel'],
    services: ['Diagnostic d’une panne de chauffage', 'Entretien d’une chaudière domestique', 'Réglage des radiateurs et du thermostat'],
    qualifications: ['BEP Techniques des installations thermiques — 2003', 'Formation maintenance des chaudières — 2023'],
    languages: ['Français'], zones: ['Lyon', 'Vénissieux', 'Saint-Priest'],
    travel: 45, hourly: 75, diagnostic: 110, payments: ['Carte bancaire', 'Virement', 'Chèque'],
    hours: 'Du lundi au vendredi, de 8 h à 18 h', rating: '4,8', reviews: 67,
    project: 'Amélioration du confort de chauffage', projectDetail: 'Remplacement du thermostat, équilibrage des radiateurs et explication des réglages au client. Exemple de chantier sur une journée.',
  },
  'plombier-paris': {
    person: 'Julien Martin', portrait: 4, experience: 12, since: 2016,
    headline: 'Plombier · Dépannage et installations sanitaires',
    intro: 'J’accompagne les particuliers dans l’entretien de leur plomberie, notamment dans les appartements anciens. Je protège la zone de travail et vous explique le devis avant toute intervention.',
    specialties: ['Recherche de fuite', 'Appartements anciens', 'Robinetterie', 'Débouchage'],
    services: ['Réparation des fuites sous évier', 'Remplacement d’équipements sanitaires', 'Diagnostic et remise en état d’évacuations'],
    qualifications: ['CAP Installateur sanitaire — 2013', 'Formation rénovation en habitat ancien — 2022'],
    languages: ['Français', 'Anglais'], zones: ['Paris', 'Montreuil', 'Vincennes'],
    travel: 45, hourly: 75, diagnostic: 95, payments: ['Carte bancaire', 'Virement', 'Espèces'],
    hours: 'Du lundi au samedi, de 8 h à 19 h', rating: '4,9', reviews: 52,
    project: 'Remise en état de la plomberie d’une cuisine', projectDetail: 'Remplacement du mitigeur, du siphon et des flexibles, puis contrôle d’étanchéité. Intervention fictive dans un appartement parisien.',
  },
  'electricien-paris': {
    person: 'Sophie Bernard', portrait: 5, experience: 16, since: 2015,
    headline: 'Électricienne · Sécurité, éclairage et dépannage',
    intro: 'Je réalise les dépannages et les petits travaux électriques des logements parisiens. Une description précise du problème me permet de préparer l’intervention et de limiter les déplacements inutiles.',
    specialties: ['Dépannage', 'Tableau électrique', 'Éclairage LED', 'Rénovation'],
    services: ['Diagnostic d’un disjoncteur qui déclenche', 'Pose de luminaires et remplacement de prises', 'Amélioration d’une installation après diagnostic'],
    qualifications: ['Bac professionnel Électrotechnique — 2009', 'Formation rénovation électrique — 2021'],
    languages: ['Français', 'Espagnol'], zones: ['Paris', 'Charenton-le-Pont', 'Saint-Mandé'],
    travel: 45, hourly: 80, diagnostic: 105, payments: ['Carte bancaire', 'Virement'],
    hours: 'Du lundi au vendredi, de 9 h à 18 h', rating: '4,8', reviews: 31,
    project: 'Modernisation de l’éclairage d’un appartement', projectDetail: 'Pose de points lumineux et remplacement des commandes dans trois pièces. Exemple de réalisation sans client réel.',
  },
}

export function enrichArtisan(artisan) {
  const example = examples[artisan.test_key]
  return { ...artisan, example: example || null }
}

export function profileHref(artisan, demo, returnTo) {
  const params = new URLSearchParams()
  if (demo) params.set('demo', '1')
  if (returnTo) params.set('retour', returnTo)
  return `/artisan/${encodeURIComponent(artisan.id)}${params.size ? `?${params}` : ''}`
}

export function safeSearchReturn(value) {
  if (!value) return '/recherche'
  try {
    const url = new URL(value, 'https://hartisan.example')
    return url.origin === 'https://hartisan.example' && url.pathname === '/recherche' ? `${url.pathname}${url.search}` : '/recherche'
  } catch { return '/recherche' }
}
