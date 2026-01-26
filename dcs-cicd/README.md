# CI/CD Container

This container provides automated continuous deployment by polling the git repository and redeploying when changes are detected.

## How It Works

1. **Cron Job**: Runs every 2 minutes (configurable in `command-cron`)
2. **Polling Script**: Executes `command.sh` which is replaced by `poll-git.sh` from the parent directory
3. **Git Check**: Compares local and remote git commits
4. **Auto-Deploy**: If changes detected, pulls code and rebuilds/restarts the application

## Files

- `Dockerfile` - Builds a Debian-based container with git and cron
- `command.sh` - Default command (overridden by mounting `poll-git.sh`)
- `command-cron` - Cron schedule configuration (*/2 = every 2 minutes)
- `docker-build.sh` - Builds this container standalone
- `docker-run.sh` - Runs this container standalone
- `docker-stop.sh` - Stops this container

## Usage

This container is typically run via docker-compose (not standalone):

```bash
# From project root
./docker-dev-build.sh  # Builds both UI and CI/CD containers
./docker-dev-run.sh    # Starts both containers
```

## Logs

View the CI/CD activity:
```bash
docker logs -f datacentersmartpower-dcs-cicd-1
```

You'll see output like:
```
Mon Jan 27 10:00:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:00:02 UTC 2026 Up-to-date
Mon Jan 27 10:02:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:02:02 UTC 2026 Need to pull - updating application...
```

## Configuration

### Change Polling Frequency

Edit `command-cron`:
```
# Every 1 minute
*/1 * * * * cd /app && ./command.sh

# Every 5 minutes  
*/5 * * * * cd /app && ./command.sh

# Every 10 minutes
*/10 * * * * cd /app && ./command.sh
```

After changing, rebuild:
```bash
docker compose -f ./docker-compose-dev.yml build dcs-cicd
docker compose -f ./docker-compose-dev.yml up -d dcs-cicd
```

### Customize Deployment Actions

Edit `../poll-git.sh` to change what happens when new code is detected.

Current actions:
1. `git pull` - Pull latest code
2. Rebuild the UI container
3. Restart the UI container

## Requirements

- The container needs access to:
  - Git repository (via SSH keys mounted at ~/.ssh)
  - Docker socket (to control other containers)
  - Project directory (mounted at /app)

These are configured in the docker-compose-dev.yml volumes section.
