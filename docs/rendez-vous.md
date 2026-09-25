# Prise de rendez-vous et planning — MVP local

Le client ouvre un vrai profil depuis la recherche puis « Demander un diagnostic ». Le parcours comprend le créneau disponible, le motif et la description, l'adresse, le contact sur place (éventuellement un proche), puis une vérification avant envoi. Le suivi est dans `/rdv` ; l'artisan traite ses demandes dans `/pro/planning`.

## Règles

- Premier rendez-vous de diagnostic uniquement : 60 minutes sur place et 30 minutes de trajet par défaut, réglables par l'artisan. Aucune promesse de réparation ni de prix ; aucun paiement en ligne.
- Départs proposés toutes les 30 minutes dans les horaires hebdomadaires, pause et trajet compris. Préavis minimum de 24 heures et réservation jusqu'à 90 jours à l'avance. Affichage Europe/Paris, dates des événements stockées en UTC.
- Une demande bloque le créneau immédiatement et expire après 24 heures sans acceptation. L'artisan accepte ou refuse ; l'annulation libère le créneau. Le client peut annuler avant le début du rendez-vous.
- Les horaires et durées modifiés ne changent pas les événements déjà réservés.
- Les interventions prises hors plateforme et les absences ont un début et une fin libres, jusqu'à plusieurs jours (maximum 90 jours). Pour l'instant, pas de proposition de chantier long à faire accepter au client.
- Les comptes réels n'ont aucun créneau public tant que leurs horaires ne sont pas renseignés.
- Aucun SMS/email automatique, contrôle de téléphone ou justificatif d'adresse : la déclaration d'accord pour un proche n'est pas une protection antifraude suffisante. Le suivi actuel se fait sur le site, actualisé toutes les 30 secondes.

## Backend modifié

Migration `000007_create_appointments` : `calendar_settings`, `availability_windows`, `calendar_events` et contraintes PostgreSQL empêchant le chevauchement des événements actifs, trajet compris. Les écritures d'un planning sont sérialisées par transaction ; le serveur recalcule la disponibilité avant de réserver. L'expiration est vérifiée à chaque écriture et traitée en tâche de fond toutes les minutes. Les lectures considèrent immédiatement les demandes échues comme expirées.

Routes :

| Route | Accès |
| --- | --- |
| GET `/api/artisans/{id}/slots?from=YYYY-MM-DD&until=YYYY-MM-DD` | Public, uniquement artisan approuvé et non suspendu, aucun détail privé |
| GET/PUT `/api/calendar/settings` | Artisan, ses propres horaires |
| POST `/api/calendar/blocks` | Artisan, son propre planning |
| GET `/api/appointments?from=YYYY-MM-DD&until=YYYY-MM-DD` | Client ou artisan, uniquement ses événements |
| POST `/api/appointments` | Client |
| POST `/api/appointments/{id}/action` | Participants autorisés, actions accept/reject/cancel selon rôle et état |

`until` est exclusive. La durée de diagnostic vient de `calendar_settings.diagnostic_minutes` ; l'ancien champ `artisan_profiles.default_slot_minutes` n'est pas utilisé par ce parcours.

## Essais locaux

Les six artisans réservés aux essais de recherche ont des horaires lundi–vendredi, 8–12 h et 13–18 h. Le client fictif est `test-rdv-client@example.invalid`. Un artisan utilisable : `test-recherche-plombier-paris@example.invalid`. Les mots de passe sont fournis dans la conversation, pas versionnés ici.

Après migration, l'outil explicite `ALLOW_BOOKING_TEST_ACCOUNTS=1 go run ./cmd/seed-booking` crée le client si absent et initialise les horaires des seuls comptes de recherche réservés aux tests. Il ne remplace ni les mots de passe ni les réglages existants. Ne pas l'activer en production.

Tests : `go test ./...` et, sur une base locale migrée, `BOOKING_INTEGRATION_TEST=1 go test ./...`. Les tests d'intégration créent puis suppriment leurs propres comptes. Ils couvrent concurrence, droits d'accès, confidentialité, marge de trajet, changements d'heure, acceptation/refus/annulation, expiration, périodes sur plusieurs jours et conservation de la durée réservée.

Un essai HTTP via localhost a également vérifié connexion, réservation, acceptation et suivi, puis annulé son rendez-vous avec le motif « Fin du test automatique local ». Cette ligne reste dans l'historique du compte fictif ; son créneau est libre.

## Détails en pleine page et conversation

Les rendez-vous s'ouvrent désormais sur `/rdv/{id}`, une vraie page accessible depuis le planning ou la liste client. Les confirmations d'acceptation/refus/annulation s'affichent dans cette page sans fenêtre modale.

L'envoi de la demande crée automatiquement (ou retrouve) la conversation client/artisan dans la même transaction, avant l'acceptation. Un bouton ouvre directement la messagerie existante, pour chacun des participants. Une conversation est partagée pour tous les rendez-vous du même duo et reste disponible après annulation pour poursuivre le suivi. La messagerie existante conserve ses autres accès ; ce changement n'interdit pas les échanges déjà possibles avant réservation.

Backend : GET `/api/appointments/{id}` réservé aux participants, champ `conversation_id` dans les réponses, création atomique dès la demande. Migration 8 initialise les conversations des diagnostics déjà confirmés sans supprimer de données. Les tests couvrent aussi la lecture des détails et l'échange de messages, avec refus des accès d'un tiers.


## Photos et signalements

Le formulaire de réservation propose jusqu'à cinq photos facultatives. Après enregistrement de la demande, elles sont envoyées dans la conversation partagée avec l'artisan. En cas d'échec, la demande reste enregistrée ; l'interface indique quelles photos restent à envoyer et permet de réessayer sans recréer le rendez-vous. Des photos peuvent aussi être envoyées seules ou avec du texte depuis Messages.

Photos JPEG/PNG : 8 Mo et 20 mégapixels maximum par fichier. Le serveur décode et réencode les images en JPEG (métadonnées d'origine supprimées). Fichiers privés sous `DOCUMENTS_DIR/message-photos`, noms aléatoires, lecture authentifiée réservée aux participants. PostgreSQL contient les références, pas les fichiers. Les photos s'ouvrent en grand dans un onglet.

L'artisan dispose de « Signaler ce message » sur les messages et photos reçus. Motif obligatoire, formulaire intégré sans popup, signalement enregistré une seule fois par message et déclarant. Aucun blocage automatique, aucune notification et aucune interface de modération ne sont encore implémentés ; le traitement des signalements reste à construire.

Migration 9 : tables `message_photos`, `message_reports`, conversations pour les demandes existantes. Routes ajoutées : POST `/api/conversations/{id}/photos`, GET `/api/messages/{id}/photo`, POST `/api/messages/{id}/report` (artisan). La messagerie restitue `photo_url` et `reported`. Les tests vérifient aussi les faux fichiers images, l'accès d'un tiers et les signalements répétés.
