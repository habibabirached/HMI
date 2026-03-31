"""
DATA CENTER POWER SYSTEM - BACKEND API SERVER
==============================================

This is the backend server that handles saving and loading power system
configurations. It provides REST API endpoints that the React frontend
calls to store and retrieve configurations.

TECHNOLOGY STACK:
- FastAPI: Modern Python web framework (fast, async, auto-documentation)
- SQLAlchemy: Database ORM (Object-Relational Mapping)
- SQLite: File-based database (simple, no server needed)
- Uvicorn: ASGI server that runs FastAPI

WHAT THIS SERVER DOES:
1. Provides /health endpoint to check if server is running
2. Will provide /api/save endpoint to save configurations (Step 4)
3. Will provide /api/load endpoint to load configurations (Step 4)
4. Manages database and disk storage for configurations

HOW TO RUN:
  Development: uvicorn app:app --reload --host 0.0.0.0 --port 5000
  Docker: Handled by Dockerfile
"""

# ============================================================================
# IMPORTS - Python libraries we need
# ============================================================================
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import copy
import json
import os
import re
import shutil
from typing import Optional
from urllib.parse import unquote

# Import database components
from database import init_db, get_db
# Import database models (Configuration only; designs/ flow uses files, not DB for CSV/sim)
from models import Configuration
# Import Pydantic schemas for request/response validation
from schemas import (
    ConfigurationSaveRequest,
    ConfigurationResponse,
    ConfigurationListItem,
    DesignCatalogItem,
    DesignCatalogBundle,
    CreateSimulationRequest,
    UpdateSimulationConfigRequest,
    SaveNamedSimulationConfigRequest,
)
# Additional imports for CSV handling
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
import csv
import io
import pandas as pd

# ============================================================================
# DESIGN DIRECTORY HELPERS (Step 5 - per-design structure)
# ============================================================================

DESIGNS_ROOT = "./designs"


def sanitize_design_name(name: str) -> str:
    """
    Convert design name to safe directory name.
    Example: "LM2500-BESS-Integrated-Power-Node" -> "lm2500_bess_integrated_power_node"
    """
    if not name or not isinstance(name, str):
        return "unnamed"
    s = re.sub(r'[^\w\s-]', '', name)  # Remove special chars except - and _
    s = re.sub(r'[\s-]+', '_', s)      # Spaces and hyphens -> underscore
    s = s.lower().strip('_')
    return s if s else "unnamed"


def copy_design_dir(source_name: str, dest_name: str) -> bool:
    """
    Copy design dir from source to dest (for Save As).
    Copies all .sim.json and .data.csv files; renames .conf.json to new design name.
    Source may be under designs/archive/. Destination is always designs/{sanitize(dest)}/.
    Returns True if copied, False if source doesn't exist or copy failed.
    """
    try:
        dst_dir = sanitize_design_name(dest_name)
        dst_path = os.path.join(DESIGNS_ROOT, dst_dir)
        src_loc = locate_design_storage_for_config_name(source_name)
        if src_loc:
            _src_rel, src_path = src_loc
            src_leaf = os.path.basename(os.path.normpath(src_path))
        else:
            src_leaf = sanitize_design_name(source_name)
            src_path = os.path.join(DESIGNS_ROOT, src_leaf)
        src_abs = os.path.abspath(src_path)
        dst_abs = os.path.abspath(dst_path)
        cwd = os.getcwd()
        print(f"[DEBUG] copy_design_dir: cwd={cwd}")
        print(f"[DEBUG] copy_design_dir: src_path={src_path} -> abs={src_abs}")
        print(f"[DEBUG] copy_design_dir: dst_path={dst_path} -> abs={dst_abs}")
        if src_leaf == dst_dir and os.path.normpath(src_path) == os.path.normpath(dst_path):
            print(f"[DEBUG] copy_design_dir: SKIP (src==dst)")
            return False
        if not os.path.isdir(src_path):
            print(f"[DEBUG] copy_design_dir: SKIP (source dir does not exist)")
            return False
        if os.path.exists(dst_path):
            shutil.rmtree(dst_path)
        os.makedirs(dst_path, exist_ok=True)
        src_conf = os.path.join(src_path, f"{src_leaf}.conf.json")
        for f in os.listdir(src_path):
            src_f = os.path.join(src_path, f)
            if os.path.isfile(src_f) and not f.endswith(".conf.json"):
                shutil.copy2(src_f, os.path.join(dst_path, f))
        if os.path.isfile(src_conf):
            with open(src_conf, "r") as f:
                conf = json.load(f)
            conf["name"] = dest_name
            dst_conf = os.path.join(dst_path, f"{dst_dir}.conf.json")
            with open(dst_conf, "w") as f:
                json.dump(conf, f, indent=2)
        print(f"✅ Copied design dir: {src_path} -> {dst_dir}")
        return True
    except Exception as e:
        print(f"⚠️  Copy design dir failed: {e}")
        return False


