#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$DIR/docker-compose-dev.yml"
"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: start"

docker pull node:24-alpine
"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: after docker pull node:24-alpine"

# Backend: --no-cache so requirements.txt / NumPy upgrades are never masked by
# a cached RUN pip install layer. UI: normal cache for speed.
docker compose -f "$COMPOSE_FILE" build --no-cache dcs-backend
docker compose -f "$COMPOSE_FILE" build dcs-ui

"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: after docker compose build (done)"

# Recreate containers so running services use the images you just built (build alone
# does not replace old containers — e.g. backend would keep NumPy 1.x until recreate).
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: after docker compose up (done)"
