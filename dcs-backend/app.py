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
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import json
import os
import re
import shutil

# Import database components
from database import init_db, get_db
# Import database models (Configuration only; designs/ flow uses files, not DB for CSV/sim)
from models import Configuration
# Import Pydantic schemas for request/response validation
from schemas import ConfigurationSaveRequest, ConfigurationResponse, ConfigurationListItem, CreateSimulationRequest, UpdateSimulationConfigRequest
# Additional imports for CSV handling
from fastapi import File, UploadFile
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
    Returns True if copied, False if source doesn't exist or copy failed.
    """
    try:
        src_dir = sanitize_design_name(source_name)
        dst_dir = sanitize_design_name(dest_name)
        src_path = os.path.join(DESIGNS_ROOT, src_dir)
        dst_path = os.path.join(DESIGNS_ROOT, dst_dir)
        src_abs = os.path.abspath(src_path)
        dst_abs = os.path.abspath(dst_path)
        cwd = os.getcwd()
        print(f"[DEBUG] copy_design_dir: cwd={cwd}")
        print(f"[DEBUG] copy_design_dir: src_path={src_path} -> abs={src_abs}")
        print(f"[DEBUG] copy_design_dir: dst_path={dst_path} -> abs={dst_abs}")
        if src_dir == dst_dir:
            print(f"[DEBUG] copy_design_dir: SKIP (src==dst)")
            return False
        if not os.path.isdir(src_path):
            print(f"[DEBUG] copy_design_dir: SKIP (source dir does not exist)")
            return False
        if os.path.exists(dst_path):
            shutil.rmtree(dst_path)
        os.makedirs(dst_path, exist_ok=True)
        # Copy all files except .conf.json (we'll create fresh with new name)
        src_conf = os.path.join(src_path, f"{src_dir}.conf.json")
        for f in os.listdir(src_path):
            src_f = os.path.join(src_path, f)
            if os.path.isfile(src_f) and not f.endswith(".conf.json"):
                shutil.copy2(src_f, os.path.join(dst_path, f))
        # Copy and adapt conf file: {src_dir}.conf.json -> {dst_dir}.conf.json with new name
        if os.path.isfile(src_conf):
            with open(src_conf, "r") as f:
                conf = json.load(f)
            conf["name"] = dest_name
            dst_conf = os.path.join(dst_path, f"{dst_dir}.conf.json")
            with open(dst_conf, "w") as f:
                json.dump(conf, f, indent=2)
        print(f"✅ Copied design dir: {src_dir} -> {dst_dir}")
        return True
    except Exception as e:
        print(f"⚠️  Copy design dir failed: {e}")
        return False


def save_config_to_design_dir(config_name: str, description, data: dict):
    """
    Save configuration to designs/{design_dir}/{design_dir}.conf.json
    Creates design directory if it doesn't exist.
    Returns the design_dir path used, or None on failure.
    """
    try:
        cwd = os.getcwd()
        design_dir = sanitize_design_name(config_name)
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
        conf_path = os.path.join(dir_path, f"{design_dir}.conf.json")
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
        return design_dir
    except Exception as e:
        print(f"⚠️  Design dir save failed: {e}")
        import traceback
        traceback.print_exc()
        return None


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
            "load": "/api/load/{id}",
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
            
            # Save to design dir (per-design structure)
            print(f"[DEBUG] SAVE (UPDATE): Calling save_config_to_design_dir for '{config_request.name}'")
            save_config_to_design_dir(
                config_request.name,
                config_request.description,
                config_request.data
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
        
        # Save to design dir (per-design structure)
        print(f"[DEBUG] SAVE (CREATE): Calling save_config_to_design_dir for '{config_request.name}'")
        save_config_to_design_dir(
            config_request.name,
            config_request.description,
            config_request.data
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
    db: Session = Depends(get_db)
):
    """
    Load a specific power system configuration by its ID.
    
    This endpoint:
    1. Queries the database for a configuration with the given ID
    2. Returns 404 if the configuration doesn't exist
    3. Parses the stored JSON string back to a Python dict
    4. Returns the full configuration with all metadata
    
    Args:
        config_id: The unique ID of the configuration to load (from URL path)
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
        # STEP 3: Parse the JSON data string back to a dict
        # ----------------------------------------------------------------
        # In the database, 'data' is stored as a JSON string
        # We need to convert it back to a Python dict for the response
        # json.loads() converts JSON string → Python dict
        # Example: '{"key": "value"}' → {"key": "value"}
        try:
            parsed_data = json.loads(config.data)
        except json.JSONDecodeError as json_error:
            # This shouldn't happen if data was saved correctly
            # But handle it gracefully just in case
            print(f"❌ JSON parsing error for config ID {config_id}: {json_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Configuration data is corrupted (invalid JSON)"
            )
        
        # ----------------------------------------------------------------
        # STEP 4: Check if design uses new per-design directory structure
        # ----------------------------------------------------------------
        design_dir = sanitize_design_name(config.name)
        design_dir_path = os.path.join(DESIGNS_ROOT, design_dir)
        uses_design_dir = os.path.isdir(design_dir_path)
        
        csv_status = {}
        if not uses_design_dir:
            raise HTTPException(
                status_code=404,
                detail=f"Design directory not found for '{config.name}'. Configurations must have a design folder at designs/{design_dir}/"
            )
        list_result = _list_design_simulations(config.name)
        csv_status = {
            "exists": False,
            "csv_name": None,
            "message": "Design uses per-simulation files (click a simulation to load data)",
            "use_design_dir": True,
            "design_name": config.name,
            "available_simulations": list_result.get("simulations", [])
        }
        print(f"   ✅ Design dir found: {design_dir} ({len(csv_status['available_simulations'])} simulations)")
        
        # ----------------------------------------------------------------
        # STEP 6: Create the response object
        # ----------------------------------------------------------------
        # Build a ConfigurationResponse with all the data
        response_config = ConfigurationResponse(
            id=config.id,
            name=config.name,
            description=config.description,
            data=parsed_data,  # Use the parsed dict, not the JSON string
            created_at=config.created_at,
            updated_at=config.updated_at,
            csv_status=csv_status,
            sim_config=None  # Sim config comes from .sim.json when run
        )
        
        print(f"✅ Configuration loaded: ID={config.id}, Name='{config.name}'")
        
        return response_config
        
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

