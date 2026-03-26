#!/bin/bash
#
# Clean rebuild: all compose services, Docker layer cache ignored.
# Slower but deterministic after Dockerfile, package.json, or proxy changes.
# Next: ./docker-dev-run.sh   (this script does not start containers)
#

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/dev-print-host-memory.sh" "docker-dev-rebuild.sh: start"

docker pull node:24-alpine
"$DIR/dev-print-host-memory.sh" "docker-dev-rebuild.sh: after docker pull node:24-alpine"

if [[ -f "$DIR/.env" ]]; then
  docker compose --env-file "$DIR/.env" -f "$DIR/docker-compose-dev.yml" build --no-cache
else
  docker compose -f "$DIR/docker-compose-dev.yml" build --no-cache
fi

"$DIR/dev-print-host-memory.sh" "docker-dev-rebuild.sh: after compose build --no-cache (done)"