def save_config_to_design_dir(
    config_name: str,
    description,
    data: dict,
    design_catalog_rel: Optional[str] = None,
):
    """
    Save configuration to designs/{design_dir}/{design_dir}.conf.json
    (or designs/archive/... when design_catalog_rel is set).
    Creates design directory if it doesn't exist.
    Returns the design_dir path segment used, or None on failure.
    """
    try:
        cwd = os.getcwd()
        if design_catalog_rel:
            rel = design_catalog_rel.replace("\\", "/").strip("/")
            leaf = rel.split("/")[-1]
            dir_path = os.path.join(DESIGNS_ROOT, *rel.split("/"))
            design_dir = rel
        else:
            design_dir = sanitize_design_name(config_name)
            leaf = design_dir
            dir_path = os.path.join(DESIGNS_ROOT, design_dir)
        conf_path = os.path.join(dir_path, f"{leaf}.conf.json")
        dir_abs = os.path.abspath(dir_path)
        conf_abs = os.path.abspath(conf_path)
        print(f"[DEBUG] save_config_to_design_dir: cwd={cwd}")
        print(f"[DEBUG] save_config_to_design_dir: DESIGNS_ROOT={DESIGNS_ROOT}")
        print(f"[DEBUG] save_config_to_design_dir: dir_path={dir_path} -> abs={dir_abs}")
        print(f"[DEBUG] save_config_to_design_dir: conf_path={conf_path} -> abs={conf_abs}")
        os.makedirs(dir_path, exist_ok=True)
        conf_data = {
            "name": config_name,
            "description": description or "",
            "canvasComponents": data.get("canvasComponents", []),
            "connections": data.get("connections", []),
            "systemState": data.get("systemState", {"simulationRunning": False, "zoom": 1, "pan": {"x": 0, "y": 0}})
        }
        with open(conf_path, 'w') as f:
            json.dump(conf_data, f, indent=2)
        print(f"✅ Saved to design dir: {conf_path}")
        print(f"[DEBUG] save_config_to_design_dir: Verifying file exists: {os.path.exists(conf_path)}")
        return design_dir.replace("\\", "/")
    except Exception as e:
        print(f"⚠️  Design dir save failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def canvas_data_from_conf_file(conf: dict) -> dict:
    """Build the canvas `data` object from a design .conf.json dict (same keys as DB storage)."""
    return {
        "canvasComponents": conf.get("canvasComponents", []),
        "connections": conf.get("connections", []),
        "systemState": conf.get(
            "systemState",
            {"simulationRunning": False, "zoom": 1, "pan": {"x": 0, "y": 0}},
        ),
    }


def _designs_root_abs() -> str:
    return os.path.realpath(os.path.abspath(DESIGNS_ROOT))


def resolve_design_dir_rel(design_dir_param: str) -> Optional[tuple[str, str]]:
    """
    Resolve a catalog path under designs/: either `<leaf>` or `archive/<leaf>`.
    Returns (catalog_rel, leaf) if the folder exists and contains {leaf}.conf.json.
    """
    if not design_dir_param or not isinstance(design_dir_param, str):
        return None
    raw = unquote(design_dir_param).strip().strip("/")
    if not raw or ".." in raw:
        return None
    parts = [p for p in raw.replace("\\", "/").split("/") if p]
    if not parts:
        return None
    base = _designs_root_abs()
    if len(parts) == 1:
        if parts[0] == "archive":
            return None
        leaf = parts[0]
        catalog_rel = leaf
        candidate = os.path.realpath(os.path.join(base, leaf))
    elif len(parts) == 2 and parts[0] == "archive":
        leaf = parts[1]
        catalog_rel = f"archive/{leaf}"
        candidate = os.path.realpath(os.path.join(base, "archive", leaf))
    else:
        return None
    if not candidate.startswith(base + os.sep):
        return None
    if not os.path.isdir(candidate):
        return None
    conf_path = os.path.join(candidate, f"{leaf}.conf.json")
    if not os.path.isfile(conf_path):
        return None
    return (catalog_rel, leaf)


def resolve_design_storage_from_api(design_name: str) -> tuple[str, str]:
    """
    Resolve /api/designs/{design_name}/… path to (absolute_dir_path, catalog_rel).
    design_name is either a single segment (sanitized folder / display slug) or archive/<leaf>.
    """
    raw = unquote(design_name or "").strip().strip("/")
    if not raw or ".." in raw:
        raise HTTPException(status_code=404, detail="Invalid design path")
    parts = [p for p in raw.replace("\\", "/").split("/") if p]
    if not parts:
        raise HTTPException(status_code=404, detail="Invalid design path")
    base = _designs_root_abs()
    if len(parts) == 1:
        leaf = sanitize_design_name(parts[0])
        catalog_rel = leaf
        candidate = os.path.realpath(os.path.join(base, leaf))
    elif len(parts) == 2 and parts[0].lower() == "archive":
        if not re.match(r"^[\w-]+$", parts[1]):
            raise HTTPException(status_code=404, detail="Invalid archive design folder")
        leaf = parts[1]
        catalog_rel = f"archive/{leaf}"
        candidate = os.path.realpath(os.path.join(base, "archive", leaf))
    else:
        raise HTTPException(status_code=404, detail="Invalid design path")
    if not candidate.startswith(base + os.sep):
        raise HTTPException(status_code=404, detail="Design directory not found")
    if not os.path.isdir(candidate):
        raise HTTPException(
            status_code=404,
            detail=f"Design directory not found: {design_name}",
        )
    return candidate, catalog_rel


def locate_design_storage_for_config_name(config_name: str) -> Optional[tuple[str, str]]:
    """
    Find design folder for a configuration display name: try designs/{slug}/ then designs/archive/{slug}/.
    Returns (catalog_rel, absolute_dir_path) or None.
    """
    leaf = sanitize_design_name(config_name)
    base = _designs_root_abs()
    top = os.path.realpath(os.path.join(base, leaf))
    if top.startswith(base + os.sep) and os.path.isdir(top):
        conf_top = os.path.join(top, f"{leaf}.conf.json")
        if os.path.isfile(conf_top):
            return (leaf, top)
    arc = os.path.realpath(os.path.join(base, "archive", leaf))
    if arc.startswith(base + os.sep) and os.path.isdir(arc):
        conf_arc = os.path.join(arc, f"{leaf}.conf.json")
        if os.path.isfile(conf_arc):
            return (f"archive/{leaf}", arc)
    return None


def configuration_response_from_disk_name(
    display_name: str,
    parsed_data: dict,
    file_description,
    db: Session,
    design_catalog_rel: Optional[str] = None,
) -> ConfigurationResponse:
    """Build ConfigurationResponse after reading canvas from disk (by display name / design dir)."""
    row = db.query(Configuration).filter(Configuration.name == display_name).first()
    if design_catalog_rel:
        rel = design_catalog_rel.replace("\\", "/").strip("/")
        design_dir_path = os.path.join(DESIGNS_ROOT, *rel.split("/"))
    else:
        design_dir = sanitize_design_name(display_name)
        rel = design_dir
        design_dir_path = os.path.join(DESIGNS_ROOT, design_dir)
    if not os.path.isdir(design_dir_path):
        raise HTTPException(
            status_code=404,
            detail=f"Design directory not found for '{display_name}' at designs/{rel}/",
        )
    list_result = _list_design_simulations(display_name, design_catalog_rel=rel)
    csv_status = {
        "exists": False,
        "csv_name": None,
        "message": "Design uses per-simulation files (click a simulation to load data)",
        "use_design_dir": True,
        "design_name": display_name,
        "design_catalog_rel": rel,
        "available_simulations": list_result.get("simulations", []),
    }
    desc = file_description if file_description is not None else (row.description if row else None)
    if row:
        return ConfigurationResponse(
            id=row.id,
            name=display_name,
            description=desc,
            data=parsed_data,
            created_at=row.created_at,
            updated_at=row.updated_at,
            csv_status=csv_status,
            sim_config=None,
        )
    now = datetime.utcnow()
    return ConfigurationResponse(
        id=0,
        name=display_name,
        description=desc,
        data=parsed_data,
        created_at=now,
        updated_at=now,
        csv_status=csv_status,
        sim_config=None,
    )


# ============================================================================
# CREATE THE FASTAPI APPLICATION
# ============================================================================
# This is the main application object. Every API endpoint we create
# will be attached to this 'app' object.
app = FastAPI(
    title="Data Center Power System API",
    description="Backend API for saving/loading power system configurations",
    version="1.0.0"
)

# ============================================================================
# ENABLE CORS (Cross-Origin Resource Sharing)
# ============================================================================
# WHAT IS CORS?
# By default, browsers block requests from one domain (localhost:3001)
# to another domain (localhost:5000). This is a security feature.
# 
# We need to explicitly allow the React frontend (port 3001) to call
# our backend (port 5000). This is called "enabling CORS".
#
# CORS middleware tells the browser: "It's okay, these two servers
# are allowed to talk to each other."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Allow all origins (for development)
                                   # In production, specify: ["http://localhost:3001"]
    allow_credentials=True,
    allow_methods=["*"],           # Allow all HTTP methods (GET, POST, DELETE, etc.)
    allow_headers=["*"],           # Allow all headers
)

# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================
# This is a simple test endpoint to verify the server is running.
# 
# HOW TO TEST:
# Visit http://localhost:5000/health in your browser
# You should see: {"status": "ok", "timestamp": "2026-02-04T..."}
#
# FASTAPI DECORATOR:
# @app.get("/health") tells FastAPI: "When someone makes a GET request
# to /health, run this function and return its result as JSON"
@app.get("/health")
async def health_check():
    """
    Health check endpoint - verifies backend is running.
    
    Returns:
        dict: Status and current timestamp
    """
    return {
        "status": "ok",
        "message": "Data Center Power System Backend is running",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# ============================================================================
# ROOT ENDPOINT (Welcome Message)
# ============================================================================
# When you visit http://localhost:5000/ (root), show a welcome message
@app.get("/")
async def root():
    """
    Root endpoint - provides API information.
    """
    return {
        "name": "Data Center Power System API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",              # FastAPI auto-generates this!
            "save": "/api/save",
            "load": "/api/load/{id}?source=disk|database",
            "list": "/api/configs",
            "delete": "/api/configs/{id}"
        }
    }

