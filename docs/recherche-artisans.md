# Recherche d’artisans — compte rendu

## Essayer sur localhost

- `/recherche` : recherche dans les comptes enregistrés.
- `/recherche?demo=1` : démonstration avec des profils fictifs, sans appel à la recherche en base.
- Exemple : choisir « Plombier », saisir « Lyon » ou « 69003 », sélectionner une suggestion puis cliquer sur Rechercher. Deux plombiers de test sont disponibles autour de Lyon.

La page affiche une liste classée par proximité et une présentation consultable. Aucun prix, avis, assurance vérifiée ou créneau disponible n’est inventé. La réservation n’est pas encore développée.

## Suggestions

Métiers issus de `/api/trades`, avec correspondance insensible aux accents côté interface. Villes après deux caractères, délai de 300 ms et annulation des anciennes requêtes. Navigation clavier : flèches, Entrée et Échap.

Les noms de communes et codes postaux complets sont recherchés via l’API publique https://geo.api.gouv.fr/communes ; une panne affiche un message. Un préfixe postal propose les villes des artisans publiables puis résout la commune auprès de cette API avant la recherche. Les coordonnées précises des artisans ne sont pas renvoyées par les suggestions. Le mode fictif fonctionne avec un petit catalogue local Lyon / Villeurbanne / Paris.

## Backend modifié

Nouveau `cmd/server/search.go`, deux routes publiques en lecture :
- `GET /api/search/locations?q=…`
- `GET /api/search/artisans?trade=…&lat=…&lon=…`

PostGIS compare le centre de la commune sélectionnée au point géographique de l’artisan et à son rayon déclaré. Seuls les profils approuvés, comptes artisans non suspendus, et métiers actifs correspondants sont affichés. Maximum 50 résultats, avertissement si davantage. Aucun email, téléphone ou adresse précise publié.

Pas de migration ajoutée. Les fichiers Go existants ne sont pas reformatés ; nouvelles routes ajoutées dans `main.go`.

**Limite de la base existante :** l’inscription actuelle initialise la position artisan à `(0, 0)` et la modification du profil ne recalcule pas cette position. Ces comptes doivent donc être correctement géolocalisés et approuvés avant de figurer dans les recherches en France. Les comptes de test ont des coordonnées cohérentes avec leur commune. Le géocodage automatique des profils existants reste à traiter séparément.

## Comptes locaux de test

Six comptes, noms d’entreprise préfixés `[TEST]`, aucune intervention réelle :

- test-recherche-plombier-lyon@example.invalid
- test-recherche-plombier-villeurbanne@example.invalid
- test-recherche-electricien-lyon@example.invalid
- test-recherche-chauffagiste-lyon@example.invalid
- test-recherche-plombier-paris@example.invalid
- test-recherche-electricien-paris@example.invalid

Mot de passe aléatoire commun communiqué dans la conversation, non enregistré dans le dépôt. Connexion avec le rôle Artisan. Ces profils ont le statut approved pour tester la recherche, ce qui ne constitue pas une vérification professionnelle réelle.

L’outil `cmd/seed-search` nécessite `ALLOW_SEARCH_TEST_ACCOUNTS=1`. Il doit être exécuté uniquement contre une base locale de test ; il n’est pas lancé au démarrage. Transaction atomique : une deuxième exécution échoue si les comptes existent, sans les modifier.

## Validation

Build et lint frontend réussis. Tests Go réussis, dont test d’intégration avec comptes temporaires nettoyés : exclusion des profils en attente/suspendus, comptes suspendus, mauvais métiers et artisans hors zone ; absence de coordonnées de contact privées dans les résultats. Requêtes HTTP testées via Vite : suggestions par nom, code complet et préfixe ; résultats autour de Lyon ; rejet des coordonnées invalides.

Pas de validation visuelle automatisée dans un navigateur. L’autocomplétion de la barre d’accueil reste à intégrer : son formulaire redirige maintenant vers la page Recherche avec les termes saisis.

