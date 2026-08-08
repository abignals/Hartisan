import { IconeLieu, IconeLoupe } from './Icone.jsx'
import '../styles/index.css'
import Entete from './Entete.jsx'

const METIERS = [
    { nom: 'Plombiers'},
    { nom: 'Electricien'},
    { nom: 'Chauffagiste'},
]

const ETAPES = [
    { titre: 'Cherchez', texte: "Indiquez le metier dont vous avez besoin et votre ville." },
    { titre: 'Comparez', texte: "Consultez les profils, les avis et les disponibilites." },
    { titre: 'Reservez', texte: "Choisissez un creneau et confirmez." },
]


//TEST
const ARTISANS = [
  { id: '1', nom: 'Dupont Plomberie', metier: 'Plombier',    ville: 'Lyon 3e',      note: 4.8, avis: 127, dispo: 'Demain 9h' },
  { id: '2', nom: 'Atelier Martin',   metier: 'Menuisier',   ville: 'Villeurbanne', note: 4.9, avis: 84,  dispo: 'Jeudi 14h' },
  { id: '3', nom: 'Elec Express',     metier: 'Électricien', ville: 'Lyon 7e',      note: 4.6, avis: 203, dispo: "Aujourd'hui 17h" },
  { id: '4', nom: 'Serrurerie Nord',  metier: 'Serrurier',   ville: 'Caluire',      note: 4.7, avis: 56,  dispo: 'Lundi 10h' },
]

const initiales = (nom) =>
  nom.split(' ').slice(0, 2).map(m => m[0]).join('').toUpperCase()


export default function App() {
  return (
    <>
      <Entete />

      <main>
        {/* ---- Accroche + recherche ---- */}
        <section className="hero">
          <div className="container">
            <h1 className="hero__title">
              Trouvez un artisan et réservez en ligne
            </h1>
            <p className="hero__subtitle">
              Des professionnels vérifiés près de chez vous, avec leurs
              disponibilités en temps réel.
            </p>

            <form className="search" onSubmit={(e) => e.preventDefault()}>
              <div className="search__field">
                <IconeLoupe />
                <input
                  className="search__input"
                  type="search"
                  placeholder="Plombier, électricien, menuisier…"
                  aria-label="Métier recherché"
                />
              </div>

              <span className="search__divider" aria-hidden="true" />

              <div className="search__field">
                <IconeLieu />
                <input
                  className="search__input"
                  type="search"
                  placeholder="Où ? Ville ou code postal"
                  aria-label="Localisation"
                />
              </div>

              <button className="btn btn--primary search__submit" type="submit">
                Rechercher
              </button>
            </form>

            <p className="hero__hint">
              Plus de 2 000 artisans disponibles en Auvergne-Rhône-Alpes
            </p>
          </div>
        </section>

        {/* ---- Métiers ---- */}
        <section className="section">
          <div className="container">
            <h2 className="section__title">Quel métier cherchez-vous ?</h2>
            <p className="section__lead">
              Les interventions les plus demandées cette semaine.
            </p>

            <ul className="specialties">
              {METIERS.map((m) => (
                <li key={m.nom}>
                  <a className="specialty" href={`/recherche?metier=${m.nom.toLowerCase()}`}>
                    <span className="specialty__icon" aria-hidden="true">{m.icone}</span>
                    <span>{m.nom}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Étapes ---- */}
        <section className="section section--alt">
          <div className="container">
            <h2 className="section__title">Comment ça marche</h2>

            <ol className="steps">
              {ETAPES.map((e, i) => (
                <li className="step" key={e.titre}>
                  <span className="step__num">{i + 1}</span>
                  <h3 className="step__title">{e.titre}</h3>
                  <p className="step__text">{e.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Artisans ---- */}
        <section className="section">
          <div className="container">
            <h2 className="section__title">Artisans les mieux notés</h2>
            <p className="section__lead">Sélectionnés selon les avis vérifiés.</p>

            <div className="cards">
              {ARTISANS.map((a) => (
                <article className="card" key={a.id}>
                  <div className="card__head">
                    <div className="card__avatar">{initiales(a.nom)}</div>
                    <div>
                      <h3 className="card__name">{a.nom}</h3>
                      <p className="card__job">{a.metier}</p>
                    </div>
                  </div>

                  <div className="card__meta">
                    <span className="card__city">{a.ville}</span>
                    <span className="card__rating">
                      <span className="stars" aria-hidden="true">★</span>
                      {a.note}
                      <span className="card__job">({a.avis})</span>
                    </span>
                  </div>

                  <span className="badge">Dispo {a.dispo}</span>

                  <a className="btn btn--primary btn--block" href={`/artisan/${a.id}`}>
                    Prendre rendez-vous
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__cols">
            <div className="footer__col">
              <h4>Particuliers</h4>
              <ul>
                <li><a href="/recherche">Trouver un artisan</a></li>
                <li><a href="/metiers">Tous les métiers</a></li>
                <li><a href="/aide">Aide</a></li>
              </ul>
            </div>
            <div className="footer__col">
              <h4>Artisans</h4>
              <ul>
                <li><a href="/pro">Inscrire mon activité</a></li>
                <li><a href="/pro/tarifs">Tarifs</a></li>
                <li><a href="/pro/connexion">Espace pro</a></li>
              </ul>
            </div>
            <div className="footer__col">
              <h4>DOCTO</h4>
              <ul>
                <li><a href="/a-propos">À propos</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/recrutement">Recrutement</a></li>
              </ul>
            </div>
            <div className="footer__col">
              <h4>Légal</h4>
              <ul>
                <li><a href="/cgu">Conditions d'utilisation</a></li>
                <li><a href="/confidentialite">Confidentialité</a></li>
                <li><a href="/cookies">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="footer__bottom">
            © {new Date().getFullYear()} DOCTO — Tous droits réservés
          </div>
        </div>
      </footer>
    </>
  )
}