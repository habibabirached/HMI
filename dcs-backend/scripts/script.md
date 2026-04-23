# Running `transferCSVtoDatabase.py`

## What it does

The script `transferCSVtoDatabase.py` walks every top-level folder under the backend `designs` directory, skips `archive`, and for each `*.data.csv` file stores the full data in the application SQLite database. After that, the API can serve paged simulation data from the database (when the file on disk still matches the stored size and modification time) instead of scanning the CSV for every request. This is the script you run inside the **dcs-backend** container so it uses the same `DATABASE_URL` and `designs` mount as the running server.

## Copy-paste: run the import in Docker

From the **repository root** (the directory that contains `docker-compose-dev.yml`):

```bash
docker compose -f docker-compose-dev.yml exec dcs-backend bash -lc 'cd /app && python scripts/transferCSVtoDatabase.py --designs-root /app/designs -v'
```

- If the stack is not up: `docker compose -f docker-compose-dev.yml up -d` first.
- The container working directory is `/app`; the backend and `scripts/` are mounted from your repo’s `dcs-backend/`.

## Inputs, flags, and result

- **`--designs-root`**: absolute or relative path to the `designs` tree. In the container use `/app/designs` (default relative path `designs` works if the current working directory is `/app`).
- **`--force`**: re-import every file even if it is already in the database with the same file size and mtime (overwrites the stored rows for that design/scenario).
- **`--dry-run`**: only list `catalog_rel` / `sim_name` and file paths; no database writes.
- **`-v` / `--verbose`**: print each file and whether it was imported or skipped.

**Outcome:** New SQLite tables hold one import row per `(top-level design folder, scenario name)` and one row per CSV data line. The `/api/designs/.../simulations/.../data` endpoint uses this data when the on-disk `*.data.csv` still matches the import; otherwise it falls back to reading the file as before.

## Optional: one-liner with environment

If you need to point at a different database file, set `DATABASE_URL` the same way as in `docker-compose-dev.yml` (e.g. `sqlite:///./datacenter.db` when `cwd` is `/app`).

```bash
docker compose -f docker-compose-dev.yml exec dcs-backend bash -lc 'cd /app && export DATABASE_URL="${DATABASE_URL:-sqlite:///./datacenter.db}" && python scripts/transferCSVtoDatabase.py --designs-root /app/designs -v'
```