# ============================================================================
# SAVE CONFIGURATION ENDPOINT
# ============================================================================
# POST /api/save - Save a new configuration
#
# HOW IT WORKS:
# 1. Frontend sends configuration data (components, connections, etc.)
# 2. FastAPI validates the data against ConfigurationSaveRequest schema
# 3. We convert the data dict to a JSON string
# 4. We create a new Configuration database record
# 5. We save it to the database
# 6. Optionally, we also save a JSON file to disk (redundancy)
# 7. We return the saved configuration with its ID
#
# EXAMPLE REQUEST (curl):
# curl -X POST http://localhost:5000/api/save \
#   -H "Content-Type: application/json" \
#   -d '{"name": "Test Config", "data": {"components": []}}'
#
# EXAMPLE RESPONSE:
# {
#   "id": 1,
#   "name": "Test Config",
#   "description": null,
#   "data": {"components": []},
#   "created_at": "2026-02-04T14:30:00",
#   "updated_at": "2026-02-04T14:30:00"
# }
@app.post("/api/save", response_model=ConfigurationResponse)
async def save_configuration(
    config_request: ConfigurationSaveRequest,
    db: Session = Depends(get_db)
):
    """
    Save a new power system configuration.
    
    This endpoint:
    1. Accepts configuration data from the frontend
    2. Validates the data structure
    3. Saves to SQLite database
    4. Optionally saves a JSON backup file
    5. Returns the saved configuration with its assigned ID
    
    Args:
        config_request: The configuration data (validated by Pydantic)
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        ConfigurationResponse: The saved configuration with ID and timestamps
    
    Raises:
        HTTPException 500: If database save fails
    """
    try:
        # DEBUG: Log incoming save request
        print(f"[DEBUG] save_configuration called: name={config_request.name!r}, source_name={config_request.source_name!r}", flush=True)
        # ----------------------------------------------------------------
        # STEP 1: Check if configuration with same name already exists
        # ----------------------------------------------------------------
        existing_config = db.query(Configuration).filter(Configuration.name == config_request.name).first()
        
        if existing_config:
            # ----------------------------------------------------------------
            # UPDATE EXISTING CONFIGURATION
            # ----------------------------------------------------------------
            print(f"[DEBUG] SAVE: UPDATE branch (config already exists)")
            print(f"🔄 Updating existing configuration: '{config_request.name}' (ID={existing_config.id})")
            
            # Convert the data dict to a JSON string
            data_json_string = json.dumps(config_request.data)
            
            # Update existing record
            existing_config.data = data_json_string
            if config_request.description is not None:
                existing_config.description = config_request.description
            existing_config.updated_at = datetime.utcnow()
            
            # Commit the update
            db.commit()
            db.refresh(existing_config)
            
            # Save to design dir (per-design structure; respects archive/... if already there)
            print(f"[DEBUG] SAVE (UPDATE): Calling save_config_to_design_dir for '{config_request.name}'")
            _disk_loc = locate_design_storage_for_config_name(config_request.name)
            save_config_to_design_dir(
                config_request.name,
                config_request.description,
                config_request.data,
                design_catalog_rel=(_disk_loc[0] if _disk_loc else None),
            )
            
            # Return the updated configuration
            response_config = ConfigurationResponse(
                id=existing_config.id,
                name=existing_config.name,
                description=existing_config.description,
                data=json.loads(existing_config.data),
                created_at=existing_config.created_at,
                updated_at=existing_config.updated_at
            )
            
            print(f"✅ Configuration updated: ID={existing_config.id}, Name='{existing_config.name}'")
            
            return response_config
        
        else:
            # ----------------------------------------------------------------
            # CREATE NEW CONFIGURATION (or Save As)
            # ----------------------------------------------------------------
            print(f"[DEBUG] SAVE: CREATE branch (new config or Save As)")
            print(f"➕ Creating new configuration: '{config_request.name}'")
            # Step 13: Save As - copy design dir from source if provided
            if config_request.source_name and config_request.source_name != config_request.name:
                print(f"[DEBUG] SAVE (CREATE): Save As detected - source_name='{config_request.source_name}', dest='{config_request.name}'")
                copy_result = copy_design_dir(config_request.source_name, config_request.name)
                print(f"[DEBUG] SAVE (CREATE): copy_design_dir returned {copy_result}")
        
        # ----------------------------------------------------------------
        # STEP 2: Convert the data dict to a JSON string
        # ----------------------------------------------------------------
        # The database stores JSON as a text column (string)
        # json.dumps() converts Python dict/list → JSON string
        # Example: {"key": "value"} → '{"key": "value"}'
        data_json_string = json.dumps(config_request.data)
        
        # ----------------------------------------------------------------
        # STEP 2: Create a new Configuration database record
        # ----------------------------------------------------------------
        # This creates a Python object representing a database row
        # It's NOT yet saved to the database (that happens on commit)
        new_config = Configuration(
            name=config_request.name,
            description=config_request.description,
            data=data_json_string
        )
        
        # ----------------------------------------------------------------
        # STEP 3: Add the record to the database session
        # ----------------------------------------------------------------
        # This stages the record for insertion
        # Think of it like "git add" - it's ready but not committed yet
        db.add(new_config)
        
        # ----------------------------------------------------------------
        # STEP 4: Commit the transaction to save to database
        # ----------------------------------------------------------------
        # This actually writes the data to the database file
        # The database assigns an ID and sets created_at/updated_at
        db.commit()
        
        # ----------------------------------------------------------------
        # STEP 5: Refresh to get the auto-generated fields
        # ----------------------------------------------------------------
        # After commit, the database has assigned:
        # - id (auto-incremented)
        # - created_at (current timestamp)
        # - updated_at (current timestamp)
        # 
        # db.refresh() re-reads the record from the database to get these values
        db.refresh(new_config)
        
        # Save to design dir (per-design structure; respects archive/... if already there)
        print(f"[DEBUG] SAVE (CREATE): Calling save_config_to_design_dir for '{config_request.name}'")
        _disk_loc = locate_design_storage_for_config_name(config_request.name)
        save_config_to_design_dir(
            config_request.name,
            config_request.description,
            config_request.data,
            design_catalog_rel=(_disk_loc[0] if _disk_loc else None),
        )
        
        # ----------------------------------------------------------------
        # STEP 7: Return the saved configuration
        # ----------------------------------------------------------------
        # FastAPI will automatically convert the Configuration ORM object
        # to a ConfigurationResponse Pydantic object, then to JSON
        # 
        # We need to parse the data JSON string back to a dict for the response
        # json.loads() converts JSON string → Python dict
        # Example: '{"key": "value"}' → {"key": "value"}
        response_config = ConfigurationResponse(
            id=new_config.id,
            name=new_config.name,
            description=new_config.description,
            data=json.loads(new_config.data),  # Parse JSON string → dict
            created_at=new_config.created_at,
            updated_at=new_config.updated_at
        )
        
        print(f"✅ Configuration saved: ID={new_config.id}, Name='{new_config.name}'")
        
        return response_config
        
    except json.JSONDecodeError as e:
        # JSON parsing error (shouldn't happen due to Pydantic validation)
        print(f"❌ JSON parsing error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON data: {str(e)}"
        )
    except Exception as e:
        # Database or other unexpected error
        print(f"❌ Error saving configuration: {e}")
        db.rollback()  # Undo any partial database changes
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save configuration: {str(e)}"
        )
# ============================================================================
# LOAD CONFIGURATION ENDPOINT
# ============================================================================
# GET /api/load/{id} - Load a specific configuration by ID and check for matching CSV
#
# HOW IT WORKS:
# 1. Frontend requests a configuration by ID (e.g., /api/load/9)
# 2. Query the database for that ID
# 3. If not found, return 404 error
# 4. If found, parse the JSON data string back to a dict
# 5. Call auto_load_csv_for_config() to check for matching CSV file
# 6. Check for matching simulation configuration
# 7. Return configuration + csv_status + sim_config to frontend
#
# WHAT GETS RETURNED:
# - id, name, description, data (the configuration)
# - created_at, updated_at (timestamps)
# - csv_status: {exists: bool, csv_name: str, message: str}
# - sim_config: {design_name, csv_file, simulations: {...}} or null
#
# EXAMPLE REQUEST (curl):
# curl http://localhost:5000/api/load/9
#
# EXAMPLE RESPONSE (with CSV and sim_config):
# {
#   "id": 9,
#   "name": "LM2500-BESS-Integrated-Power-Node",
#   "description": "One-quarter Meta data center...",
#   "data": {"canvasComponents": [...], "connections": [...]},
#   "created_at": "2026-02-11T00:58:06",
#   "updated_at": "2026-02-11T00:58:06",
#   "csv_status": {
#     "exists": true,
#     "csv_name": "LM2500-BESS-Integrated-Power-Node.csv",
#     "message": "CSV auto-loaded (13000 rows)"
#   },
#   "sim_config": {
#     "design_name": "LM2500-BESS-Integrated-Power-Node",
#     "csv_file": "LM2500-BESS-Integrated-Power-Node.csv",
#     "simulations": {
#       "sim_LVRT": {
#         "display_name": "Low-Voltage Ride-Through",
#         "description": "LVRT test on bus",
#         "charts_to_display": [],
#         "event_markers": {}
#       }
#     }
#   }
# }
#
# EXAMPLE RESPONSE (without CSV and sim_config):
# {
#   ... (same as above) ...
#   "csv_status": {
#     "exists": false,
#     "csv_name": "SomeConfig.csv",
#     "message": "No CSV file found: 'SomeConfig.csv'"
#   }
# }