def _list_design_simulations(design_name: str) -> dict:
    """Sync helper to list simulations in a design dir."""
    design_dir = sanitize_design_name(design_name)
    dir_path = os.path.join(DESIGNS_ROOT, design_dir)
    if not os.path.isdir(dir_path):
        return {"design_name": design_name, "design_dir": design_dir, "simulations": []}
    simulations = []
    for f in os.listdir(dir_path):
        if f.endswith(".sim.json"):
            sim_name = f[:-9]
            sim_path = os.path.join(dir_path, f)
            try:
                with open(sim_path, "r") as fp:
                    sim_config = json.load(fp)
                display_name = sim_config.get("display_name", sim_name)
            except Exception:
                display_name = sim_name
            description = sim_config.get("description", "")
            simulations.append({"id": sim_name, "display_name": display_name, "description": description})
    simulations.sort(key=lambda s: s["display_name"])
    return {"design_name": design_name, "design_dir": design_dir, "simulations": simulations}


@app.get("/api/designs/{design_name}/simulations")
async def list_design_simulations(design_name: str):
    """
    List available simulations for a design by scanning the design directory.
    """
    try:
        return _list_design_simulations(design_name)
    except Exception as e:
        print(f"❌ Error listing simulations for {design_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list simulations: {str(e)}"
        )


@app.get("/api/designs/{design_name}/simulations/{sim_name}")
async def load_design_simulation(design_name: str, sim_name: str):
    """
    Load a specific simulation: .sim.json config + .data.csv data.
    
    Returns both the simulation config (charts, event_markers) and the CSV data rows.
    Used when user clicks a simulation button - no DB, all from design dir.
    """
    try:
        design_dir = sanitize_design_name(design_name)
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
        
        if not os.path.isdir(dir_path):
            raise HTTPException(
                status_code=404,
                detail=f"Design directory not found: {design_name}"
            )
        
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
            "row_count": len(data_rows)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error loading simulation {design_name}/{sim_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load simulation: {str(e)}"
        )


@app.post("/api/designs/{design_name}/simulations")
async def create_simulation(design_name: str, body: CreateSimulationRequest):
    """
    Create a new simulation (empty .sim.json). Enables adding scenarios before uploading CSV.
    """
    try:
        sim_name = body.name.strip()
        design_dir = sanitize_design_name(design_name)
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
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


# ============================================================================
# STEP 3: Update simulation config (charts_to_display, event_markers)
# ============================================================================
# When the user adds or removes charts in the UI, we need to persist the new
# configuration back to the .sim.json file. This endpoint reads the existing
# file, merges in the new charts_to_display (and optionally event_markers),
# and overwrites the file so the changes survive a reload.
# ============================================================================

@app.put("/api/designs/{design_name}/simulations/{sim_name}/config")
async def update_simulation_config(design_name: str, sim_name: str, body: UpdateSimulationConfigRequest):
    """
    Update a simulation's .sim.json – overwrite charts_to_display and optionally event_markers.
    Preserves display_name, description; replaces charts_to_display with the provided list.
    """
    try:
        design_dir = sanitize_design_name(design_name)
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
        sim_json_path = os.path.join(dir_path, f"{sim_name}.sim.json")
        if not os.path.isfile(sim_json_path):
            raise HTTPException(status_code=404, detail=f"Simulation config not found: {sim_name}")
        with open(sim_json_path, "r") as f:
            sim_config = json.load(f)
        sim_config["charts_to_display"] = body.charts_to_display
        if body.event_markers is not None:
            sim_config["event_markers"] = body.event_markers
        if body.chart_sample_default is not None:
            sim_config["chart_sample_default"] = body.chart_sample_default
        with open(sim_json_path, "w") as f:
            json.dump(sim_config, f, indent=2)
        print(f"✅ Updated {sim_name}.sim.json ({len(body.charts_to_display)} charts)")
        return {"design_name": design_name, "sim_name": sim_name, "chart_count": len(body.charts_to_display)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating sim config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/designs/{design_name}/simulations/{sim_name}/data")
async def upload_simulation_data(design_name: str, sim_name: str, file: UploadFile = File(...)):
    """
    Upload CSV data for a simulation. Saves to designs/{dir}/{sim_name}.data.csv
    Step 14: Per-sim CSV upload for design dir flow.
    """
    try:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="File must be a CSV (.csv extension)")
        design_dir = sanitize_design_name(design_name)
        dir_path = os.path.join(DESIGNS_ROOT, design_dir)
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