## Évolution : recherche par ville et profils complets

- Saisir simplement `Paris`, puis Rechercher, suffit : le nom exact est résolu automatiquement sans sélectionner un code postal. Les communes homonymes nécessitent un choix explicite. Les suggestions par nom affichent une seule entrée par commune, avec la mention « toute la ville ».
- Résultats inspirés de la hiérarchie de Doctolib : photo, nom, métier, entreprise, localisation et résumé à droite. Identité graphique HArtisan conservée.
- Chaque artisan possède une vraie page `/artisan/{id}`, rechargeable et partageable. Retour aux résultats via une URL conservant métier, lieu et mode de démonstration. Le lien de retour est limité à la recherche du site.
- Nouvelle API publique `GET /api/artisans/{id}` : ne publie que les profils approuvés dont le compte artisan n’est pas suspendu. Aucun email, téléphone privé ou adresse précise exposé.
- Un identifiant `test_key` limité aux six comptes fictifs connus permet d’afficher les exemples du fichier `frontend/src/data/artisanExamples.js`. Aucun complément fictif n’est attribué aux autres comptes ; aucune migration ni modification du formulaire d’inscription pour cette évolution.
- Compléments fictifs : nom, portrait, expérience, spécialités, prestations, formations, langues, année de création, horaires, moyens de paiement, exemples de prix TTC, zones, réalisation et avis illustratifs. Les assurances restent explicitement non vérifiées. Les horaires ne sont pas des disponibilités et aucune réservation n’est déclenchée.

### Champs à discuter pour l’inscription artisan

Photo professionnelle, nom affiché, présentation, spécialités, prestations prises en charge, expérience, formations avec justificatifs, langues, zone précise d’intervention, horaires d’activité, frais de déplacement, tarif horaire et conditions, moyens de paiement et portfolio. Les avis doivent venir de clients réels ; la validation des assurances/qualifications doit rester une procédure distincte des déclarations du professionnel.

### Vérifications du 12 septembre 2026

Build et lint frontend réussis. Tests backend, y compris filtrage des profils publics par lien direct, réussis. Vérifications JavaScript : Paris sans code postal, cas homonymes, distinction comptes réels/fictifs et retour sécurisé. Parcours HTTP via Vite validé : Paris → plombier fictif enregistré → API du profil → page directe ; image disponible. Pas de validation visuelle automatisée dans un navigateur.

### Portraits fictifs

Outil intégré imagegen utilisé, sans API CLI. Asset local : `frontend/public/images/artisans/portraits-fictifs.png`. Six portraits présentés par cadrage CSS dans une seule planche 3 × 2. Toutes les personnes sont fictives. Pas de photo récupérée sur Doctolib.

Prompt de génération :
> Use case: photorealistic-natural. Create ONE rectangular contact sheet asset for a French home-trades demo website, arranged as an exact 3 columns by 2 rows grid of six equal square professional head-and-shoulders portrait photos, edge-to-edge no gaps or borders, no text, no watermarks, no logos. Each subject is a different entirely fictional adult artisan, friendly competent natural expression, work overshirt in navy or teal or earth colors, softly blurred warm workshop background, natural light, realistic skin texture. Top row left: man age 45 short brown hair slight beard. Top row middle: man age 36 darker skin shaved head. Top row right: woman age 35 brown tied-back hair. Bottom row left: man age 52 salt and pepper hair and beard. Bottom row middle: man age 40 short dark curly hair. Bottom row right: woman age 43 short blond hair. All subjects centered within their own square with entire head and shoulders comfortably inside frame. Consistent photographic style. Overall image aspect ratio 3:2, ideally 1536x1024. This single image will be displayed using CSS grid cropping as six demo avatars.

Références de structure consultées : https://www.doctolib.fr/medecin-generaliste/paris et https://www.doctolib.fr/medecin-generaliste/paris/anne-solene-le-bideau (inspiration d’organisation, aucune donnée personnelle copiée).