@app.get("/api/load/{config_id}", response_model=ConfigurationResponse)
async def load_configuration(
    config_id: int,
    source: str = Query(
        "disk",
        description="disk = read canvas from designs/{name}/{name}.conf.json (default); "
        "database = read canvas from the configurations table",
    ),
    db: Session = Depends(get_db),
):
    """
    Load a specific power system configuration by its ID.
    
    This endpoint:
    1. Queries the database for a configuration with the given ID (for metadata and id)
    2. Returns 404 if the configuration doesn't exist
    3. Loads canvas data from disk (default) or from the DB row's `data` field
    4. Returns the full configuration with all metadata
    
    Args:
        config_id: The unique ID of the configuration to load (from URL path)
        source: "disk" (default) or "database"
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        ConfigurationResponse: The requested configuration with all data
    
    Raises:
        HTTPException 404: If configuration with given ID doesn't exist
        HTTPException 500: If database query or JSON parsing fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query the database for the configuration
        # ----------------------------------------------------------------
        # This generates SQL: SELECT * FROM configurations WHERE id = {config_id}
        # .first() returns the first matching record, or None if not found
        config = db.query(Configuration).filter(Configuration.id == config_id).first()
        
        # ----------------------------------------------------------------
        # STEP 2: Check if configuration exists
        # ----------------------------------------------------------------
        if config is None:
            # Configuration not found - return 404 error
            print(f"⚠️  Configuration not found: ID={config_id}")
            raise HTTPException(
                status_code=404,
                detail=f"Configuration with ID {config_id} not found"
            )
        
        # ----------------------------------------------------------------
        # STEP 3–6: Canvas from database row or from matching .conf.json on disk
        # ----------------------------------------------------------------
        src = (source or "disk").lower().strip()
        if src not in ("disk", "database"):
            raise HTTPException(
                status_code=400,
                detail="Query parameter 'source' must be 'disk' or 'database'",
            )

        if src == "database":
            try:
                parsed_data = json.loads(config.data)
            except json.JSONDecodeError as json_error:
                print(f"❌ JSON parsing error for config ID {config_id}: {json_error}")
                raise HTTPException(
                    status_code=500,
                    detail="Configuration data is corrupted (invalid JSON)",
                )
            located = locate_design_storage_for_config_name(config.name)
            if not located:
                leaf = sanitize_design_name(config.name)
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Design directory not found for '{config.name}'. "
                        f"Expected designs/{leaf}/ or designs/archive/{leaf}/ with .conf.json."
                    ),
                )
            catalog_rel, design_dir_path = located
            list_result = _list_design_simulations(
                config.name, design_catalog_rel=catalog_rel
            )
            csv_status = {
                "exists": False,
                "csv_name": None,
                "message": "Design uses per-simulation files (click a simulation to load data)",
                "use_design_dir": True,
                "design_name": config.name,
                "design_catalog_rel": catalog_rel,
                "available_simulations": list_result.get("simulations", []),
            }
            print(
                f"   ✅ Design dir found: {catalog_rel} ({len(csv_status['available_simulations'])} simulations)"
            )
            print(f"✅ Configuration loaded (database): ID={config.id}, Name='{config.name}'")
            return ConfigurationResponse(
                id=config.id,
                name=config.name,
                description=config.description,
                data=parsed_data,
                created_at=config.created_at,
                updated_at=config.updated_at,
                csv_status=csv_status,
                sim_config=None,
            )

        located = locate_design_storage_for_config_name(config.name)
        if not located:
            leaf = sanitize_design_name(config.name)
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Design file not on disk: expected designs/{leaf}/{leaf}.conf.json "
                    f"or under designs/archive/{leaf}/."
                ),
            )
        catalog_rel, design_dir_path = located
        leaf = catalog_rel.split("/")[-1]
        conf_path = os.path.join(design_dir_path, f"{leaf}.conf.json")
        if not os.path.isfile(conf_path):
            raise HTTPException(
                status_code=404,
                detail=f"Design file not on disk: {conf_path}",
            )
        try:
            with open(conf_path, "r") as f:
                conf_file = json.load(f)
        except json.JSONDecodeError as json_error:
            print(f"❌ JSON parsing error for config ID {config_id}: {json_error}")
            raise HTTPException(
                status_code=500,
                detail="Design file contains invalid JSON",
            )
        parsed_data = canvas_data_from_conf_file(conf_file)
        file_description = conf_file.get("description")
        display_name = conf_file.get("name") or config.name
        print(f"✅ Configuration loaded (disk): Name='{display_name}'")
        return configuration_response_from_disk_name(
            display_name, parsed_data, file_description, db, design_catalog_rel=catalog_rel
        )
        
    except HTTPException:
        # Re-raise HTTPExceptions (404, 500) as-is
        # These are intentional errors we want to return to the client
        raise
    except Exception as e:
        # Catch any unexpected errors (database connection issues, etc.)
        print(f"❌ Error loading configuration {config_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load configuration: {str(e)}"
        )

# ============================================================================
# LIST CONFIGURATIONS ENDPOINT
# ============================================================================
# GET /api/configs - Get a list of all saved configurations
#
# HOW IT WORKS:
# 1. Query the database for ALL configurations
# 2. Return only metadata (id, name, description, timestamps)
# 3. Do NOT return the full 'data' field (can be very large)
# 4. Order by creation date (newest first)
#
# WHY EXCLUDE 'data'?
# - A configuration's 'data' field can be huge (thousands of components)
# - Loading all that data for every config would be slow
# - The list view only needs metadata to show to the user
# - Full data is loaded separately when user clicks "Load"
#
# EXAMPLE REQUEST (curl):
# curl http://localhost:5000/api/configs
#
# EXAMPLE RESPONSE:
# [
#   {
#     "id": 3,
#     "name": "Test Load Endpoint",
#     "description": "Configuration to test loading",
#     "created_at": "2026-02-04T23:48:04",
#     "updated_at": "2026-02-04T23:48:04"
#   },
#   {
#     "id": 2,
#     "name": "Emergency Scenario",
#     "description": "Testing grid loss with dual turbines",
#     "created_at": "2026-02-04T23:16:19",
#     "updated_at": "2026-02-04T23:16:19"
#   },
#   {
#     "id": 1,
#     "name": "Test Configuration 1",
#     "description": "First test of save functionality",
#     "created_at": "2026-02-04T23:16:08",
#     "updated_at": "2026-02-04T23:16:08"
#   }
# ]
@app.get("/api/configs", response_model=list[ConfigurationListItem])
async def list_configurations(db: Session = Depends(get_db)):
    """
    Get a list of all saved configurations (metadata only).
    
    This endpoint:
    1. Queries the database for all configurations
    2. Returns only metadata (id, name, description, timestamps)
    3. Excludes the 'data' field for performance (can be huge)
    4. Orders by creation date (newest first)
    
    Use this to show users a list of configurations to choose from.
    When user selects one, call GET /api/load/{id} to get the full data.
    
    Args:
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        list[ConfigurationListItem]: List of configuration metadata
    
    Raises:
        HTTPException 500: If database query fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query all configurations from database
        # ----------------------------------------------------------------
        # This generates SQL: SELECT * FROM configurations ORDER BY created_at DESC
        # .all() returns a list of all matching records
        # .order_by(Configuration.created_at.desc()) sorts newest first
        configs = db.query(Configuration).order_by(Configuration.created_at.desc()).all()
        
        # ----------------------------------------------------------------
        # STEP 2: Convert to response format (metadata only)
        # ----------------------------------------------------------------
        # We use ConfigurationListItem schema which excludes the 'data' field
        # This is much faster than returning full configurations
        # 
        # For each config, we create a ConfigurationListItem with just metadata
        result = []
        for config in configs:
            item = ConfigurationListItem(
                id=config.id,
                name=config.name,
                description=config.description,
                created_at=config.created_at,
                updated_at=config.updated_at
            )
            result.append(item)
        
        print(f"✅ Listed {len(result)} configuration(s)")
        
        return result
        
    except Exception as e:
        # Database or other unexpected error
        print(f"❌ Error listing configurations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list configurations: {str(e)}"
        )

