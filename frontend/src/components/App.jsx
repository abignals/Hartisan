import Entete from './Entete.jsx'
import '../styles/etabli.css'

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
    <div className="etb">
      <Entete />

      <main>
        {/* ---- Accroche + recherche ---- */}
        <section className="hero">
          <div className="hero-inner">
            <p className="eyebrow">Artisans vérifiés</p>
            <h1>Trouvez un artisan et réservez en ligne</h1>
            <p className="lead">
              Des professionnels vérifiés près de chez vous, avec leurs
              disponibilités en temps réel.
            </p>

            <form className="search" onSubmit={(e) => e.preventDefault()}>
              <div className="search-field">
                <label htmlFor="q-metier">Métier</label>
                <input
                  id="q-metier"
                  type="search"
                  placeholder="Plombier, électricien, menuisier…"
                />
              </div>

              <span className="search-sep" aria-hidden="true" />

              <div className="search-field">
                <label htmlFor="q-lieu">Où</label>
                <input
                  id="q-lieu"
                  type="search"
                  placeholder="Ville ou code postal"
                />
              </div>

              <button type="submit">Rechercher</button>
            </form>

            <p className="hero-hint">
              Plus de 2 000 artisans disponibles en Auvergne-Rhône-Alpes
            </p>
          </div>
        </section>

        {/* ---- Métiers ---- */}
        <section className="band">
          <div className="band-inner">
            <div className="band-head">
              <h2>Quel métier cherchez-vous ?</h2>
              <p>Les interventions les plus demandées cette semaine.</p>
            </div>

            <ul className="trades">
              {METIERS.map((m) => (
                <li key={m.nom}>
                  <a href={`/recherche?metier=${m.nom.toLowerCase()}`}>
                    {m.nom}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Étapes ---- */}
        <section className="band band-alt">
          <div className="band-inner">
            <div className="band-head">
              <h2>Comment ça marche</h2>
            </div>

            <ol className="steps">
              {ETAPES.map((e, i) => (
                <li className="step" key={e.titre}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{e.titre}</h3>
                  <p>{e.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Artisans ---- */}
        <section className="band">
          <div className="band-inner">
            <div className="band-head">
              <h2>Artisans les mieux notés</h2>
              <p>Sélectionnés selon les avis vérifiés.</p>
            </div>

            <div className="pros">
              {ARTISANS.map((a) => (
                <article className="pro-card" key={a.id}>
                  <div className="pro-top">
                    <div className="avatar">{initiales(a.nom)}</div>
                    <div>
                      <div className="pro-name">{a.nom}</div>
                      <div className="pro-job">{a.metier}</div>
                    </div>
                  </div>

                  <div className="pro-meta">
                    <span>{a.ville}</span>
                    <span className="pro-rating">
                      ★ {a.note} <span className="count">({a.avis})</span>
                    </span>
                  </div>

                  <span className="stamp confirmed">Dispo {a.dispo}</span>

                  <a className="btn btn-primary" href={`/artisan/${a.id}`}>
                    Prendre rendez-vous
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-cols">
            <div>
              <h4>Particuliers</h4>
              <ul>
                <li><a href="/recherche">Trouver un artisan</a></li>
                <li><a href="/metiers">Tous les métiers</a></li>
                <li><a href="/aide">Aide</a></li>
              </ul>
            </div>
            <div>
              <h4>Artisans</h4>
              <ul>
                <li><a href="/pro">Inscrire mon activité</a></li>
                <li><a href="/pro/tarifs">Tarifs</a></li>
                <li><a href="/connexion">Espace pro</a></li>
              </ul>
            </div>
            <div>
              <h4>L'Établi</h4>
              <ul>
                <li><a href="/a-propos">À propos</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/recrutement">Recrutement</a></li>
              </ul>
            </div>
            <div>
              <h4>Légal</h4>
              <ul>
                <li><a href="/cgu">Conditions d'utilisation</a></li>
                <li><a href="/confidentialite">Confidentialité</a></li>
                <li><a href="/cookies">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} L'Établi — Tous droits réservés</span>
            <span>l'artisan qu'on connaît, l'heure qu'on respecte</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
