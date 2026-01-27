# Data Center Smart Power - CI/CD Setup Guide

A minimal React application with automated CI/CD deployment system.

## Quick Start (Local Development)

### Prerequisites
- Docker
- Docker Compose

### Running the Application

1. Build the Docker image:
```bash
./docker-dev-build.sh
```

2. Run the application:
```bash
./docker-dev-run.sh
```

The application will be available at **http://localhost:3000/**

3. Stop the application:
```bash
./docker-dev-stop.sh
```

---

## CI/CD Auto-Deployment System

### What is CI/CD?

CI/CD stands for **Continuous Integration / Continuous Deployment**. It's an automated system that:
- Watches your git repository for changes
- Automatically pulls new code when you push updates
- Rebuilds and restarts your application with the latest version

**Think of it as a robot that keeps your deployed application up-to-date automatically!**

### How It Works

1. **Polling**: Every 2 minutes, the CI/CD container checks the git repository
2. **Detection**: If it finds new commits, it pulls the latest code
3. **Rebuild**: Automatically rebuilds the Docker container with new code
4. **Restart**: Restarts the application so changes go live

### Setting Up CI/CD on a Remote Server

#### Step 1: Server Prerequisites

Your deployment server needs:
- Docker and Docker Compose installed
- Git configured with SSH access to your repository
- SSH keys set up to access GitHub

#### Step 2: Clone the Repository

```bash
# On your server
cd /path/where/you/want/the/app
git clone git@github.apps.gevernova.net:200021483/DataCenterSmartPower.git
cd DataCenterSmartPower
```

#### Step 3: Set Up SSH Keys

The CI/CD container needs access to your git repository. Make sure:

```bash
# Verify you have SSH keys
ls -la ~/.ssh/

# You should see:
# - id_rsa (private key)
# - id_rsa.pub (public key)

# Test git access
ssh -T git@github.apps.gevernova.net
```

If you don't have keys, create them:
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@ge.com"
# Add the public key to GitHub: https://github.apps.gevernova.net/settings/keys
```

#### Step 4: Configure Environment

Edit the `.env` file if needed for proxy settings:
```bash
nano .env
```

#### Step 5: Start the Application with CI/CD

```bash
./docker-dev-build.sh
./docker-dev-run.sh
```

This starts TWO containers:
1. **dcs-ui**: Your React application (on port 3001)
2. **dcs-cicd**: The CI/CD polling robot

#### Step 6: Verify It's Working

Check the logs to see the CI/CD robot working:

```bash
# View CI/CD logs (you'll see it polling every 2 minutes)
docker logs -f datacentersmartpower-dcs-cicd-1
```

You should see output like:
```
Mon Jan 27 10:00:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:00:02 UTC 2026 Up-to-date
Mon Jan 27 10:02:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:02:02 UTC 2026 Up-to-date
```

### Testing the Auto-Deployment

1. **On your local machine**, make a change to the code:
```bash
# Edit the Hello World message
nano dcs-ui/src/App.js
# Change "Hello World" to "Hello World - Auto Updated!"
```

2. **Commit and push**:
```bash
git add .
git commit -m "Test auto-deployment"
git push
```

3. **On your server**, watch the CI/CD logs:
```bash
docker logs -f datacentersmartpower-dcs-cicd-1
```

Within 2 minutes, you should see:
```
Mon Jan 27 10:04:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:04:02 UTC 2026 Need to pull - updating application...
Mon Jan 27 10:04:15 UTC 2026 Application updated successfully
```

4. **Refresh your browser** at http://your-server:3001/ - you'll see the updated message!

### CI/CD Configuration

The polling frequency is set in `dcs-cicd/command-cron`:
```
*/2 * * * * cd /app && ./command.sh
```

This means "every 2 minutes". You can change it:
- `*/1 * * * *` - every 1 minute (faster updates)
- `*/5 * * * *` - every 5 minutes (less frequent checks)
- `*/10 * * * *` - every 10 minutes (infrequent)

After changing, rebuild the CI/CD container:
```bash
docker compose -f ./docker-compose-dev.yml build dcs-cicd
docker compose -f ./docker-compose-dev.yml up -d dcs-cicd
```

### Troubleshooting

**CI/CD not pulling updates?**
```bash
# Check if git can fetch
docker exec -it datacentersmartpower-dcs-cicd-1 bash
cd /app
git fetch
git status
```

**Permission denied when pulling?**
- Make sure your SSH keys are in `~/.ssh/` and have correct permissions
- The docker-compose mounts `~/.ssh:/root/.ssh` to give the container access

**Port 3001 already in use?**
- Change the port in `docker-compose-dev.yml` line 37: `"3001:3000"` to `"XXXX:3000"`

### Viewing Logs

```bash
# Application logs
docker logs -f datacentersmartpower-dcs-ui-1

# CI/CD logs
docker logs -f datacentersmartpower-dcs-cicd-1

# All logs
docker compose -f ./docker-compose-dev.yml logs -f
```

### Stopping Everything

```bash
./docker-dev-stop.sh
```

---

## Development

The application is a simple React app that displays "Hello World". 

Source code is in `dcs-ui/src/` and is hot-reloaded when changes are made during local development.

### File Structure

```
.
├── docker-dev-build.sh       # Build all containers
├── docker-dev-run.sh         # Start all containers
├── docker-dev-stop.sh        # Stop all containers
├── docker-compose-dev.yml    # Docker compose configuration
├── poll-git.sh              # Git polling script (runs inside CI/CD container)
├── dcs-cicd/                # CI/CD automation container
│   ├── Dockerfile
│   ├── command.sh
│   ├── command-cron         # Cron schedule (every 2 minutes)
│   └── docker-*.sh          # Individual CI/CD container scripts
└── dcs-ui/                  # React application
    ├── Dockerfile
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js           # Main app component
        └── index.js         # React entry point
```

---

## Summary

**For Local Development:**
```bash
./docker-dev-build.sh && ./docker-dev-run.sh
# Visit http://localhost:3001
```

**For Production/Remote Server with Auto-Updates:**
1. Clone repo on server
2. Ensure SSH git access
3. Run `./docker-dev-build.sh && ./docker-dev-run.sh`
4. The app auto-updates every 2 minutes when you push to git!
