FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 produit un binaire statique, sans lien vers la libc :
# indispensable pour tourner dans une image sans système.
# -ldflags="-s -w" retire les symboles de debug (~30% de taille en moins).
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

FROM alpine:3.21

# Certificats racine, nécessaires dès que tu appelleras Stripe ou un SMTP en TLS.
RUN apk add --no-cache ca-certificates

# Un utilisateur non-root : si quelqu'un s'échappe de ton process, il n'est pas root.
RUN adduser -D -u 10001 appuser
USER appuser

COPY --from=builder /app/server /usr/local/bin/server

EXPOSE 2000
ENTRYPOINT ["/usr/local/bin/server"]