#!/bin/sh

################################################################################
# AUTOMATED CI/CD DEPLOYMENT SCRIPT
################################################################################
#
# PURPOSE: This script is the heart of the CI/CD (Continuous Integration/
#          Continuous Deployment) system. It automatically checks for new code
#          in the git repository and deploys it without human intervention.
#
# HOW IT WORKS:
#   1. Runs inside the dcs-cicd Docker container
#   2. Executed by cron every 2 minutes (configured in dcs-cicd/command-cron)
#   3. Checks if there are new commits in the remote git repository
#   4. If new code found: pulls it, rebuilds the app, and restarts it
#   5. Logs everything so you can watch it work
#
# USAGE: This script is NOT run manually. It's run automatically by cron.
#        To watch it work: docker logs -f datacentersmartpower-dcs-cicd-1
#
# MOUNTED AS: /app/command.sh inside the CI/CD container
#             (see docker-compose-dev.yml volumes section)
#
################################################################################

# REDIRECT OUTPUT TO LOG FILE
# exec >> /var/log/cron.log 2>&1
# This sends all output (stdout and stderr) to the cron log file so we can
# see what the script is doing. Without this, the output would disappear.
exec >> /var/log/cron.log 2>&1

# STEP 1: FETCH LATEST COMMITS FROM REMOTE REPOSITORY
# This doesn't change any local files, just downloads the commit information
# from GitHub to see if there are any new commits we don't have yet.
echo $(date) "Polling git with fetch..."
git fetch

# STEP 2: GET GIT COMMIT IDENTIFIERS (SHA HASHES)
# We need to compare 3 things to determine the state of our repository:
#   - LOCAL: What commit are we currently on?
#   - REMOTE: What's the latest commit on GitHub?
#   - BASE: What was the last commit we both shared?

# UPSTREAM: The remote branch to track (default: the upstream branch we're tracking)
# ${1:-'@{u}'} means: use first argument if provided, otherwise use '@{u}' (upstream)
UPSTREAM=${1:-'@{u}'}

# LOCAL: Get the SHA hash of our current local commit (HEAD)
# Example: "a1b2c3d4e5f6..." (40 character hash identifying exact code version)
LOCAL=$(git rev-parse @)

# REMOTE: Get the SHA hash of the latest commit on the remote branch (GitHub)
# This tells us what commit GitHub currently has
REMOTE=$(git rev-parse "$UPSTREAM")

# BASE: Find the common ancestor commit (where local and remote branched from)
# This helps us understand the relationship between local and remote
BASE=$(git merge-base @ "$UPSTREAM")

# STEP 3: COMPARE COMMITS AND TAKE ACTION
# By comparing these three hashes, we can determine what to do:

# CASE 1: LOCAL equals REMOTE
# This means we're already up-to-date - we have the same code as GitHub
if [ $LOCAL = $REMOTE ]; then
    echo $(date) "Up-to-date"
    # Nothing to do, just log that everything is current

# CASE 2: LOCAL equals BASE (but not REMOTE)
# This means:
#   - GitHub has new commits we don't have
#   - We haven't made any local commits
#   - It's SAFE to pull and update
# This is the MAIN CI/CD ACTION - auto-deploy new code!
elif [ $LOCAL = $BASE ]; then
    echo $(date) "Need to pull - updating application..."
    
    # PULL: Download and merge the new code from GitHub
    # >> /var/log/cron.log 2>&1 appends git's output to our log file
    git pull >> /var/log/cron.log 2>&1
    
    # REBUILD: Build a new Docker image with the updated code
    # This compiles/packages the new code into a fresh container image
    docker compose -f /app/docker-compose-dev.yml build dcs-ui
    
    # RESTART: Start the new container (replaces the old one)
    # -d flag means "detached" (run in background)
    # Docker will stop the old container and start the new one with updated code
    docker compose -f /app/docker-compose-dev.yml up -d dcs-ui
    
    echo $(date) "Application updated successfully"
    # At this point, your new code is LIVE! Users see the updated version.

# CASE 3: REMOTE equals BASE (but not LOCAL)
# This means:
#   - We have local commits that aren't on GitHub
#   - We need to push our changes (but this is unexpected on a server)
#   - CI/CD servers shouldn't make local commits, so we just log it
elif [ $REMOTE = $BASE ]; then
    echo $(date) "Need to push"
    # Just log it - we don't auto-push because that could overwrite others' work

# CASE 4: None of the above
# This means the histories have "diverged" - both local and remote have different commits
# This is a problem that needs human intervention to resolve
else
    echo $(date) "Diverged"
    # Log the issue - someone needs to manually resolve this conflict
fi

################################################################################
# SUMMARY OF WHAT THIS DOES:
#
# Every 2 minutes this script asks:
#   "Is there new code on GitHub that I don't have?"
#
# If YES:
#   1. Pull the new code
#   2. Rebuild the Docker container with the new code
#   3. Restart the application
#   4. New code is now LIVE!
#
# If NO:
#   Just log "Up-to-date" and do nothing
#
# This is how you get automatic deployments!
# Push code from your laptop → Wait 2 minutes → It's live on the server!
################################################################################
