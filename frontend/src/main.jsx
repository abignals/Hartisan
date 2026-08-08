import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.jsx'
import Inscription from './components/Inscription.jsx'
import Connexion from './components/Connexion.jsx'
import Profil from './components/Profil.jsx'
import ProfilArtisan from './components/ProfilArtisan.jsx'

const routes = {
  '/': App,
  '/inscription': Inscription,
  '/connexion': Connexion,
  '/profil': Profil,
  '/pro/profil': ProfilArtisan,
}

const Page = routes[window.location.pathname] ?? App


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>
)