# Accès client et page de présentation artisan

## Parcours client

Le menu visiteur affiche un seul bouton « Se connecter ». `/connexion` présente directement email et mot de passe, avec « Vous inscrire » vers `/inscription`, qui affiche le formulaire client simple. Le choix initial Client/Artisan n'est plus affiché. `/inscription/client` reste un alias.

## Parcours artisan

« Vous êtes artisan ? » ouvre `/pro`. Cette page présente la visibilité, le profil, le planning et les échanges avec les particuliers, puis propose une demande de contact avec un conseiller. La mise en page s'inspire des pages professionnelles et de contact de Doctolib : https://info.doctolib.fr/nous-contacter-doctolib/ .

Les grands chiffres décrivent des fonctionnalités (demandes en ligne 24 h/24, une fiche, trois outils), pas une audience ou des gains commerciaux inventés. Aucun nombre de clients, résultat financier ou faux témoignage n'est affiché.

Le lien « Déjà partenaire ? Se connecter » ouvre `/connexion?role=artisan`. Les retours de session expirée des pages professionnelles gardent ce rôle. Le formulaire professionnel existant reste accessible à `/inscription/artisan`, mais n'est plus l'entrée du parcours public artisan.

## Formulaire conseiller et backend

POST `/api/pro/contact`, public. Champs : prénom, nom, entreprise facultative, métier, code postal, email, téléphone, préférence matin/après-midi et message facultatif. Accord de contact obligatoire. Le formulaire ne crée pas de compte ni d'inscription marketing.

Migration 11 : table `artisan_contact_requests`, statut initial `new`, date d'enregistrement et accord. Les données ne sont pas exposées par une route publique de consultation. Champs validés côté serveur, champ piège pour robots, limite de trois demandes par email par heure sérialisée en base. Cette protection basique n'empêche pas le spam distribué avec plusieurs emails.

Les demandes sont enregistrées dans la base locale. Aucun email/SMS n'est envoyé à un conseiller et aucun outil de traitement n'est encore branché. Pour les traiter, l'équipe devra lire les demandes en base ou connecter une interface interne / des notifications. Le succès du formulaire confirme seulement l'enregistrement, sans promettre un délai de rappel.

Exemple de lecture réservé à l'équipe ayant accès à la base :

```sql
SELECT id, created_at, first_name, last_name, company_name, trade,
       postal_code, email, phone, availability, message
FROM artisan_contact_requests
WHERE status = 'new'
ORDER BY created_at;
```

Validation : build/lint frontend et `CONTACT_INTEGRATION_TEST=1 REGISTRATION_INTEGRATION_TEST=1 go test ./...`. Les tests nettoient leurs demandes et comptes temporaires.
