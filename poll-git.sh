#!/bin/sh

exec >> /var/log/cron.log 2>&1

echo $(date) "Polling git with fetch..."
git fetch

UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")

if [ $LOCAL = $REMOTE ]; then
    echo $(date) "Up-to-date"
elif [ $LOCAL = $BASE ]; then
    echo $(date) "Need to pull - updating application..."
    
    git pull >> /var/log/cron.log 2>&1
    
    # Rebuild and restart the application
    docker compose -f /app/docker-compose-dev.yml build dcs-ui
    docker compose -f /app/docker-compose-dev.yml up -d dcs-ui
    
    echo $(date) "Application updated successfully"
elif [ $REMOTE = $BASE ]; then
    echo $(date) "Need to push"
else
    echo $(date) "Diverged"
fi
