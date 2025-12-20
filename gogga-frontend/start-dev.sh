#!/bin/bash
export HOME=/home/ubuntu
export PATH="/home/ubuntu/.local/share/pnpm:/home/ubuntu/.nvm/versions/node/v20.19.5/bin:$PATH"
cd /home/ubuntu/Dev-Projects/Gogga/gogga-frontend
exec /home/ubuntu/.local/share/pnpm/pnpm dev
