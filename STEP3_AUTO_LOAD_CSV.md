# ✅ Step 3 Complete: Auto-Load Configuration CSV into Database

## Summary

Successfully implemented automatic CSV loading when a configuration is loaded from the database.

---

## Implementation

### 1. **Helper Function Added** (`app.py`)

**Location:** `dcs-backend/app.py` (before `load_configuration` endpoint)

**Function:** `auto_load_csv_for_config(config_name: str, db: Session)`

**Logic:**
```python
# CSV filename = Configuration name + .csv extension (exact match)
csv_filename = f"{config_name}.csv"

# Example:
# Config: "Tier III Data Center - Horizontal Layout"
# CSV:    "Tier III Data Center - Horizontal Layout.csv"
```

**Steps:**
1. Check if `{config_name}.csv` exists in `saved_csv/` directory
2. If not found → return (no auto-load)
3. If found, check if already in database
4. If already in database → return (already loaded)
5. If not in database → load it:
   - Read CSV file
   - Parse columns and rows
   - Create `CSVDataset` record in database
   - Commit to database

---

### 2. **Modified Endpoint** (`load_configuration`)

**Location:** `dcs-backend/app.py` - `GET /api/load/{config_id}`

**Added after Step 4 (building response):**
```python
# Step 5: Auto-load corresponding CSV if available
csv_result = auto_load_csv_for_config(config.name, db)
if csv_result["loaded"]:
    print(f"   📊 {csv_result['message']}")
```

---

### 3. **CSV File Naming Convention**

**Rule:** CSV filename MUST match configuration name exactly

**Examples:**
- Configuration: `"Tier III Data Center - Horizontal Layout"`
- CSV File: `"Tier III Data Center - Horizontal Layout.csv"`

**File Renamed:**
- ❌ Old: `tier3_horizontal.csv`
- ✅ New: `Tier III Data Center - Horizontal Layout.csv`

---

### 4. **Updated CSV Generation Script**

**File:** `dcs-backend/generate_config_csv.py`

**Change:** Use exact configuration name from JSON for CSV filename

```python
# Read config JSON
config = json.load(f)
exact_config_name = config.get('name', config_name)

# Create CSV with exact name
csv_filename = f"{exact_config_name}.csv"
```

**Usage:**
```bash
# Input: JSON file name (e.g., "tier3_horizontal")
python3 generate_config_csv.py tier3_horizontal

# Output: CSV with exact config name
# → "Tier III Data Center - Horizontal Layout.csv"
```

---

## Testing Results

### Test 1: Load Configuration
```bash
$ curl http://localhost:5000/api/load/7
```

**Backend Logs:**
```
✅ Configuration loaded: ID=7, Name='Tier III Data Center - Horizontal Layout'
📂 Auto-loading CSV: Tier III Data Center - Horizontal Layout.csv
✅ Auto-loaded CSV: Tier III Data Center - Horizontal Layout.csv (1441 rows)
   📊 CSV 'Tier III Data Center - Horizontal Layout.csv' auto-loaded successfully (1441 rows)
```

### Test 2: Verify Database
```bash
$ curl http://localhost:5000/api/csv/list
```

**Result:** CSV appears in list with 1441 rows, 14 columns

### Test 3: Second Load (Already in DB)
```bash
$ curl http://localhost:5000/api/load/7
```

**Backend Logs:**
```
✅ Configuration loaded: ID=7, Name='Tier III Data Center - Horizontal Layout'
   📊 CSV 'Tier III Data Center - Horizontal Layout.csv' already loaded (ID: 5)
```

---

## Benefits

✅ **Automatic:** No manual CSV upload needed  
✅ **Seamless:** Happens in background when loading config  
✅ **Idempotent:** Won't duplicate if already loaded  
✅ **Fast:** Only loads once, cached in database  
✅ **Simple:** Exact name matching (no complex heuristics)  

---

## File Changes

1. ✅ `dcs-backend/app.py`
   - Added `auto_load_csv_for_config()` helper
   - Modified `load_configuration()` endpoint

2. ✅ `dcs-backend/generate_config_csv.py`
   - Uses exact config name for CSV filename

3. ✅ `dcs-backend/saved_csv/`
   - Renamed: `tier3_horizontal.csv` → `Tier III Data Center - Horizontal Layout.csv`

---

## Next Steps

**Step 4:** Multi-Selection State Management  
- Add `selectedComponents` array state in App.js
- Enable Shift+Click to select multiple components
- Visual feedback (blue glow + checkmarks)

**Ready to proceed to Step 4?**

---

## Database Schema Used

**Table:** `csv_datasets`

```sql
CREATE TABLE csv_datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    columns TEXT NOT NULL,           -- JSON array
    data_json TEXT NOT NULL,         -- JSON array of objects
    row_count INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**CSV Record Example:**
```json
{
  "id": 5,
  "name": "Tier III Data Center - Horizontal Layout.csv",
  "file_path": "saved_csv/Tier III Data Center - Horizontal Layout.csv",
  "columns": ["time_sec", "grid_power_mw", ..., "total_load_mw"],
  "row_count": 1441,
  "uploaded_at": "2026-02-08T20:15:32"
}
```
