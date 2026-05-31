#!/bin/bash
set -e

echo "=== Installing Docker ==="
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== Creating deploy directory ==="
mkdir -p /opt/splitbill/data/certbot/conf
mkdir -p /opt/splitbill/data/certbot/www
mkdir -p /opt/splitbill/nginx

echo "=== Adding certbot renewal cron ==="
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/splitbill && docker run --rm \
  -v /opt/splitbill/data/certbot/conf:/etc/letsencrypt \
  -v /opt/splitbill/data/certbot/www:/var/www/certbot \
  certbot/certbot renew --quiet && \
  docker compose -f /opt/splitbill/docker-compose.prod.yml exec nginx nginx -s reload") | crontab -

echo "=== Done. Next: copy files to /opt/splitbill and run init-ssl.sh ==="
