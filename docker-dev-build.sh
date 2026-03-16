#!/bin/bash

docker pull node:24-alpine

# Build all services. Backend is built with --no-cache so requirements.txt
# changes (e.g. openpyxl) are picked up; remove it for faster rebuilds.
# docker compose -f ./docker-compose-dev.yml build --no-cache dcs-backend
docker compose -f ./docker-compose-dev.yml build
