-- Les rendez-vous déjà acceptés bénéficient aussi de l'accès à la messagerie.
INSERT INTO conversations(client_id, artisan_id)
SELECT DISTINCT client_id, artisan_id FROM calendar_events
WHERE kind = 'diagnostic' AND status = 'confirmed'
ON CONFLICT (client_id, artisan_id) DO NOTHING;
