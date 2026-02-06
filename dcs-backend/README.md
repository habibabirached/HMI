# ============================================================================
# DATA CENTER POWER SYSTEM - BACKEND
# ============================================================================
# Python backend for managing power system configuration storage
#
# This backend provides REST API endpoints for:
# - Saving configurations to database + disk + download
# - Loading saved configurations
# - Listing available configurations
# - Deleting configurations
#
# Built with FastAPI, SQLAlchemy, and SQLite
# ============================================================================

## Quick Start

### Prerequisites
- Python 3.11 or higher
- pip (Python package manager)
- Docker (optional, for containerized deployment)

### Local Development (Without Docker)

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

3. **Run the server:**
   ```bash
   python app.py
   ```
   
   Or with uvicorn directly:
   ```bash
   uvicorn app:app --reload --host 0.0.0.0 --port 5000
   ```

4. **Test it:**
   - Visit: http://localhost:5000/health
   - Should see: `{"status": "ok", "timestamp": "..."}`
   - Visit: http://localhost:5000/docs (auto-generated API documentation!)

### Docker Development

Run with the full stack (UI + Backend):
```bash
# From project root:
./docker-dev-build.sh
./docker-dev-run.sh
```

Backend will be available at: http://localhost:5000

---

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### Root
```
GET /
```
Returns API information and available endpoints.

### (More endpoints coming in Step 4)
- POST /api/save - Save configuration
- GET /api/load/:id - Load configuration by ID
- GET /api/configs - List all configurations
- DELETE /api/config/:id - Delete configuration

---

## Directory Structure

```
dcs-backend/
├── app.py                  # Main application file
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container build recipe
├── .env.example           # Environment variables template
├── .env                   # Your actual config (not committed)
├── datacenter.db          # SQLite database (created on first run)
└── saved_configs/         # Saved configuration JSON files
    ├── config-1.json
    ├── config-2.json
    └── ...
```

---

## Technology Choices

### Why FastAPI?
- Modern Python 3.7+ features (async/await)
- Auto-generates interactive API docs at /docs
- Fast performance (comparable to Node.js)
- Built-in data validation with Pydantic
- Easy to learn and use

### Why SQLite?
- Simple file-based database (no server needed)
- Perfect for single-deployment scenarios
- Easy to backup (just copy the .db file)
- Can upgrade to PostgreSQL later if needed

### Why Save to 3 Places?
1. **Database:** Fast queries, list configurations, metadata
2. **Disk:** Backend admin can access files directly
3. **Download:** User gets local copy for backup/sharing

---

## Development Workflow

1. Make changes to `app.py`
2. Server auto-reloads (if using `--reload` flag)
3. Test endpoint in browser or with curl
4. Check logs in terminal

---

## Logging

The backend logs all requests and operations:
```
INFO:     Started server process [1234]
INFO:     Waiting for application startup.
🚀 Data Center Power System Backend Starting...
✅ Health check available at: http://localhost:5000/health
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:5000
```

---

**Status:** Step 1 complete - Basic structure and health check endpoint
