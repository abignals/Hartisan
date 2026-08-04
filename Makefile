# ─────────────────────────────────────────────────────────────
#  DOCTO — raccourcis de développement
#  Usage : make <cible>   (make seul affiche l'aide)
# ─────────────────────────────────────────────────────────────

PROJECT := docto
COMPOSE := docker compose -p $(PROJECT)
NETWORK := $(PROJECT)_docto

# Charge .env pour les cibles qui ont besoin des identifiants Postgres.
# Le tiret évite l'erreur au premier lancement, quand le fichier n'existe pas.
-include .env
export

.DEFAULT_GOAL := help
.PHONY: help setup up down restart build rebuild ps logs check smoke \
        sh-backend sh-frontend psql tidy test-back lint-front \
        migrate-create migrate-up migrate-down clean nuke

# ─── Aide ────────────────────────────────────────────────────

help: ## Affiche cette aide
	@echo "DOCTO — cibles disponibles :"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ─── Première installation ───────────────────────────────────

setup: .env nginx/certs/selfsigned.crt ## Prépare .env et les certificats TLS
	@echo "✓ Environnement prêt — lance 'make up'"

# Cible fichier : ne se déclenche que si .env est absent.
# Le sed retire les retours chariot Windows et les espaces de fin,
# que Make conserverait dans les valeurs (psql -U 'puser ' échouerait).
.env:
	@sed -e 's/\r$$//' -e 's/[[:space:]]*$$//' .env.example > .env
	@echo "✓ .env créé depuis .env.example — pense à changer les mots de passe"

nginx/certs/selfsigned.crt:
	@mkdir -p nginx/certs
	@openssl req -x509 -nodes -newkey rsa:2048 \
		-keyout nginx/certs/selfsigned.key \
		-out    nginx/certs/selfsigned.crt \
		-days 365 -subj "/CN=docto" \
		-addext "subjectAltName=DNS:docto,DNS:localhost,IP:127.0.0.1" 2>/dev/null
	@chmod 600 nginx/certs/selfsigned.key
	@echo "✓ Certificat auto-signé généré dans nginx/certs/"

# ─── Cycle de vie ────────────────────────────────────────────

up: setup ## Démarre la stack en arrière-plan (build si nécessaire)
	$(COMPOSE) up -d --build
	@echo "→ https://localhost  (certificat auto-signé : accepte l'avertissement)"

down: ## Arrête la stack, conserve la base
	$(COMPOSE) down

restart: down up ## Redémarre la stack

build: ## Reconstruit les images
	$(COMPOSE) build

rebuild: ## Reconstruit les images en ignorant le cache
	$(COMPOSE) build --no-cache

ps: ## État des conteneurs
	$(COMPOSE) ps

logs: ## Suit les logs — 'make logs s=backend' pour un seul service
	$(COMPOSE) logs -f --tail=100 $(s)

# ─── Vérifications ───────────────────────────────────────────

check: ## Valide docker-compose.yml sans rien lancer
	@$(COMPOSE) config -q && echo "✓ docker-compose.yml valide"

smoke: ## Vérifie que l'API répond
	@docker run --rm --network $(NETWORK) curlimages/curl:latest \
		-fsS http://backend:2000/health && echo "" && echo "✓ backend OK"

# ─── Accès aux conteneurs ────────────────────────────────────

sh-backend: ## Shell dans le conteneur backend
	$(COMPOSE) exec backend sh

sh-frontend: ## Shell dans le conteneur frontend
	$(COMPOSE) exec frontend sh

psql: ## Console PostgreSQL
	$(COMPOSE) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

# ─── Backend Go ──────────────────────────────────────────────
# Go n'est pas installé sur la machine : on passe par l'image officielle.

tidy: ## Nettoie go.mod / go.sum
	docker run --rm -v $(CURDIR)/backend:/src -w /src golang:1.25-alpine go mod tidy

test-back: ## Lance les tests Go
	docker run --rm -v $(CURDIR)/backend:/src -w /src golang:1.25-alpine go test ./...

# ─── Frontend ────────────────────────────────────────────────

lint-front: ## Lint du frontend
	$(COMPOSE) exec frontend npm run lint

# ─── Migrations (golang-migrate) ─────────────────────────────
# 'make migrate-create name=create_bookings' génère la paire up/down.

MIGRATE := docker run --rm -v $(CURDIR)/backend/migrations:/migrations
DB_URL  := postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@db:5432/$(POSTGRES_DB)?sslmode=disable

migrate-create: ## Crée une migration — make migrate-create name=xxx
	@test -n "$(name)" || (echo "Usage : make migrate-create name=create_bookings" && exit 1)
	@mkdir -p backend/migrations
	$(MIGRATE) migrate/migrate -path=/migrations create -ext sql -dir /migrations -seq $(name)

migrate-up: ## Applique les migrations en attente
	$(MIGRATE) --network $(NETWORK) migrate/migrate \
		-path=/migrations -database "$(DB_URL)" up

migrate-down: ## Annule la dernière migration
	$(MIGRATE) --network $(NETWORK) migrate/migrate \
		-path=/migrations -database "$(DB_URL)" down 1

# ─── Nettoyage ───────────────────────────────────────────────

clean: ## Arrête tout et supprime les conteneurs orphelins
	$(COMPOSE) down --remove-orphans

nuke: ## ⚠ Supprime aussi la base de données (irréversible)
	@printf "Cela va DÉTRUIRE le volume db_data. Continuer ? [y/N] " && read ans && [ "$$ans" = "y" ]
	$(COMPOSE) down -v --remove-orphans
	@echo "✓ Volumes supprimés"