# ============================================================================
# DELETE CONFIGURATION ENDPOINT
# ============================================================================
# DELETE /api/configs/{id} - Delete a specific configuration by ID
#
# HOW IT WORKS:
# 1. Frontend requests deletion of a configuration by ID
# 2. We query the database to verify it exists
# 3. If not found, return 404 error
# 4. If found, delete from database
# 5. Also delete the backup JSON file if it exists
# 6. Return success message
#
# EXAMPLE REQUEST (curl):
# curl -X DELETE http://localhost:5000/api/configs/1
#
# EXAMPLE RESPONSE (success):
# {
#   "message": "Configuration 'Test Config' deleted successfully",
#   "id": 1
# }
#
# EXAMPLE RESPONSE (not found):
# {
#   "detail": "Configuration with ID 999 not found"
# }
@app.delete("/api/configs/{config_id}")
async def delete_configuration(
    config_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a specific power system configuration by its ID.
    
    This endpoint:
    1. Queries the database for a configuration with the given ID
    2. Returns 404 if the configuration doesn't exist
    3. Deletes the configuration from the database
    4. Attempts to delete the backup JSON file (if it exists)
    5. Returns success message with deleted config name
    
    Args:
        config_id: The unique ID of the configuration to delete (from URL path)
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        dict: Success message with deleted configuration details
    
    Raises:
        HTTPException 404: If configuration with given ID doesn't exist
        HTTPException 500: If database deletion fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query the database for the configuration
        # ----------------------------------------------------------------
        config = db.query(Configuration).filter(Configuration.id == config_id).first()
        
        # ----------------------------------------------------------------
        # STEP 2: Check if configuration exists
        # ----------------------------------------------------------------
        if config is None:
            print(f"⚠️  Configuration not found for deletion: ID={config_id}")
            raise HTTPException(
                status_code=404,
                detail=f"Configuration with ID {config_id} not found"
            )
        
        # Store name for response message (before deleting from DB)
        config_name = config.name
        
        # ----------------------------------------------------------------
        # STEP 3: Delete from database
        # ----------------------------------------------------------------
        db.delete(config)
        db.commit()
        
        print(f"✅ Configuration deleted from database: ID={config_id}, Name='{config_name}'")
        
        # Return success message
        # ----------------------------------------------------------------
        return {
            "message": f"Configuration '{config_name}' deleted successfully",
            "id": config_id,
            "name": config_name
        }
        
    except HTTPException:
        # Re-raise HTTPExceptions (404) as-is
        raise
    except Exception as e:
        # Catch any unexpected errors (database connection issues, etc.)
        print(f"❌ Error deleting configuration {config_id}: {e}")
        db.rollback()  # Undo any partial database changes
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete configuration: {str(e)}"
        )

# ============================================================================
# DESIGN DIRECTORY ENDPOINTS (per-design structure)
# ============================================================================
# New design-centric APIs. Design name is sanitized to find design_dir.
#
# GET /api/designs/{design_name}/simulations - List simulations from design dir
# ============================================================================

def _list_design_simulations(
    design_name: str,
    design_catalog_rel: Optional[str] = None,
) -> dict:
    """Sync helper to list simulations in a design dir."""
    if design_catalog_rel:
        rel = design_catalog_rel.replace("\\", "/").strip("/")
        design_dir_key = rel
        dir_path = os.path.join(DESIGNS_ROOT, *rel.split("/"))
    else:
        design_dir = sanitize_design_name(design_name)
        design_dir_key = design_dir
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
    if not os.path.isdir(dir_path):
        return {"design_name": design_name, "design_dir": design_dir_key, "simulations": []}
    simulations = []
    for f in os.listdir(dir_path):
        if f.endswith(".sim.json"):
            sim_name = f[:-9]
            sim_path = os.path.join(dir_path, f)
            csv_path = os.path.join(dir_path, f"{sim_name}.data.csv")
            has_data = os.path.isfile(csv_path)
            try:
                with open(sim_path, "r") as fp:
                    sim_config = json.load(fp)
                display_name = sim_config.get("display_name", sim_name)
            except Exception:
                display_name = sim_name
            description = sim_config.get("description", "")
            simulations.append({"id": sim_name, "display_name": display_name, "description": description, "has_data": has_data})
    simulations.sort(key=lambda s: s["display_name"])
    return {"design_name": design_name, "design_dir": design_dir_key, "simulations": simulations}


def _catalog_item_from_path(dir_path: str, design_dir_rel: str, db: Session) -> Optional[DesignCatalogItem]:
    leaf = os.path.basename(dir_path.rstrip(os.sep))
    conf_path = os.path.join(dir_path, f"{leaf}.conf.json")
    if not os.path.isfile(conf_path):
        return None
    try:
        with open(conf_path, "r") as f:
            conf = json.load(f)
    except Exception as e:
        print(f"⚠️  Skipping catalog entry {design_dir_rel}: {e}")
        return None
    display_name = conf.get("name") or leaf
    desc = conf.get("description")
    row = db.query(Configuration).filter(Configuration.name == display_name).first()
    mtime = datetime.fromtimestamp(os.path.getmtime(conf_path), tz=timezone.utc)
    return DesignCatalogItem(
        design_dir=design_dir_rel,
        name=display_name,
        description=desc if desc is not None else None,
        db_id=row.id if row else None,
        conf_updated_at=mtime,
    )


@app.get("/api/designs/catalog", response_model=DesignCatalogBundle)
async def list_design_catalog(db: Session = Depends(get_db)):
    """
    Active designs: subfolders of designs/ (except archive). Archived: designs/archive/*.
    Each entry has {folder}/{folder}.conf.json.
    """
    active: list[DesignCatalogItem] = []
    archived: list[DesignCatalogItem] = []
    if not os.path.isdir(DESIGNS_ROOT):
        return DesignCatalogBundle(active=[], archived=[])
    for entry in sorted(os.listdir(DESIGNS_ROOT)):
        if entry.startswith(".") or entry == "archive":
            continue
        path = os.path.join(DESIGNS_ROOT, entry)
        if not os.path.isdir(path):
            continue
        item = _catalog_item_from_path(path, entry, db)
        if item:
            active.append(item)
    archive_root = os.path.join(DESIGNS_ROOT, "archive")
    if os.path.isdir(archive_root):
        for entry in sorted(os.listdir(archive_root)):
            if entry.startswith("."):
                continue
            path = os.path.join(archive_root, entry)
            if not os.path.isdir(path):
                continue
            rel = f"archive/{entry}"
            item = _catalog_item_from_path(path, rel, db)
            if item:
                archived.append(item)
    active.sort(key=lambda x: (x.name or "").lower())
    archived.sort(key=lambda x: (x.name or "").lower())
    return DesignCatalogBundle(active=active, archived=archived)


@app.get("/api/designs/catalog/{design_dir:path}/load", response_model=ConfigurationResponse)
async def load_design_from_catalog(design_dir: str, db: Session = Depends(get_db)):
    """Load canvas from designs/<design_dir>/.conf.json (same payload shape as /api/load)."""
    resolved = resolve_design_dir_rel(design_dir)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail="Design not found or missing {dir}.conf.json under designs/",
        )
    catalog_rel, leaf = resolved
    conf_path = os.path.join(DESIGNS_ROOT, *catalog_rel.split("/"), f"{leaf}.conf.json")
    try:
        with open(conf_path, "r") as f:
            conf_file = json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Design file contains invalid JSON")
    display_name = conf_file.get("name") or leaf
    parsed_data = canvas_data_from_conf_file(conf_file)
    file_description = conf_file.get("description")
    print(f"✅ Configuration loaded from catalog disk: {catalog_rel} → '{display_name}'")
    return configuration_response_from_disk_name(
        display_name, parsed_data, file_description, db, design_catalog_rel=catalog_rel
    )


@app.delete("/api/designs/catalog/{design_dir:path}")
async def delete_design_from_catalog(design_dir: str, db: Session = Depends(get_db)):
    """Remove the design directory from disk and delete the matching Configuration row by name in .conf.json."""
    resolved = resolve_design_dir_rel(design_dir)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail="Design not found or missing {dir}.conf.json under designs/",
        )
    catalog_rel, leaf = resolved
    dir_abs = os.path.join(DESIGNS_ROOT, *catalog_rel.split("/"))
    conf_path = os.path.join(dir_abs, f"{leaf}.conf.json")
    display_name = leaf
    try:
        with open(conf_path, "r") as f:
            conf = json.load(f)
        display_name = conf.get("name") or leaf
    except Exception:
        pass
    row = db.query(Configuration).filter(Configuration.name == display_name).first()
    shutil.rmtree(dir_abs, ignore_errors=False)
    if row:
        db.delete(row)
        db.commit()
    print(f"✅ Deleted design catalog folder {catalog_rel} (DB row removed: {bool(row)})")
    return {"message": f"Design '{display_name}' deleted", "design_dir": catalog_rel}


