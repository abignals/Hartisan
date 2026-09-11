# Documents clients — compte rendu

## Ce qui est visible

Page `/documents`, accessible depuis le menu client : grande zone cliquable ou glisser-déposer, formulaire de classement, filtres logement/catégorie et tri chronologique. La date du document prime sur la date d’ajout ; si elle est absente, la date d’ajout sert au tri. Consultation dans un nouvel onglet, téléchargement et suppression avec confirmation. Interface adaptée au mobile.

Le bouton « Essayer avec des exemples » et `/documents?demo=1` ouvrent une démonstration avec cinq PDF fictifs, deux logements et plusieurs années. Aucune insertion en base ; les modifications de la démo disparaissent en quittant ce mode ou en rechargeant. Les PDF peuvent être téléchargés puis redéposés pour tester l’enregistrement réel.

## Backend modifié

- Migration `000006_create_documents` : tables `properties` et `documents`. Chaque document appartient à un utilisateur et à l’un de ses logements. Un logement est pour ce MVP un nom, sans adresse ni équipements.
- Nouveau fichier `client_documents.go` ; routes ajoutées dans `main.go`. L’ébauche existante `documents.go` est conservée.
- API réservée aux sessions client : `GET/POST /api/properties`, `GET/POST /api/documents`, `GET /api/documents/{id}/file` (`?download=1` pour télécharger), `DELETE /api/documents/{id}`.
- Fichiers privés dans `DOCUMENTS_DIR`, noms de stockage aléatoires. Métadonnées dans PostgreSQL. Vérification du propriétaire pour chaque consultation, téléchargement et suppression, et du logement lors de l’ajout.
- Fichiers autorisés : PDF, JPEG, PNG, WebP, MP4, WebM. Contrôle du contenu détecté côté serveur, fichier non vide, limite de 20 Mo, un fichier par ajout.
- Configuration prod : volume Documents persistant et limite nginx à 21 Mo (20 Mo de fichier + formulaire). Correction du proxy nginx pour conserver `/api`, comme attendu par les routes Go.

## Activation sur un autre poste

Appliquer les migrations avec `make migrate-up`, puis redémarrer le backend de développement avec `docker compose -p docto-dev restart backend`. Le frontend Vite recharge les changements automatiquement. La migration ajoute des tables et ne recrée pas la base existante.

## Périmètre

Pas de S3, partage, OCR, rappels, devis automatique ni documents artisan. Les exemples sont explicitement fictifs. La configuration prod est ajustée pour les documents mais cela ne constitue pas un déploiement ni un audit de production.

## Vérifications effectuées sur ce poste

- Build Vite et lint frontend réussis.
- `go test ./...` réussi (pas de formatage automatique).
- Test d’intégration Documents réussi avec deux comptes temporaires, nettoyés ensuite : création du logement, ajout, liste, téléchargement, suppression du fichier physique ; refus de l’accès à un autre compte, de son logement, des catégories/dates invalides, des faux PDF et des fichiers vides.
- Migration 6 appliquée et backend local redémarré.
- `/documents` et `/documents?demo=1` répondent HTTP 200 via Vite ; `/api/documents` répond 401 sans session.
- Le rendu n’a pas été contrôlé dans un navigateur automatisé.

Deux imports inutilisés (`strings`, `unicode/utf8`) présents dans `messages.go` bloquaient la compilation : ils ont été retirés, sans autre modification de la messagerie. Les autres modifications en cours des collègues sont conservées.

## Nouvelle présentation : liste et aperçu

Les cartes sont remplacées par une arborescence dépliable **logement → catégorie → documents**. Les documents apparaissent en lignes et le tri par date s’applique dans chaque catégorie. Cliquer sur une ligne sélectionne le document et affiche son aperçu à droite (PDF, image ou vidéo), avec ses informations et les actions ouvrir, télécharger et supprimer. Sur petit écran, l’aperçu se place sous la liste.

Le premier document visible est sélectionné par défaut. Si un filtre ou une suppression retire le document sélectionné, l’aperçu affiche le premier résultat restant. Les erreurs de chargement proposent l’ouverture ou le téléchargement. Le classement par équipement (chaudière, électricité…) reste hors du modèle actuel.

Modification frontend uniquement : `Documents.jsx`, `DocumentPreview.jsx`, `documents.css`. Aucun changement backend ou base de données pour cette évolution. Build Vite et lint réussis ; rendu à vérifier dans le navigateur.

## Proposition « Mes documents » — liste directe

La consultation devient l’écran principal : liste sans dossiers dépliables, filtres logement et catégorie dans deux menus, tri global par date et aperçu à droite. Chaque ligne affiche le titre, le logement, la catégorie et la date. Les bandeaux sombres sont remplacés par des titres sobres sur fond clair et la sélection reste teal.

Le bouton « Ajouter un document » ouvre une fenêtre avec choix de fichier ou glisser-déposer, puis les champs de classement. La zone de dépôt n’occupe plus la page de consultation. Sur mobile, l’aperçu reste sous la liste.

Version précédente archivée dans `docs/versions/documents-avant-liste/`. Changements limités au frontend ; build et lint réussis. Pas de contrôle visuel automatisé dans un navigateur.
