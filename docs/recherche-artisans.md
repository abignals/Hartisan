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
