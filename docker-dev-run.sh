#!/bin/bash

echo using environment options:
cat .env

docker compose --env-file ./.env -f ./docker-compose-dev.yml up -d 

host=$(hostname -f)
echo
echo UI: http://$host:3001/
echo
echo For localhost access replace $host with "localhost" or 127.0.0.1
echo
