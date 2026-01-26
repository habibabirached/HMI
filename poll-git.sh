#!/bin/sh

exec >> /var/log/cron.log 2>&1

echo $(date) "Polling git with fetch..."
#echo  "Polling git with fetch..." >> /var/log/cron.log 2>&1
git fetch

UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")

if [ $LOCAL = $REMOTE ]; then
    echo $(date) "Up-to-date"
    #echo "Up-to-date" >> /var/log/cron.log 2>&1
    #git checkout bdc-ui/src/TAG #>> /var/log/cron.log 2>&1

elif [ $LOCAL = $BASE ]; then
    echo $(date) "Need to pull"
    #echo "Need to pull" >> /var/log/cron.log 2>&1
    
    git checkout dcs-ui/src/TAG >> /var/log/cron.log 2>&1
    git pull >> /var/log/cron.log 2>&1
    cd ..

elif [ $REMOTE = $BASE ]; then
    echo $(date) "Need to push"
    #echo "Need to push" >> /var/log/cron.log 2>&1
else
    echo $(date) "Diverged"
    #echo "Diverged" >> /var/log/cron.log 2>&1
fi