@app.post("/api/designs/catalog/{design_dir:path}/archive")
async def archive_design_from_catalog(design_dir: str):
    """Move designs/<leaf>/ to designs/archive/<leaf>/. Only top-level (non-archive) paths."""
    resolved = resolve_design_dir_rel(design_dir)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail="Design not found or missing {dir}.conf.json under designs/",
        )
    catalog_rel, leaf = resolved
    if "/" in catalog_rel:
        raise HTTPException(status_code=400, detail="Design is already archived")
    src = os.path.join(DESIGNS_ROOT, leaf)
    archive_root = os.path.join(DESIGNS_ROOT, "archive")
    os.makedirs(archive_root, exist_ok=True)
    dest = os.path.join(archive_root, leaf)
    if os.path.exists(dest):
        raise HTTPException(
            status_code=409,
            detail=f"Archive folder already exists: archive/{leaf}",
        )
    shutil.move(src, dest)
    print(f"✅ Archived design folder {leaf} -> archive/{leaf}")
    return {"message": f"Design moved to archive/{leaf}", "design_dir": f"archive/{leaf}"}


@app.get("/api/designs/{design_name:path}/image")
async def get_design_image(design_name: str):
    """
    Serve the design diagram image (designs/{design_dir}/{design_dir}.png).
    Returns 404 if the image does not exist.
    """
    dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
    leaf = os.path.basename(dir_path.rstrip(os.sep))
    img_path = os.path.join(dir_path, f"{leaf}.png")
    if not os.path.isfile(img_path):
        raise HTTPException(status_code=404, detail=f"Design image not found: {design_name}")
    return FileResponse(img_path, media_type="image/png")


@app.get("/api/designs/{design_name:path}/simulations")
async def list_design_simulations(design_name: str):
    """
    List available simulations for a design by scanning the design directory.
    """
    try:
        _dir_path, catalog_rel = resolve_design_storage_from_api(design_name)
        return _list_design_simulations(design_name, design_catalog_rel=catalog_rel)
    except Exception as e:
        print(f"❌ Error listing simulations for {design_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list simulations: {str(e)}"
        )


@app.get("/api/designs/{design_name:path}/simulations/{sim_name}")
async def load_design_simulation(design_name: str, sim_name: str):
    """
    Load a specific simulation: .sim.json config + .data.csv data.
    
    Returns both the simulation config (charts, event_markers) and the CSV data rows.
    Used when user clicks a simulation button - no DB, all from design dir.
    """
    try:
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        
        # Sim name from list endpoint is the filename without .sim.json (e.g. "ExampleSimulation")
        sim_json_path = os.path.join(dir_path, f"{sim_name}.sim.json")
        sim_csv_path = os.path.join(dir_path, f"{sim_name}.data.csv")
        
        if not os.path.isfile(sim_json_path):
            raise HTTPException(
                status_code=404,
                detail=f"Simulation config not found: {sim_name}"
            )
        
        # Load sim config
        with open(sim_json_path, 'r') as f:
            sim_config = json.load(f)

        # Merge legacy flat layout into current_configuration for the client; does not write the file.
        _normalize_sim_config_current_configuration(sim_config)
        
        # Load CSV data
        data_rows = []
        if os.path.isfile(sim_csv_path):
            with open(sim_csv_path, 'r') as f:
                reader = csv.DictReader(f)
                data_rows = list(reader)
        
        return {
            "design_name": design_name,
            "sim_name": sim_name,
            "sim_config": sim_config,
            "data": data_rows,
            "row_count": len(data_rows),
            # Lets the chart pane render one button per saved preset without scanning the whole JSON client-side.
            "named_configuration_keys": _list_named_configuration_keys(sim_config),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error loading simulation {design_name}/{sim_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load simulation: {str(e)}"
        )


@app.post("/api/designs/{design_name:path}/simulations")
async def create_simulation(design_name: str, body: CreateSimulationRequest):
    """
    Create a new simulation (empty .sim.json). Enables adding scenarios before uploading CSV.
    """
    try:
        sim_name = body.name.strip()
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        if not os.path.isdir(dir_path):
            raise HTTPException(status_code=404, detail=f"Design directory not found: {design_name}")
        safe_sim = re.sub(r'[^\w\-]', '', sim_name) or sim_name or "simulation"
        sim_json_path = os.path.join(dir_path, f"{safe_sim}.sim.json")
        if os.path.isfile(sim_json_path):
            raise HTTPException(status_code=409, detail=f"Simulation '{sim_name}' already exists")
        sim_config = {
            "display_name": sim_name.replace("_", " ").replace("-", " ").title(),
            "description": "",
            "charts_to_display": [],
            "event_markers": {}
        }
        with open(sim_json_path, "w") as f:
            json.dump(sim_config, f, indent=2)
        print(f"✅ Created simulation: {safe_sim}.sim.json")
        return {"design_name": design_name, "sim_name": safe_sim}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/designs/{design_name:path}/simulations/{sim_name}")
async def delete_simulation(design_name: str, sim_name: str):
    """
    Delete a simulation: removes .sim.json and .data.csv from the design dir.
    """
    try:
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        if not os.path.isdir(dir_path):
            raise HTTPException(status_code=404, detail=f"Design directory not found: {design_name}")
        safe_sim = re.sub(r'[^\w\-]', '', sim_name) or sim_name or "simulation"
        sim_json_path = os.path.join(dir_path, f"{safe_sim}.sim.json")
        sim_csv_path = os.path.join(dir_path, f"{safe_sim}.data.csv")
        if not os.path.isfile(sim_json_path):
            raise HTTPException(status_code=404, detail=f"Simulation '{sim_name}' not found")
        removed = []
        if os.path.isfile(sim_json_path):
            os.remove(sim_json_path)
            removed.append(f"{safe_sim}.sim.json")
        if os.path.isfile(sim_csv_path):
            os.remove(sim_csv_path)
            removed.append(f"{safe_sim}.data.csv")
        print(f"✅ Deleted simulation: {removed}")
        return {"design_name": design_name, "sim_name": safe_sim, "removed": removed}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STEP 3: Update simulation config (charts_to_display, event_markers)
# ============================================================================
# When the user adds or removes charts in the UI, we need to persist the new
# configuration back to the .sim.json file. This endpoint reads the existing
# file, merges in the new charts_to_display (and optionally event_markers),
# and overwrites the file so the changes survive a reload.
# ============================================================================

# Top-level keys we own for metadata and the live draft; user preset names must not collide.
# This block is the guardrail around user-chosen preset names in a scenario’s .sim.json. SIM_JSON_RESERVED_ROOT_KEYS is the list of top-level fields the app already uses (things like display_name, charts_to_display, and current_configuration), so a preset can’t use those names and overwrite real metadata. NAMED_SIM_CONFIG_KEY_RE only allows safe, URL- and file-friendly names: they start with a letter or digit and can continue with letters, digits, underscores, or hyphens, up to 64 characters. _looks_like_configuration_snapshot checks that an extra key’s value looks like a saved UI blob (it must be a dictionary and include charts_to_display, same idea as current_configuration). _list_named_configuration_scan walks the JSON object and returns every top-level key that isn’t reserved and passes that snapshot test—those become the names of the preset buttons in the UI. _validate_named_configuration_name runs when you save or activate a preset: it rejects bad characters, wrong length, and names that clash with the reserved list.


SIM_JSON_RESERVED_ROOT_KEYS = frozenset(
    {
        "display_name",
        "description",
        "derived_variables",
        "charts_to_display",
        "event_markers",
        "chart_sample_default",
        "chart_panel_height",
        "chart_panel_opacity",
        "chart_card_width",
        "chart_stacks",
        "current_configuration",
    }
)

NAMED_SIM_CONFIG_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


def _looks_like_configuration_snapshot(obj) -> bool:
    """Named presets reuse the same object shape as current_configuration (must include charts_to_display)."""
    return isinstance(obj, dict) and "charts_to_display" in obj


def _list_named_configuration_keys(sim_config: dict) -> list[str]:
    """Return sorted preset names stored as extra top-level keys in the .sim.json file."""
    out = []
    for k, v in sim_config.items():
        if k in SIM_JSON_RESERVED_ROOT_KEYS:
            continue
        if _looks_like_configuration_snapshot(v):
            out.append(k)
    return sorted(out)


def _validate_named_configuration_name(name: str) -> None:
    """Reject reserved keys and unsafe characters so paths and JSON stay predictable."""
    if not name or not NAMED_SIM_CONFIG_KEY_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail="Invalid preset name: use 1–64 chars (letter, digit, underscore, hyphen; must start with alphanumeric)",
        )
    if name in SIM_JSON_RESERVED_ROOT_KEYS:
        raise HTTPException(status_code=400, detail=f"Name '{name}' is reserved")


