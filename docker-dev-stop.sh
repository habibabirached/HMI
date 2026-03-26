#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/dev-print-host-memory.sh" "docker-dev-stop.sh: before compose down"

docker compose -f "$DIR/docker-compose-dev.yml" down

"$DIR/dev-print-host-memory.sh" "docker-dev-stop.sh: after compose down"

