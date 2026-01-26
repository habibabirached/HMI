#!/bin/sh
# this should be executed in the root of this project when the . is mounted over /app of the container
exec >> /var/log/cron.log 2>&1

echo "Hello World"