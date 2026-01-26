# CI/CD Quick Reference Guide

## 🚀 Quick Start

### Local Development (No CI/CD)
```bash
./docker-dev-build.sh
./docker-dev-run.sh
# Visit http://localhost:3001
./docker-dev-stop.sh
```

### Production with Auto-Deploy
```bash
# On your server:
git clone git@github.apps.gevernova.net:200021483/DataCenterSmartPower.git
cd DataCenterSmartPower
./docker-dev-build.sh
./docker-dev-run.sh
# App auto-updates every 2 minutes when you push to git!
```

---

## 📊 What's Running?

When you run `./docker-dev-run.sh`, you get TWO containers:

| Container | Purpose | Port | Logs Command |
|-----------|---------|------|--------------|
| **dcs-ui** | Your React app | 3001 | `docker logs -f datacentersmartpower-dcs-ui-1` |
| **dcs-cicd** | Auto-deployment robot | - | `docker logs -f datacentersmartpower-dcs-cicd-1` |

---

## 🤖 How Auto-Deploy Works

```
┌─────────────────────────────────────────────────────────────┐
│  YOU (Developer)                                            │
│  ├── Edit code locally                                      │
│  ├── git add . && git commit -m "message"                  │
│  └── git push                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  GITHUB REPOSITORY                                          │
│  (New commit stored)                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVER (CI/CD Container)                                   │
│  ├── Every 2 minutes: Check for new commits                │
│  ├── If found: git pull                                     │
│  ├── Rebuild: docker compose build dcs-ui                  │
│  └── Restart: docker compose up -d dcs-ui                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  YOUR APP IS UPDATED! 🎉                                    │
│  Visit http://your-server:3001                             │
└─────────────────────────────────────────────────────────────┘
```

**Timeline:** Push code → Wait max 2 minutes → App automatically updates!

---

## 🔧 Common Tasks

### View CI/CD Activity
```bash
docker logs -f datacentersmartpower-dcs-cicd-1
```

Expected output:
```
Mon Jan 27 10:00:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:00:02 UTC 2026 Up-to-date
Mon Jan 27 10:02:01 UTC 2026 Polling git with fetch...
Mon Jan 27 10:02:02 UTC 2026 Need to pull - updating application...
Mon Jan 27 10:02:15 UTC 2026 Application updated successfully
```

### Change Polling Frequency

Edit `dcs-cicd/command-cron`:
```bash
# Current: Every 2 minutes
*/2 * * * * cd /app && ./command.sh

# Options:
*/1 * * * *   # Every 1 minute (fast)
*/5 * * * *   # Every 5 minutes (moderate)
*/10 * * * *  # Every 10 minutes (slow)
```

Rebuild after changing:
```bash
docker compose -f ./docker-compose-dev.yml build dcs-cicd
docker compose -f ./docker-compose-dev.yml up -d dcs-cicd
```

### Test Auto-Deploy

1. **Make a change:**
   ```bash
   echo 'function App() { return <div><h1>Updated!</h1></div>; } export default App;' > dcs-ui/src/App.js
   ```

2. **Push it:**
   ```bash
   git add .
   git commit -m "Test update"
   git push
   ```

3. **Watch it deploy:**
   ```bash
   docker logs -f datacentersmartpower-dcs-cicd-1
   ```

4. **See it live** (within 2 minutes):
   ```
   http://localhost:3001
   ```

### Restart Everything
```bash
./docker-dev-stop.sh
./docker-dev-run.sh
```

### Check What's Running
```bash
docker ps
```

---

## 🐛 Troubleshooting

### Problem: CI/CD not pulling updates

**Check git access:**
```bash
docker exec -it datacentersmartpower-dcs-cicd-1 bash
cd /app
git fetch
git status
exit
```

**Check SSH keys:**
```bash
ls -la ~/.ssh/
# Should see id_rsa and id_rsa.pub
```

**Test git connection:**
```bash
ssh -T git@github.apps.gevernova.net
```

### Problem: Port 3001 already in use

Change port in `docker-compose-dev.yml`:
```yaml
ports:
  - "8080:3000"  # Change 3001 to any available port
```

### Problem: Container won't start

**View errors:**
```bash
docker compose -f ./docker-compose-dev.yml logs
```

**Rebuild clean:**
```bash
./docker-dev-stop.sh
docker compose -f ./docker-compose-dev.yml build --no-cache
./docker-dev-run.sh
```

---

## 📁 Project Structure

```
DataCenterSmartPower/
├── docker-dev-build.sh      ← Build everything
├── docker-dev-run.sh        ← Start everything  
├── docker-dev-stop.sh       ← Stop everything
├── docker-compose-dev.yml   ← Configuration (port, services)
├── poll-git.sh             ← Auto-deploy logic
│
├── dcs-cicd/               ← CI/CD Robot
│   ├── Dockerfile
│   ├── command-cron        ← Polling frequency (every 2 min)
│   └── README.md
│
└── dcs-ui/                 ← Your React App
    ├── Dockerfile
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js          ← Edit this!
        └── index.js
```

---

## ✅ Checklist for Server Deployment

- [ ] Server has Docker installed
- [ ] Server has Docker Compose installed  
- [ ] SSH keys are set up (`~/.ssh/id_rsa`)
- [ ] SSH key is added to GitHub
- [ ] Can clone repo: `git clone git@github.apps.gevernova.net:200021483/DataCenterSmartPower.git`
- [ ] Run: `./docker-dev-build.sh`
- [ ] Run: `./docker-dev-run.sh`
- [ ] Verify app loads: `http://server-ip:3001`
- [ ] Verify CI/CD is polling: `docker logs datacentersmartpower-dcs-cicd-1`
- [ ] Test auto-deploy by pushing a change

---

## 💡 Tips

- **Local dev:** CI/CD will still run but just polls your local repo
- **Multiple servers:** Clone to multiple servers - they all auto-update!
- **Rollback:** Just `git revert` and push - auto-deploys the rollback
- **Monitor:** Keep CI/CD logs open during first deployment to watch it work
- **Security:** The CI/CD container has access to Docker and your SSH keys - keep server secure!

---

## 📞 Need Help?

1. Check the main README.md for detailed documentation
2. Check dcs-cicd/README.md for CI/CD specifics
3. View logs: `docker logs -f datacentersmartpower-dcs-cicd-1`
4. Check GitHub repo: https://github.apps.gevernova.net/200021483/DataCenterSmartPower
