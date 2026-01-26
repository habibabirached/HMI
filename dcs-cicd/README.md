# dcs-cicd
This component executes the command.sh script periodically (every 3 min), according to the command-cron config.
Overriding these files and mounting volumes we can create a periodic pull git build & deploy implementation.
All we have to do is mount the local code folder over the /app folder of the container and the poll-git.sh on top of command.sh script.

check the docker-compose.yml so see how it is used.

../poll-git.sh does a git pull. It triggers the update of the docker services similar to what happens in the localhost dev mode. Note that Changes in package.json or requirements.txt require build, stop, start of the services. This script does not do that. So changes of this magnitude require manual intervention.