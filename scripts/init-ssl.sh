#!/bin/bash
set -e

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: DOMAIN=example.com EMAIL=you@example.com ./init-ssl.sh"
  exit 1
fi

CERT_DIR="/opt/splitbill/data/certbot/conf/live/$DOMAIN"

echo "=== Creating dummy cert so nginx can start ==="
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=localhost" 2>/dev/null

echo "=== Starting nginx ==="
cd /opt/splitbill
docker compose -f docker-compose.prod.yml up -d nginx

echo "=== Obtaining Let's Encrypt certificate for $DOMAIN ==="
docker run --rm \
  -v /opt/splitbill/data/certbot/conf:/etc/letsencrypt \
  -v /opt/splitbill/data/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "=== Reloading nginx with real certificate ==="
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "=== Starting remaining services ==="
docker compose -f docker-compose.prod.yml up -d

echo "=== SSL initialized. App running at https://$DOMAIN ==="
