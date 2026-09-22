#!/usr/bin/env bash
# Run ON the Oracle VM (Ubuntu 22.04), after copying .env next to this script:
#   scp .env nick/worker-setup.sh ubuntu@<vm-ip>:~
#   ssh ubuntu@<vm-ip> 'bash worker-setup.sh'
# Installs Node 22 + pm2, checks out the same commit as the web app, and keeps
# the DM worker running across crashes and reboots.
set -euo pipefail
COMMIT=5760181c4bb9683241357cbbcd8ca635d19f835a

# 1 GB RAM box: npm install gets OOM-killed without swap.
if ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -; sudo apt-get install -y nodejs git; }
command -v pm2 >/dev/null || sudo npm install -g pm2

[ -d openreply ] || git clone https://github.com/diwenne/openreply
cd openreply && git fetch -q && git checkout -q "$COMMIT"
cp ~/.env .env && chmod 600 .env
npm ci --no-audit --no-fund
npm run db:generate

pm2 delete openreply-worker >/dev/null 2>&1 || true
# The worker does not load .env itself (hosts normally inject env vars), so hand it over here.
pm2 start node --name openreply-worker -- --env-file=.env --import tsx worker/dm-worker.ts
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1
pm2 status
