#!/bin/bash

docker pull node:24-alpine

docker compose -f ./docker-compose-dev.yml build
