#!/bin/bash
# Add/update HalfBlock design in the database from designs/halfblock/halfblock.conf.json
# (runs inside dcs-backend Docker container).
# Use --no-wipe to add/update HalfBlock without removing existing configurations.
# Run this after editing halfblock.conf.json so Docker picks up your changes.
docker compose -f ./docker-compose-dev.yml exec dcs-backend python scripts/replenish_from_design.py halfblock --no-wipe
