#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/dev-print-host-memory.sh" "docker-dev-run.sh: before compose up"

echo using environment options:
cat "$DIR/.env"

docker compose --env-file "$DIR/.env" -f "$DIR/docker-compose-dev.yml" up -d

"$DIR/dev-print-host-memory.sh" "docker-dev-run.sh: after compose up -d"

host=$(hostname -f)
echo
echo UI: http://$host:3000/
echo
echo For localhost access replace $host with "localhost" or 127.0.0.1
echo
