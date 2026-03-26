#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: start"

docker pull node:24-alpine
"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: after docker pull node:24-alpine"

# Build all services. Backend is built with --no-cache so requirements.txt
# changes (e.g. openpyxl) are picked up; remove it for faster rebuilds.
# docker compose -f ./docker-compose-dev.yml build --no-cache dcs-backend
docker compose -f "$DIR/docker-compose-dev.yml" build

"$DIR/dev-print-host-memory.sh" "docker-dev-build.sh: after docker compose build (done)"
