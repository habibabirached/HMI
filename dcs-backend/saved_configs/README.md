# Saved Configurations Directory

This directory stores power system configuration files saved by users.

## What's Stored Here

Each saved configuration is a JSON file containing:
- All components placed on the canvas
- All connections between components
- Component properties (ratings, voltages, positions)
- Metadata (name, creation date, version)

## File Format

Example: `my-datacenter-v1.json`
```json
{
  "version": "1.0",
  "name": "my-datacenter-v1",
  "createdAt": "2026-02-04T13:00:00Z",
  "canvasComponents": [...],
  "connections": [...]
}
```

## Access

These files are accessible to:
- Backend server (reads/writes via API)
- System administrators (can access `/app/saved_configs/` on server)
- Users (get downloaded copy when they save)

## Backup

This directory is mounted as a Docker volume, so configuration files
persist even when containers are rebuilt or restarted.

To backup all configurations:
```bash
tar -czf configs-backup.tar.gz saved_configs/
```

---

**Note:** This directory is excluded from git (see .gitignore)
User configurations are data, not code, and shouldn't be committed to the repository.