def _normalize_sim_config_current_configuration(sim_config: dict) -> None:
    """
    Ensure every loaded sim_config exposes a full current_configuration object.
    Older .sim.json files only had flat keys (charts_to_display at the root); we fill the draft blob from those when needed so the frontend always reads one shape.
    """
    cc = sim_config.get("current_configuration")
    if not isinstance(cc, dict):
        cc = {}

    vm = cc.get("view_mode") or "designer"
    if vm not in ("designer", "customer"):
        vm = "designer"

    charts_to_display = cc.get("charts_to_display")
    if charts_to_display is None:
        charts_to_display = list(sim_config.get("charts_to_display") or [])

    chart_stacks = cc.get("chart_stacks")
    if chart_stacks is None:
        chart_stacks = list(sim_config.get("chart_stacks") or [])

    chart_sample_default = cc.get("chart_sample_default")
    if chart_sample_default is None:
        chart_sample_default = sim_config.get("chart_sample_default")

    chart_panel_height = cc.get("chart_panel_height")
    if chart_panel_height is None:
        chart_panel_height = sim_config.get("chart_panel_height")

    chart_panel_opacity = cc.get("chart_panel_opacity")
    if chart_panel_opacity is None:
        chart_panel_opacity = sim_config.get("chart_panel_opacity")

    chart_card_width = cc.get("chart_card_width")
    if chart_card_width is None:
        chart_card_width = sim_config.get("chart_card_width")

    derived_variables = cc.get("derived_variables")
    if derived_variables is None:
        derived_variables = list(sim_config.get("derived_variables") or [])

    event_markers = cc.get("event_markers")
    if event_markers is None:
        event_markers = dict(sim_config.get("event_markers") or {})

    sim_config["current_configuration"] = {
        "view_mode": vm,
        "charts_to_display": charts_to_display,
        "chart_stacks": chart_stacks,
        "chart_sample_default": chart_sample_default,
        "chart_panel_height": chart_panel_height,
        "chart_panel_opacity": chart_panel_opacity,
        "chart_card_width": chart_card_width,
        "derived_variables": derived_variables,
        "event_markers": event_markers,
    }
    if sim_config.get("chart_card_width") is None and chart_card_width is not None:
        sim_config["chart_card_width"] = chart_card_width


def _refresh_current_configuration_snapshot(sim_config: dict, view_mode_override: Optional[str]) -> None:
    """
    After updating root fields on disk, mirror them into current_configuration (the mutable draft). Later, named presets will copy this subtree without touching the root until we intentionally unify the schema.
    """
    prev = sim_config.get("current_configuration")
    prev_vm = prev.get("view_mode") if isinstance(prev, dict) else None
    if view_mode_override in ("designer", "customer"):
        vm = view_mode_override
    elif prev_vm in ("designer", "customer"):
        vm = prev_vm
    else:
        vm = "designer"

    sim_config["current_configuration"] = {
        "view_mode": vm,
        "charts_to_display": list(sim_config.get("charts_to_display") or []),
        "chart_stacks": list(sim_config.get("chart_stacks") or []),
        "chart_sample_default": sim_config.get("chart_sample_default"),
        "chart_panel_height": sim_config.get("chart_panel_height"),
        "chart_panel_opacity": sim_config.get("chart_panel_opacity"),
        "chart_card_width": sim_config.get("chart_card_width"),
        "derived_variables": list(sim_config.get("derived_variables") or []),
        "event_markers": dict(sim_config.get("event_markers") or {}),
    }


