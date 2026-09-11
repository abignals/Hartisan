import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.jsx'
import Inscription from './components/Inscription.jsx'
import Connexion from './components/Connexion.jsx'
import Profil from './components/Profil.jsx'
import ProfilArtisan from './components/ProfilArtisan.jsx'

import Documents from './components/Documents.jsx'
import Messages from './components/Messages.jsx'

import Recherche from './components/Recherche.jsx'
import ArtisanPublic from './components/ArtisanPublic.jsx'

const routes = {
  '/': App,
  '/recherche': Recherche,
  '/inscription': Inscription,
  '/connexion': Connexion,
  '/profil': Profil,
  '/documents': Documents,
  '/messages': Messages,
  '/pro/profil': ProfilArtisan,
  '/pro/messages': Messages,
}

const Page = /^\/artisan\/[^/]+\/?$/.test(window.location.pathname)
  ? ArtisanPublic
  : routes[window.location.pathname] ?? App


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>
)