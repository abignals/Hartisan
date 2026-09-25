# Deux parcours d'inscription

`/inscription` propose deux choix. `/inscription/client` contient le formulaire court ; `/inscription/artisan` présente un formulaire en trois étapes avec retour en arrière sans perdre la saisie.

Client : prénom, nom, email (identifiant), téléphone, mot de passe et confirmation.

Artisan :
1. Coordonnées de contact et mot de passe.
2. Nom d'entreprise, SIRET, un ou plusieurs métiers actifs, présentation et spécialités (20 à 2000 caractères).
3. Adresse professionnelle, code postal, ville, rayon d'intervention de 1 à 100 km et récapitulatif.

Toutes les informations demandées sont enregistrées dans les tables existantes. Elles sont retrouvables/modifiables dans les pages profil. Les mots de passe ont au moins 12 caractères et respectent la limite bcrypt de 72 octets. La confirmation est contrôlée dans le formulaire, les contraintes des valeurs sont aussi vérifiées côté serveur.

## Backend modifié

`register.go` conserve la création transactionnelle et enregistre désormais SIRET, présentation, métiers et rayon. Le nouveau validateur `registration_validation.go` normalise et contrôle les champs. Les routes POST `/api/register/client` et `/api/register/artisan` refusent un rôle différent de celui du parcours. La route historique `/api/register` reste disponible avec les mêmes validations. Les propriétés inconnues et rôles non autorisés sont rejetés.

Aucune migration supplémentaire. Le statut professionnel est toujours `pending` et ne peut pas être envoyé par le formulaire. Le SIRET est contrôlé sur son format (14 chiffres) et son unicité, pas vérifié auprès d'un registre officiel. Aucun profil n'est automatiquement certifié. Le géocodage de l'adresse reste à brancher : la position provisoire existante (0,0) est conservée et doit être corrigée avant publication. Les horaires se renseignent dans Emploi du temps après connexion.

Le dépôt et l'examen des justificatifs d'assurance/certifications ne sont pas implémentés dans ce formulaire ; aucune fausse validation n'est affichée. Aucun paiement, abonnement ou coordonnées bancaires n'est demandé.

La page de connexion présélectionne le bon rôle quand elle est ouverte depuis l'un de ces parcours.

Validation : build/lint frontend, `REGISTRATION_INTEGRATION_TEST=1 ACCOUNT_INTEGRATION_TEST=1 go test ./...`. Les tests couvrent les deux rôles, l'enregistrement des champs, le statut pending, les doublons et l'absence de compte partiel après échec. Les comptes des tests sont supprimés après exécution.
