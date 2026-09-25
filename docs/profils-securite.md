# Profils et sécurité du compte

Les profils client et artisan partagent un panneau de modification des informations personnelles : prénom, nom, adresse personnelle, email, téléphone et mot de passe. L'email est l'identifiant de connexion ; aucun identifiant supplémentaire n'a été ajouté. L'adresse personnelle est distincte de l'adresse professionnelle et des adresses des rendez-vous.

Les changements d'email, de téléphone et de mot de passe demandent le mot de passe actuel, vérifié côté serveur. Le formulaire demande aussi de répéter la nouvelle valeur. Après cinq erreurs, la vérification est bloquée pendant quinze minutes (compteur en base, par compte). Après réussite, toutes les sessions sont révoquées et l'utilisateur doit se reconnecter. Le nouveau mot de passe doit avoir au moins 12 caractères et tenir dans la limite bcrypt de 72 octets. Les doublons d'email/téléphone sont refusés par les contraintes de la base. Un changement d'email efface l'éventuel statut email_verified_at.

Cette vérification prouve la connaissance du mot de passe actuel, pas la possession du nouveau téléphone ou email. Aucun envoi de code, fournisseur email/SMS, ni double authentification n'est branché. L'interface n'en promet plus. Les réglages de langue et de pays restent fixes : les faux boutons Modifier ont été retirés. La suppression de compte et le dépôt des justificatifs professionnels restent hors de cette modification.

Les rubriques de paiement/facturation et les moyens de paiement des profils publics fictifs ont été retirés. Les tarifs des artisans restent affichés.

## Backend

- Migration 10 : `users.address_line`, `account_verification_limits`.
- GET et PUT `/api/account`, réservés à l'utilisateur authentifié. PUT accepte une propriété autorisée à la fois, jamais un identifiant utilisateur cible.
- Transaction verrouillant le compte et revérifiant la validité de la session avant écriture.
- Connexion existante ajustée : verrou partagé pendant la vérification du mot de passe et la création de session, pour empêcher qu'une connexion utilisant l'ancien mot de passe aboutisse après son remplacement. Les comptes suspendus ne peuvent plus créer de session.

Validation : build/lint frontend ; `ACCOUNT_INTEGRATION_TEST=1 BOOKING_INTEGRATION_TEST=1 go test ./...` sur la base locale migrée. Les tests créent et suppriment leurs comptes et vérifient les deux rôles, mauvais mot de passe, verrouillage, révocation, nouveau mot de passe, nouveau téléphone et refus des propriétés interdites.

## Messagerie

Le contour de focus du champ de saisie est supprimé. Les boutons + et Envoyer ont le même fond crème, indépendamment du contenu saisi. Aucun changement backend pour ce réglage visuel.
