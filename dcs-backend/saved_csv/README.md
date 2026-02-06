# Saved CSV Directory

This directory stores uploaded CSV time-series data files that are used for charting and simulation.

## Purpose

When users upload CSV files through the frontend UI, the files are:
1. **Stored here** on disk as backup/reference copies
2. **Parsed and stored** in the SQLite database (`csv_datasets` table) for fast access

This dual storage approach provides:
- **Database**: Fast queries, efficient data access during simulation
- **Disk files**: Easy inspection, backup, version control

## File Naming

CSV files are stored with their original filenames:
- `solar_24hr_realistic.csv`
- `wind_24hr_realistic.csv`
- `load_24hr_datacenter.csv`
- `custom_dataset_123.csv`

Filenames must be unique. If a file with the same name already exists, the user will be prompted to either:
- Overwrite the existing file
- Rename the new file before uploading

## CSV Format

Uploaded CSVs should follow these guidelines:

### Structure
- **Header row**: Required (defines column names)
- **Data rows**: One row per data point
- **Delimiter**: Comma (`,`)
- **Encoding**: UTF-8

### Example CSV
```csv
time_sec,power_mw,voltage_kv,frequency_hz
0,0,13.8,60.0
10,1.2,13.7,60.1
20,2.5,13.8,60.0
30,4.8,13.9,59.9
```

### Recommended Columns
- **Time column**: `time_sec`, `timestamp`, `hour_of_day`, `datetime`
- **Value columns**: `power_mw`, `voltage_kv`, `current_a`, `frequency_hz`, etc.

Users can select which columns to use for X and Y axes when associating charts with components.

## Data Resolution

For realistic 24-hour simulations:
- **Recommended**: 10-second resolution (8,640 rows per day)
- **Acceptable**: 1-minute resolution (1,440 rows per day)
- **High-res**: 1-second resolution (86,400 rows per day)

Higher resolution provides smoother charts but results in larger files.

## Typical File Sizes
- 1-minute resolution: ~120 KB per 24-hour CSV
- 10-second resolution: ~700 KB per 24-hour CSV
- 1-second resolution: ~7 MB per 24-hour CSV

## Auto-Import (Development)

During development, you can place CSV files directly in this directory before starting the backend.
The startup script will automatically detect and import them into the database.

## Backup

This directory should be included in backups along with the SQLite database file to ensure complete data preservation.

## .gitignore

CSV files in this directory are tracked by git (unlike the database file). This allows:
- Sharing reference datasets with team members
- Version control of simulation scenarios
- Easy reproduction of simulation results

To ignore specific CSV files, add patterns to `.gitignore`:
```
saved_csv/temp_*.csv
saved_csv/user_uploads/
```
