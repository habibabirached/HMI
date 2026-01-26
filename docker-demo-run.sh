#!/bin/bash

echo using environment options:
cat .env

docker compose --env-file ./.env -f ./docker-compose-demo.yml up -d 

host=$(hostname -f)
echo
echo Services: 
echo DB port: 5436
echo Server Swagger UI: http://$host:8090/apidocs/#/
echo Jenkins: http://$host:9095
echo UI: http://$host:3000/
echo
echo For localhost access replace $host with "localhost" or 127.0.0.1
echo
