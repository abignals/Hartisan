import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.jsx'
import { InscriptionClient, InscriptionArtisan } from './components/Inscription.jsx'
import Connexion from './components/Connexion.jsx'
import Profil from './components/Profil.jsx'
import ProfilArtisan from './components/ProfilArtisan.jsx'

import Documents from './components/Documents.jsx'
import Messages from './components/Messages.jsx'

import Recherche from './components/Recherche.jsx'
import ArtisanPublic from './components/ArtisanPublic.jsx'
import Reservation from './components/Reservation.jsx'
import RendezVous from './components/RendezVous.jsx'
import AppointmentDetails from './components/AppointmentDetails.jsx'
import ArtisanLanding from './components/ArtisanLanding.jsx'
import Planning from './components/Planning.jsx'

const routes = {
  '/': App,
  '/recherche': Recherche,
  '/rdv': RendezVous,
  '/pro/planning': Planning,
  '/inscription': InscriptionClient,
  '/pro': ArtisanLanding,
  '/inscription/client': InscriptionClient,
  '/inscription/artisan': InscriptionArtisan,
  '/connexion': Connexion,
  '/profil': Profil,
  '/documents': Documents,
  '/messages': Messages,
  '/pro/profil': ProfilArtisan,
  '/pro/messages': Messages,
}

const Page = /^\/rdv\/[^/]+$/.test(window.location.pathname) ? AppointmentDetails : /^\/artisan\/[^/]+\/reserver\/?$/.test(window.location.pathname)
  ? Reservation
  : /^\/artisan\/[^/]+\/?$/.test(window.location.pathname)
  ? ArtisanPublic
  : routes[window.location.pathname] ?? App


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>
)