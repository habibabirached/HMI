#!/bin/bash

git describe --tags --first-parent > dcs-ui/src/TAG

makedirs()
{
    dir=$1
    if [[ ! -e $dir ]]; then
        mkdir $dir
    elif [[ ! -d $dir ]]; then
        echo "$dir already exists but is not a directory" 1>&2
    fi
}

# example on how to call the function above
#makedirs './analytics/mainshaft_drift_estimation/input'

# makedirs './bdc-srv/upload'

#echo using environment options:
#cat .env

# docker pull python:3.10-bullseye   
# docker pull python:3.12-alpine3.17
# docker pull node:20-alpine
# docker pull postgres:15-alpine

docker pull debian:stable
docker pull node:24-alpine

# docker compose --env-file ./.env -f ./docker-compose.yml build 
docker compose -f ./docker-compose-dev.yml build

# Since we are mounting the whole ./bdc-ui we need to have something in node_modules
# cd ./bdc-ui
# npm install
# cd ..