@app.put("/api/designs/{design_name:path}/simulations/{sim_name}/config")
async def update_simulation_config(design_name: str, sim_name: str, body: UpdateSimulationConfigRequest):
    """
    Update a simulation's .sim.json – overwrite charts_to_display and optionally event_markers.
    Preserves display_name, description; replaces charts_to_display with the provided list.
    """
    try:
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        sim_json_path = os.path.join(dir_path, f"{sim_name}.sim.json")
        if not os.path.isfile(sim_json_path):
            raise HTTPException(status_code=404, detail=f"Simulation config not found: {sim_name}")
        with open(sim_json_path, "r") as f:
            sim_config = json.load(f)
        sim_config["charts_to_display"] = body.charts_to_display
        if body.chart_stacks is not None:
            sim_config["chart_stacks"] = body.chart_stacks
        if body.event_markers is not None:
            sim_config["event_markers"] = body.event_markers
        if body.chart_sample_default is not None:
            sim_config["chart_sample_default"] = body.chart_sample_default
        if body.chart_panel_height is not None:
            sim_config["chart_panel_height"] = body.chart_panel_height
        if body.chart_panel_opacity is not None:
            sim_config["chart_panel_opacity"] = body.chart_panel_opacity
        if body.chart_card_width is not None:
            sim_config["chart_card_width"] = int(body.chart_card_width)
        if body.derived_variables is not None:
            sim_config["derived_variables"] = [{"name": d["name"], "formula": d["formula"]} for d in body.derived_variables]

        # Keep the draft snapshot aligned with root keys + optional view_mode from the PUT body.
        _refresh_current_configuration_snapshot(sim_config, body.view_mode)

        with open(sim_json_path, "w") as f:
            json.dump(sim_config, f, indent=2)
        print(f"✅ Updated {sim_name}.sim.json ({len(body.charts_to_display)} charts, current_configuration refresh)")
        return {"design_name": design_name, "sim_name": sim_name, "chart_count": len(body.charts_to_display)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating sim config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _apply_snapshot_to_sim_roots(sim_config: dict, snap: dict) -> None:
    """
    Promote a saved preset dict onto the legacy root fields so existing PUT/GET and the UI keep working unchanged.
    When you pick a saved preset, that preset is stored as a small bundle (a “snapshot”) inside the same .sim.json file. This function copies fields out of that snapshot and pastes them onto the main, top-level keys the app already uses—
    like charts_to_display, panel height/opacity, sample step, stacks, derived variables, and event markers. It uses deep copies for lists and nested objects so editing the live file later doesn’t accidentally change the saved preset in memory. That way the rest of the app can keep reading the same old root shape it always did, without special cases just for presets.

    """
    if "charts_to_display" in snap:
        sim_config["charts_to_display"] = copy.deepcopy(snap["charts_to_display"])
    if "chart_stacks" in snap:
        sim_config["chart_stacks"] = copy.deepcopy(snap["chart_stacks"])
    if "chart_sample_default" in snap:
        sim_config["chart_sample_default"] = snap["chart_sample_default"]
    if "chart_panel_height" in snap:
        sim_config["chart_panel_height"] = snap["chart_panel_height"]
    if "chart_panel_opacity" in snap:
        sim_config["chart_panel_opacity"] = snap["chart_panel_opacity"]
    if "chart_card_width" in snap:
        sim_config["chart_card_width"] = snap["chart_card_width"]
    if "derived_variables" in snap:
        sim_config["derived_variables"] = copy.deepcopy(snap["derived_variables"])
    if "event_markers" in snap:
        sim_config["event_markers"] = copy.deepcopy(snap["event_markers"])


@app.post("/api/designs/{design_name:path}/simulations/{sim_name}/named-configurations")
async def save_named_simulation_configuration(
    design_name: str, sim_name: str, body: SaveNamedSimulationConfigRequest
):
    """
    Store a copy of current_configuration under a new top-level key (e.g. configuration01) inside this scenario's .sim.json.
    """
    try:
        name = body.name.strip()
        _validate_named_configuration_name(name)
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        sim_json_path = os.path.join(dir_path, f"{sim_name}.sim.json")
        if not os.path.isfile(sim_json_path):
            raise HTTPException(status_code=404, detail=f"Simulation config not found: {sim_name}")
        with open(sim_json_path, "r") as f:
            sim_config = json.load(f)
        _normalize_sim_config_current_configuration(sim_config)
        existing = sim_config.get(name)
        if existing is not None:
            if not body.overwrite:
                raise HTTPException(
                    status_code=409,
                    detail=f"Preset '{name}' already exists; resend with overwrite=true to replace it",
                )
            if not _looks_like_configuration_snapshot(existing):
                raise HTTPException(status_code=409, detail=f"Key '{name}' exists but is not a preset snapshot")
        sim_config[name] = copy.deepcopy(sim_config["current_configuration"])
        with open(sim_json_path, "w") as f:
            json.dump(sim_config, f, indent=2)
        keys = _list_named_configuration_keys(sim_config)
        print(f"✅ Saved named simulation preset '{name}' on {sim_name}.sim.json")
        return {"design_name": design_name, "sim_name": sim_name, "name": name, "named_configuration_keys": keys}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error saving named simulation config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/designs/{design_name:path}/simulations/{sim_name}/named-configurations/{config_name}/activate"
)
async def activate_named_simulation_configuration(
    design_name: str, sim_name: str, config_name: str
):
    """
    Copy a saved preset onto the root + current_configuration in the .sim.json file so the app can reload the scenario normally.
    """
    try:
        cfg = config_name.strip()
        _validate_named_configuration_name(cfg)
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        sim_json_path = os.path.join(dir_path, f"{sim_name}.sim.json")
        if not os.path.isfile(sim_json_path):
            raise HTTPException(status_code=404, detail=f"Simulation config not found: {sim_name}")
        with open(sim_json_path, "r") as f:
            sim_config = json.load(f)
        snap = sim_config.get(cfg)
        if not _looks_like_configuration_snapshot(snap):
            raise HTTPException(status_code=404, detail=f"Preset '{cfg}' not found or invalid")
        _apply_snapshot_to_sim_roots(sim_config, snap)
        _refresh_current_configuration_snapshot(sim_config, snap.get("view_mode"))
        with open(sim_json_path, "w") as f:
            json.dump(sim_config, f, indent=2)
        _normalize_sim_config_current_configuration(sim_config)
        keys = _list_named_configuration_keys(sim_config)
        print(f"✅ Activated preset '{cfg}' on {sim_name}.sim.json")
        return {
            "design_name": design_name,
            "sim_name": sim_name,
            "sim_config": sim_config,
            "named_configuration_keys": keys,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error activating named simulation config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/designs/{design_name:path}/simulations/{sim_name}/data")
async def upload_simulation_data(design_name: str, sim_name: str, file: UploadFile = File(...)):
    """
    Upload CSV data for a simulation. Saves to designs/{dir}/{sim_name}.data.csv
    Step 14: Per-sim CSV upload for design dir flow.
    """
    try:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="File must be a CSV (.csv extension)")
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        os.makedirs(dir_path, exist_ok=True)
        safe_sim = re.sub(r'[^\w\-]', '', sim_name) or sim_name or "simulation"
        csv_path = os.path.join(dir_path, f"{safe_sim}.data.csv")
        content = await file.read()
        decoded = content.decode("utf-8-sig").strip()
        if not decoded:
            raise HTTPException(status_code=400, detail="Upload failed: File is empty.")

        first_line = decoded.split("\n")[0] if "\n" in decoded else decoded
        if "," not in first_line and "\t" not in first_line:
            raise HTTPException(
                status_code=400,
                detail="Upload failed: File does not look like CSV (no comma or tab in header). Expected comma-separated columns."
            )

        rows = None
        use_pandas = False

        try:
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
        except Exception:
            use_pandas = True

        if use_pandas:
            try:
                buf = io.StringIO(decoded)
                try:
                    df = pd.read_csv(buf, sep=",")
                except (pd.errors.ParserError, pd.errors.EmptyDataError, ValueError):
                    buf.seek(0)
                    df = pd.read_csv(buf, sep=",", on_bad_lines="skip", engine="python")
                if df.empty:
                    raise HTTPException(status_code=400, detail="Upload failed: No data rows found.")
                if len(df.columns) == 0:
                    raise HTTPException(status_code=400, detail="Upload failed: No columns found. Ensure the first line contains comma-separated column names.")
                rows = df.replace({float("nan"): None}).to_dict("records")
                df.to_csv(csv_path, index=False, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
            except HTTPException:
                raise
            except Exception as pe:
                raise HTTPException(status_code=400, detail=f"Upload failed: {str(pe)}")
        else:
            with open(csv_path, "w", newline="") as f:
                f.write(decoded)
        # Create minimal .sim.json if it doesn't exist (so sim appears in list)
        sim_json_path = os.path.join(dir_path, f"{safe_sim}.sim.json")
        if not os.path.isfile(sim_json_path):
            sim_config = {
                "display_name": sim_name.replace("_", " ").replace("-", " ").title(),
                "description": "",
                "charts_to_display": [],
                "event_markers": {}
            }
            with open(sim_json_path, "w") as f:
                json.dump(sim_config, f, indent=2)
            print(f"   Created {safe_sim}.sim.json")
        print(f"✅ Uploaded {len(rows)} rows to {csv_path}")
        return {"design_name": design_name, "sim_name": safe_sim, "row_count": len(rows)}
    except HTTPException:
        raise
    except UnicodeDecodeError as e:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")
    except Exception as e:
        print(f"❌ Error uploading sim data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/designs/{design_name:path}/simulations/from-xlsx")
async def create_simulations_from_xlsx(design_name: str, file: UploadFile = File(...)):
    """
    Import simulation scenarios from an xlsx file. Each sheet becomes a simulation:
    - Sheet name → simulation name and {SheetName}.data.csv
    - Sheet data → CSV content saved to design dir
    """
    try:
        if not file.filename or not file.filename.lower().endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx)")
        dir_path, _catalog_rel = resolve_design_storage_from_api(design_name)
        if not os.path.isdir(dir_path):
            raise HTTPException(status_code=404, detail=f"Design directory not found: {design_name}")
        content = await file.read()
        xlsx_path = os.path.join(dir_path, "_temp_import.xlsx")
        with open(xlsx_path, "wb") as f:
            f.write(content)
        xl = pd.ExcelFile(xlsx_path, engine="openpyxl")
        sheet_names = xl.sheet_names
        if os.path.isfile(xlsx_path):
            os.remove(xlsx_path)
        if not sheet_names:
            raise HTTPException(status_code=400, detail="No sheets found in the xlsx file.")
        created = []
        for sheet_name in sheet_names:
            df = pd.read_excel(xl, sheet_name=sheet_name, engine="openpyxl")
            if df.empty or len(df.columns) == 0:
                continue
            safe_sim = re.sub(r"[^\w\-]", "", sheet_name) or sheet_name or "simulation"
            csv_path = os.path.join(dir_path, f"{safe_sim}.data.csv")
            df.to_csv(csv_path, index=False, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
            sim_json_path = os.path.join(dir_path, f"{safe_sim}.sim.json")
            if not os.path.isfile(sim_json_path):
                sim_config = {
                    "display_name": sheet_name.replace("_", " ").replace("-", " ").title(),
                    "description": "",
                    "charts_to_display": [],
                    "event_markers": {}
                }
                with open(sim_json_path, "w") as f:
                    json.dump(sim_config, f, indent=2)
            created.append({"name": sheet_name, "rows": len(df)})
            print(f"   Created {safe_sim}.data.csv ({len(df)} rows)")
        print(f"✅ Imported {len(created)} simulation(s) from xlsx")
        return {"design_name": design_name, "created": created}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error importing xlsx: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STARTUP EVENT
# ============================================================================
# This runs once when the server starts up.
# We use this to initialize the database and create necessary directories.
@app.on_event("startup")
async def startup_event():
    """
    Runs when the server starts.
    
    Tasks performed on startup:
    1. Initialize database (create tables if they don't exist)
    2. Create designs directory (per-design structure)
    4. Print helpful startup messages
    """
    print("=" * 60)
    print("🚀 Data Center Power System Backend Starting...")
    print("=" * 60)
    
    # Initialize the database (create tables if they don't exist)
    # This calls database.init_db() which:
    # 1. Imports all models (Configuration)
    # 2. Reads their structure (columns, types, constraints)
    # 3. Creates the corresponding database tables
    # 4. If tables already exist, does nothing (idempotent)
    try:
        init_db()
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("   The server will continue, but database operations may fail.")
    
    # Create designs directory (per-design structure)
    # Each design has its own subdirectory: designs/{design_name}/
    designs_dir = "./designs"
    if not os.path.exists(designs_dir):
        os.makedirs(designs_dir)
        print(f"📁 Created directory: {designs_dir}")
    else:
        print(f"📁 Directory exists: {designs_dir}")
    
    print("=" * 60)
    print("✅ Health check available at: http://localhost:5000/health")
    print("✅ API docs available at: http://localhost:5000/docs")
    print("=" * 60)

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
# When you run: python app.py
# This block executes and starts the server
if __name__ == "__main__":
    import uvicorn
    
    # Run the server on port 5000
    # reload=True means the server restarts when code changes (development mode)
    uvicorn.run(
        "app:app",              # app:app means "from file 'app', load object 'app'"
        host="0.0.0.0",         # Listen on all network interfaces
        port=5000,              # Port 5000 (React is on 3001)
        reload=True             # Auto-reload on code changes
    )
