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

# Import database components
from database import init_db, get_db
# Import database models
from models import Configuration, CSVDataset
# Import Pydantic schemas for request/response validation
from schemas import ConfigurationSaveRequest, ConfigurationResponse, ConfigurationListItem
# Additional imports for CSV handling
from fastapi import File, UploadFile
import csv
import io

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
        # ----------------------------------------------------------------
        # STEP 1: Check if configuration with same name already exists
        # ----------------------------------------------------------------
        existing_config = db.query(Configuration).filter(Configuration.name == config_request.name).first()
        
        if existing_config:
            # ----------------------------------------------------------------
            # UPDATE EXISTING CONFIGURATION
            # ----------------------------------------------------------------
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
            
            # Update backup file
            try:
                sanitized_name = re.sub(r'[^\w\s-]', '', config_request.name)
                sanitized_name = re.sub(r'[\s]+', '_', sanitized_name)
                sanitized_name = sanitized_name.lower()
                
                if not sanitized_name:
                    sanitized_name = f"config_{existing_config.id}"
                
                backup_filename = f"saved_configs/{sanitized_name}.json"
                backup_data = {
                    "id": existing_config.id,
                    "name": existing_config.name,
                    "description": existing_config.description,
                    "data": config_request.data,
                    "created_at": existing_config.created_at.isoformat(),
                    "updated_at": existing_config.updated_at.isoformat()
                }
                
                with open(backup_filename, 'w') as f:
                    json.dump(backup_data, f, indent=2)
                
                print(f"✅ Updated backup file: {backup_filename}")
            except Exception as backup_error:
                print(f"⚠️  Backup file update failed: {backup_error}")
            
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
            # CREATE NEW CONFIGURATION
            # ----------------------------------------------------------------
            print(f"➕ Creating new configuration: '{config_request.name}'")
        
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
        
        # ----------------------------------------------------------------
        # STEP 6: Optionally save a JSON backup file to disk
        # ----------------------------------------------------------------
        # This provides redundancy and makes configurations easy to inspect
        # Format: saved_configs/{sanitized_name}.json
        try:
            # Sanitize the configuration name to make it a valid filename
            # Replace spaces with underscores, remove special characters
            sanitized_name = re.sub(r'[^\w\s-]', '', config_request.name)  # Remove special chars
            sanitized_name = re.sub(r'[\s]+', '_', sanitized_name)  # Replace spaces with underscores
            sanitized_name = sanitized_name.lower()  # Convert to lowercase
            
            # If sanitized name is empty (all special chars), use ID as fallback
            if not sanitized_name:
                sanitized_name = f"config_{new_config.id}"
            
            backup_filename = f"saved_configs/{sanitized_name}.json"
            backup_data = {
                "id": new_config.id,
                "name": new_config.name,
                "description": new_config.description,
                "data": config_request.data,  # Save as dict, not string
                "created_at": new_config.created_at.isoformat(),
                "updated_at": new_config.updated_at.isoformat()
            }
            
            # Write the JSON file with nice formatting (indent=2)
            with open(backup_filename, 'w') as f:
                json.dump(backup_data, f, indent=2)
            
            print(f"✅ Saved backup file: {backup_filename}")
        except Exception as backup_error:
            # If backup fails, log it but don't fail the whole request
            # The database save already succeeded, which is what matters
            print(f"⚠️  Backup file save failed: {backup_error}")
        
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
# GET /api/load/{id} - Load a specific configuration by ID
#
# HOW IT WORKS:
# 1. Frontend requests a configuration by ID (e.g., /api/load/1)
# 2. We query the database for that ID
# 3. If not found, return 404 error
# 4. If found, parse the JSON data string back to a dict
# 5. Return the configuration
#
# EXAMPLE REQUEST (curl):
# curl http://localhost:5000/api/load/1
#
# EXAMPLE RESPONSE (success):
# {
#   "id": 1,
#   "name": "Test Configuration 1",
#   "description": "First test",
#   "data": {"canvasComponents": [...], "connections": [...]},
#   "created_at": "2026-02-04T14:30:00",
#   "updated_at": "2026-02-04T14:30:00"
# }
#
# EXAMPLE RESPONSE (not found):
# {
#   "detail": "Configuration with ID 999 not found"
# }

# ============================================================================
# HELPER FUNCTION: AUTO-LOAD CSV FOR CONFIGURATION
# ============================================================================

def auto_load_csv_for_config(config_name: str, db: Session):
    """
    Automatically load the corresponding CSV file for a configuration.
    
    CSV filename must match configuration name exactly.
    Example: Configuration "Tier III Data Center - Horizontal Layout" 
             → CSV "Tier III Data Center - Horizontal Layout.csv"
    
    Args:
        config_name: Name of the configuration (exact match)
        db: Database session
    
    Returns:
        dict: {"loaded": bool, "csv_name": str, "message": str}
    """
    try:
        # CSV filename = configuration name + .csv extension (exact match)
        csv_filename = f"{config_name}.csv"
        csv_path = os.path.join("saved_csv", csv_filename)
        
        # Check if CSV file exists
        if not os.path.exists(csv_path):
            return {
                "loaded": False,
                "csv_name": None,
                "message": f"No CSV file found: '{csv_filename}'"
            }
        
        # CSV file exists - check if already in database
        existing_csv = db.query(CSVDataset).filter(CSVDataset.name == csv_filename).first()
        
        if existing_csv:
            # Already loaded
            return {
                "loaded": True,
                "csv_name": csv_filename,
                "message": f"CSV '{csv_filename}' already loaded (ID: {existing_csv.id})"
            }
        
        # CSV exists but not in database - load it now
        print(f"📂 Auto-loading CSV: {csv_filename}")
        
        # Read and parse CSV
        with open(csv_path, 'r') as f:
            csv_reader = csv.DictReader(f)
            columns = csv_reader.fieldnames
            rows = list(csv_reader)
        
        # Create CSVDataset record
        new_csv = CSVDataset(
            name=csv_filename,
            file_path=csv_path,
            columns=json.dumps(columns),
            data_json=json.dumps(rows),
            row_count=len(rows)
        )
        
        db.add(new_csv)
        db.commit()
        db.refresh(new_csv)
        
        print(f"✅ Auto-loaded CSV: {csv_filename} ({len(rows)} rows)")
        
        return {
            "loaded": True,
            "csv_name": csv_filename,
            "message": f"CSV '{csv_filename}' auto-loaded successfully ({len(rows)} rows)"
        }
        
    except Exception as e:
        print(f"❌ Error auto-loading CSV: {e}")
        import traceback
        traceback.print_exc()
        return {
            "loaded": False,
            "csv_name": None,
            "message": f"Error: {str(e)}"
        }


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
        # STEP 4: Create the response object
        # ----------------------------------------------------------------
        # Build a ConfigurationResponse with all the data
        response_config = ConfigurationResponse(
            id=config.id,
            name=config.name,
            description=config.description,
            data=parsed_data,  # Use the parsed dict, not the JSON string
            created_at=config.created_at,
            updated_at=config.updated_at
        )
        
        print(f"✅ Configuration loaded: ID={config.id}, Name='{config.name}'")
        
        # ----------------------------------------------------------------
        # STEP 5: Auto-load corresponding CSV if available
        # ----------------------------------------------------------------
        # Try to automatically load the CSV file that matches this configuration
        csv_result = auto_load_csv_for_config(config.name, db)
        if csv_result["loaded"]:
            print(f"   📊 {csv_result['message']}")
        
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
        
        # ----------------------------------------------------------------
        # STEP 4: Delete backup JSON file (if it exists)
        # ----------------------------------------------------------------
        # Try to find and delete the backup file
        # First, try using sanitized name (new format)
        # Then fall back to old format (config_ID.json) for backwards compatibility
        try:
            # Sanitize the configuration name (same logic as save)
            sanitized_name = re.sub(r'[^\w\s-]', '', config_name)  # Remove special chars
            sanitized_name = re.sub(r'[\s]+', '_', sanitized_name)  # Replace spaces with underscores
            sanitized_name = sanitized_name.lower()  # Convert to lowercase
            
            # Try new format first
            backup_filename = f"saved_configs/{sanitized_name}.json"
            if os.path.exists(backup_filename):
                os.remove(backup_filename)
                print(f"✅ Deleted backup file: {backup_filename}")
            else:
                # Try old format (config_ID.json) for backwards compatibility
                backup_filename_old = f"saved_configs/config_{config_id}.json"
                if os.path.exists(backup_filename_old):
                    os.remove(backup_filename_old)
                    print(f"✅ Deleted backup file (old format): {backup_filename_old}")
                else:
                    print(f"ℹ️  No backup file to delete")
        except Exception as backup_error:
            # If backup deletion fails, log it but don't fail the whole request
            # The database deletion already succeeded, which is what matters
            print(f"⚠️  Backup file deletion failed: {backup_error}")
        
        # ----------------------------------------------------------------
        # STEP 5: Return success message
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
# CSV UPLOAD ENDPOINT
# ============================================================================
# POST /api/csv/upload - Upload a CSV file and store it in the database
#
# HOW IT WORKS:
# 1. User uploads a CSV file through frontend
# 2. We parse the CSV to extract columns and data
# 3. We store the data as JSON in the database
# 4. We save the original CSV file to saved_csv/ directory
# 5. We return metadata about the uploaded dataset
#
# EXAMPLE REQUEST (curl):
# curl -X POST http://localhost:5000/api/csv/upload \
#   -F "file=@solar_data.csv"
#
# EXAMPLE RESPONSE:
# {
#   "id": 1,
#   "name": "solar_data.csv",
#   "columns": ["time_sec", "power_mw", "voltage_kv"],
#   "row_count": 8640,
#   "uploaded_at": "2026-02-06T04:00:00"
# }
# ============================================================================
# CSV UPLOAD ENDPOINT
# ============================================================================
# POST /api/csv/upload - Upload a CSV file and store it in the database
#
# 🌐 HOW FILE UPLOAD WORKS (Client → Server):
# ============================================================================
# IMPORTANT: The browser does NOT send a "file path" to the server!
# 
# Here's what actually happens:
#
# 1. USER ACTION (Client Side):
#    - User clicks "Upload CSV" button in browser
#    - Browser opens file picker dialog
#    - User selects: /Users/john/Desktop/solar_data.csv
#
# 2. BROWSER BEHAVIOR (Client Side):
#    - Browser reads the ENTIRE FILE CONTENT into memory
#    - Browser creates an HTTP POST request with:
#      a) File content as binary data (the actual bytes of the CSV)
#      b) File metadata in HTTP headers (filename, content-type, size)
#    - Browser sends this data over the network to the server
#
# 3. NETWORK TRANSMISSION:
#    - The file travels as HTTP "multipart/form-data" 
#    - This is a special encoding that packages files for web transmission
#    - Example HTTP request:
#      POST /api/csv/upload HTTP/1.1
#      Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
#      
#      ------WebKitFormBoundary
#      Content-Disposition: form-data; name="file"; filename="solar_data.csv"
#      Content-Type: text/csv
#      
#      time_sec,power_mw
#      0,0.0
#      10,1.2
#      ... (all file content here) ...
#      ------WebKitFormBoundary--
#
# 4. SERVER RECEPTION (This Code):
#    - FastAPI receives the HTTP request
#    - The 'file: UploadFile' parameter automatically:
#      a) Extracts the file content from the request body
#      b) Extracts the filename from HTTP headers ("solar_data.csv")
#      c) Provides methods to read the content (file.read(), file.seek())
#    - The server NEVER sees the client's local path (/Users/john/Desktop/...)
#    - Only the filename ("solar_data.csv") and content are transmitted
#
# 5. SERVER STORAGE:
#    - We save the file content to OUR disk (server's saved_csv/ directory)
#    - We parse the CSV and store data in OUR database
#
# 🔒 SECURITY NOTE:
# The server cannot and should not see the client's local file path.
# This is a security feature - prevents the server from knowing the
# client's directory structure or username.
#
# 🎯 KEY TAKEAWAY:
# UploadFile = The file CONTENT + filename, NOT a path!
# The "file path" on the client machine is never transmitted to the server.
#
# ============================================================================
#
# EXAMPLE REQUEST (curl):
# curl -X POST http://localhost:5000/api/csv/upload \
#   -F "file=@solar_data.csv"
#
# The @ symbol tells curl to read the file content and send it.
# The server receives the content, not the path.
#
# EXAMPLE RESPONSE:
# {
#   "id": 1,
#   "name": "solar_data.csv",
#   "columns": ["time_sec", "power_mw", "voltage_kv"],
#   "row_count": 8640,
#   "uploaded_at": "2026-02-06T04:00:00"
# }
@app.post("/api/csv/upload")
async def upload_csv(
    file: UploadFile = File(...),  # FastAPI extracts file content from HTTP request
    db: Session = Depends(get_db)
):
    """
    Upload a CSV file and store it in the database.
    
    HOW THE 'file' PARAMETER WORKS:
    ================================
    - 'file: UploadFile' is a FastAPI special type
    - It automatically extracts the uploaded file from the HTTP request
    - Properties available:
      * file.filename: The original filename (e.g., "solar_data.csv")
      * file.content_type: MIME type (e.g., "text/csv")
      * file.read(): Returns the file content as bytes
      * file.seek(0): Resets read position to beginning
    
    - The UploadFile object contains the FILE CONTENT, not a path
    - Think of it like: UploadFile = {filename: "solar.csv", content: bytes}
    
    This endpoint:
    1. Validates the CSV file format
    2. Parses the CSV data (reads content, not path!)
    3. Checks for name conflicts (same filename already exists)
    4. Stores data as JSON in the database
    5. Saves the CSV file to our server's disk (saved_csv/ directory)
    6. Returns metadata about the uploaded dataset
    
    Args:
        file: The uploaded CSV file (content + metadata, NOT a path)
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        dict: Metadata about the uploaded CSV dataset
    
    Raises:
        HTTPException 400: If file is not a CSV or has invalid format
        HTTPException 409: If CSV with same name already exists
        HTTPException 500: If database or file save fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Validate file is a CSV
        # ----------------------------------------------------------------
        # file.filename = The original filename from the client's computer
        # Example: "solar_data.csv"
        # We only get the NAME, not the full path (for security)
        if not file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=400,
                detail="File must be a CSV file (*.csv)"
            )
        
        # ----------------------------------------------------------------
        # STEP 2: Read and parse CSV content
        # ----------------------------------------------------------------
        # Read file content as bytes, then decode to string
        # await file.read() = Reads the ENTIRE file content sent by browser
        # This might be 1 MB, 10 MB, etc. - the actual CSV data
        contents = await file.read()
        decoded_content = contents.decode('utf-8')
        
        # Now 'decoded_content' is a string containing the full CSV:
        # "time_sec,power_mw\n0,0.0\n10,1.2\n20,2.5\n..."
        
        # Parse CSV using Python's csv.DictReader
        # DictReader treats first row as headers and returns each row as a dict
        # Example row: {"time_sec": "0", "power_mw": "0.0"}
        csv_reader = csv.DictReader(io.StringIO(decoded_content))
        
        # Extract column names from header row
        # Example: ["time_sec", "power_mw", "voltage_kv"]
        columns = csv_reader.fieldnames
        if not columns:
            raise HTTPException(
                status_code=400,
                detail="CSV file has no header row (column names)"
            )
        
        # Read all data rows into a list of dictionaries
        # This loops through every row in the CSV
        data_rows = []
        for row in csv_reader:
            # Convert each row to dict with proper data types
            # CSV stores everything as strings, we try to convert to numbers
            parsed_row = {}
            for col_name, value in row.items():
                # Try to convert to float if possible, otherwise keep as string
                try:
                    parsed_row[col_name] = float(value)
                except (ValueError, TypeError):
                    parsed_row[col_name] = value
            data_rows.append(parsed_row)
        
        # Example data_rows after parsing:
        # [
        #   {"time_sec": 0.0, "power_mw": 0.0},
        #   {"time_sec": 10.0, "power_mw": 1.2},
        #   ...
        # ]
        
        row_count = len(data_rows)
        
        if row_count == 0:
            raise HTTPException(
                status_code=400,
                detail="CSV file has no data rows"
            )
        
        print(f"📊 Parsed CSV: {file.filename}")
        print(f"   Columns: {columns}")
        print(f"   Rows: {row_count:,}")
        
        # ----------------------------------------------------------------
        # STEP 3: Check if CSV with same name already exists
        # ----------------------------------------------------------------
        existing_csv = db.query(CSVDataset).filter(CSVDataset.name == file.filename).first()
        
        if existing_csv:
            raise HTTPException(
                status_code=409,
                detail=f"CSV file '{file.filename}' already exists. Please rename the file or delete the existing one first."
            )
        
        # ----------------------------------------------------------------
        # STEP 4: Convert data to JSON and store in database
        # ----------------------------------------------------------------
        # Convert Python list/dict to JSON strings for storage
        columns_json = json.dumps(columns)
        data_json = json.dumps(data_rows)
        
        # Define where we'll save the CSV file on our server
        file_path = f"saved_csv/{file.filename}"
        
        # Create database record
        new_csv = CSVDataset(
            name=file.filename,
            file_path=file_path,
            columns=columns_json,
            data_json=data_json,
            row_count=row_count
        )
        
        db.add(new_csv)
        db.commit()
        db.refresh(new_csv)
        
        print(f"✅ Stored in database: {file.filename}")
        
        # ----------------------------------------------------------------
        # STEP 5: Save CSV file to disk (our server's disk, not client's!)
        # ----------------------------------------------------------------
        try:
            # Save the original CSV file to saved_csv/ directory
            # This creates a backup copy on our server
            with open(file_path, 'wb') as f:
                # Reset file pointer to beginning
                # (we already read it once in step 2, so need to rewind)
                await file.seek(0)
                content = await file.read()
                f.write(content)
            
            print(f"✅ Saved to disk: {file_path}")
        except Exception as file_error:
            print(f"⚠️  Failed to save CSV file to disk: {file_error}")
            # Continue anyway - database storage is what matters
        
        # ----------------------------------------------------------------
        # STEP 6: Return metadata
        # ----------------------------------------------------------------
        return {
            "id": new_csv.id,
            "name": new_csv.name,
            "file_path": new_csv.file_path,
            "columns": columns,  # Return as array, not JSON string
            "row_count": new_csv.row_count,
            "uploaded_at": new_csv.uploaded_at.isoformat()
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions (400, 409) as-is
        raise
    except Exception as e:
        # Catch any unexpected errors
        print(f"❌ Error uploading CSV: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload CSV: {str(e)}"
        )

# ============================================================================
# CSV LIST ENDPOINT
# ============================================================================
# GET /api/csv/list - Get a list of all uploaded CSV datasets
#
# HOW IT WORKS:
# 1. Query database for all CSV datasets
# 2. Return metadata only (name, columns, row count)
# 3. Do NOT return the full data (can be very large)
# 4. Order by upload date (newest first)
#
# WHY EXCLUDE FULL DATA?
# - CSV data can be huge (8,640 rows = several MB)
# - Listing all CSVs with full data would be very slow
# - Frontend only needs metadata to show in picker dialog
# - Full data is loaded separately when user selects a CSV
#
# EXAMPLE REQUEST (curl):
# curl http://localhost:5000/api/csv/list
#
# EXAMPLE RESPONSE:
# [
#   {
#     "id": 3,
#     "name": "wind_24hr_realistic.csv",
#     "columns": ["time_sec", "hour_of_day", "power_mw", "wind_speed_mph"],
#     "row_count": 8640,
#     "uploaded_at": "2026-02-06T06:00:00"
#   },
#   {
#     "id": 2,
#     "name": "solar_24hr_realistic.csv",
#     "columns": ["time_sec", "hour_of_day", "power_mw", "irradiance_w_m2"],
#     "row_count": 8640,
#     "uploaded_at": "2026-02-06T05:00:00"
#   }
# ]
@app.get("/api/csv/list")
async def list_csv_datasets(db: Session = Depends(get_db)):
    """
    Get a list of all uploaded CSV datasets (metadata only).
    
    This endpoint:
    1. Queries the database for all CSV datasets
    2. Returns only metadata (id, name, columns, row count, upload time)
    3. Excludes the full data field (for performance)
    4. Orders by upload date (newest first)
    
    Use this to show users a list of available CSV datasets when
    they want to associate a chart with a component.
    
    Args:
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        list: List of CSV dataset metadata objects
    
    Raises:
        HTTPException 500: If database query fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query all CSV datasets from database
        # ----------------------------------------------------------------
        # This generates SQL: SELECT * FROM csv_datasets ORDER BY uploaded_at DESC
        # .all() returns a list of all matching records
        # .order_by(...desc()) sorts newest first
        csv_datasets = db.query(CSVDataset).order_by(CSVDataset.uploaded_at.desc()).all()
        
        # ----------------------------------------------------------------
        # STEP 2: Convert to response format (metadata only)
        # ----------------------------------------------------------------
        # We exclude the full data_json field (can be huge)
        # Only return what the frontend needs for the picker dialog
        result = []
        for csv_dataset in csv_datasets:
            # Parse columns JSON string back to array
            columns = json.loads(csv_dataset.columns)
            
            item = {
                "id": csv_dataset.id,
                "name": csv_dataset.name,
                "file_path": csv_dataset.file_path,
                "columns": columns,  # Return as array
                "row_count": csv_dataset.row_count,
                "uploaded_at": csv_dataset.uploaded_at.isoformat()
            }
            result.append(item)
        
        print(f"✅ Listed {len(result)} CSV dataset(s)")
        
        return result
        
    except Exception as e:
        # Database or other unexpected error
        print(f"❌ Error listing CSV datasets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list CSV datasets: {str(e)}"
        )

# ============================================================================
# CSV DATA RETRIEVAL ENDPOINT
# ============================================================================
# GET /api/csv/{name} - Get full data for a specific CSV dataset
#
# HOW IT WORKS:
# 1. Extract CSV name from URL path parameter
# 2. Query database for that specific CSV dataset
# 3. Return full data (all rows) as JSON array
# 4. Frontend uses this to show preview or load data for plotting
#
# WHY SEPARATE FROM LIST ENDPOINT?
# - CSV data can be huge (8,640 rows = several MB)
# - We only load full data when user needs it (on-demand)
# - List endpoint shows metadata only (for picker dialog)
# - This endpoint loads everything (for preview or chart rendering)
#
# EXAMPLE REQUEST (curl):
# curl http://localhost:5000/api/csv/solar_24hr_realistic.csv
#
# EXAMPLE RESPONSE:
# {
#   "id": 1,
#   "name": "solar_24hr_realistic.csv",
#   "columns": ["time_sec", "hour_of_day", "power_mw", "irradiance_w_m2"],
#   "row_count": 8640,
#   "uploaded_at": "2026-02-06T05:00:00",
#   "data": [
#     {"time_sec": 0, "hour_of_day": 0.0, "power_mw": 0.0, "irradiance_w_m2": 0.0},
#     {"time_sec": 10, "hour_of_day": 0.00278, "power_mw": 0.0, "irradiance_w_m2": 0.0},
#     ...
#   ]
# }
@app.get("/api/csv/{name}")
async def get_csv_data(name: str, db: Session = Depends(get_db)):
    """
    Get full data for a specific CSV dataset by name.
    
    This endpoint:
    1. Looks up the CSV dataset by name in the database
    2. Returns the full metadata AND all data rows
    3. Data is returned as a JSON array of objects
    
    Use this when:
    - User wants to preview CSV data before associating with component
    - Frontend needs to load data for plotting (during simulation)
    - User wants to inspect what columns/values are available
    
    Args:
        name: CSV dataset name (from URL path, e.g., "solar_24hr_realistic.csv")
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        dict: Full CSV dataset including metadata and all data rows
    
    Raises:
        HTTPException 404: If CSV dataset not found
        HTTPException 500: If database query or JSON parsing fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query database for this specific CSV by name
        # ----------------------------------------------------------------
        # This generates SQL: SELECT * FROM csv_datasets WHERE name = ?
        # .first() returns the first matching record (or None if not found)
        csv_dataset = db.query(CSVDataset).filter(CSVDataset.name == name).first()
        
        # ----------------------------------------------------------------
        # STEP 2: Check if CSV exists
        # ----------------------------------------------------------------
        if not csv_dataset:
            # No CSV with this name found in database
            print(f"❌ CSV dataset not found: {name}")
            raise HTTPException(
                status_code=404,
                detail=f"CSV dataset '{name}' not found"
            )
        
        # ----------------------------------------------------------------
        # STEP 3: Parse JSON strings back to Python objects
        # ----------------------------------------------------------------
        # Database stores columns and data as JSON strings
        # We need to convert them back to Python list/dict for response
        columns = json.loads(csv_dataset.columns)
        data_rows = json.loads(csv_dataset.data_json)
        
        # ----------------------------------------------------------------
        # STEP 4: Build response with full data
        # ----------------------------------------------------------------
        result = {
            "id": csv_dataset.id,
            "name": csv_dataset.name,
            "file_path": csv_dataset.file_path,
            "columns": columns,
            "row_count": csv_dataset.row_count,
            "uploaded_at": csv_dataset.uploaded_at.isoformat(),
            "data": data_rows  # Full data array (can be large!)
        }
        
        print(f"✅ Retrieved CSV data: {name} ({csv_dataset.row_count} rows)")
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        # Database or JSON parsing error
        print(f"❌ Error retrieving CSV data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve CSV data: {str(e)}"
        )

# ============================================================================
# CSV DELETE ENDPOINT
# ============================================================================
# DELETE /api/csv/{name} - Delete a specific CSV dataset
#
# HOW IT WORKS:
# 1. Extract CSV name from URL path parameter
# 2. Query database for that specific CSV dataset
# 3. Delete the file from disk (saved_csv/ directory)
# 4. Delete the database record
# 5. Return success confirmation
#
# WHY DELETE BOTH DATABASE AND FILE?
# - Database record contains metadata and parsed data
# - File on disk is the original CSV (for backup/inspection)
# - Both must be deleted to fully remove the dataset
# - If file doesn't exist, we still delete the DB record (silent fail)
#
# EXAMPLE REQUEST (curl):
# curl -X DELETE http://localhost:5000/api/csv/solar_24hr_realistic.csv
#
# EXAMPLE RESPONSE:
# {
#   "message": "CSV dataset deleted successfully",
#   "name": "solar_24hr_realistic.csv",
#   "file_deleted": true
# }
@app.delete("/api/csv/{name}")
async def delete_csv_data(name: str, db: Session = Depends(get_db)):
    """
    Delete a specific CSV dataset by name.
    
    This endpoint:
    1. Looks up the CSV dataset by name in the database
    2. Deletes the physical file from disk (if it exists)
    3. Deletes the database record
    4. Returns confirmation
    
    Use this when:
    - User wants to remove a CSV dataset
    - User wants to overwrite an existing CSV (delete then re-upload)
    - Cleanup of old/unused datasets
    
    Args:
        name: CSV dataset name (from URL path, e.g., "solar_24hr_realistic.csv")
        db: Database session (injected by FastAPI via Depends)
    
    Returns:
        dict: Confirmation message with deletion status
    
    Raises:
        HTTPException 404: If CSV dataset not found
        HTTPException 500: If database deletion or file deletion fails
    """
    try:
        # ----------------------------------------------------------------
        # STEP 1: Query database for this specific CSV by name
        # ----------------------------------------------------------------
        csv_dataset = db.query(CSVDataset).filter(CSVDataset.name == name).first()
        
        # ----------------------------------------------------------------
        # STEP 2: Check if CSV exists
        # ----------------------------------------------------------------
        if not csv_dataset:
            print(f"❌ CSV dataset not found: {name}")
            raise HTTPException(
                status_code=404,
                detail=f"CSV dataset '{name}' not found"
            )
        
        # ----------------------------------------------------------------
        # STEP 3: Delete the physical file from disk (if it exists)
        # ----------------------------------------------------------------
        file_deleted = False
        if csv_dataset.file_path and os.path.exists(csv_dataset.file_path):
            try:
                os.remove(csv_dataset.file_path)
                file_deleted = True
                print(f"✅ Deleted file: {csv_dataset.file_path}")
            except Exception as e:
                # File deletion failed, but continue with DB deletion
                print(f"⚠️  Failed to delete file: {e}")
        else:
            print(f"ℹ️  No file to delete (path: {csv_dataset.file_path})")
        
        # ----------------------------------------------------------------
        # STEP 4: Delete the database record
        # ----------------------------------------------------------------
        db.delete(csv_dataset)
        db.commit()
        
        print(f"✅ Deleted CSV dataset: {name}")
        
        # ----------------------------------------------------------------
        # STEP 5: Return confirmation
        # ----------------------------------------------------------------
        return {
            "message": "CSV dataset deleted successfully",
            "name": name,
            "file_deleted": file_deleted
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        # Database or file system error
        print(f"❌ Error deleting CSV data: {e}")
        db.rollback()  # Rollback any partial database changes
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete CSV data: {str(e)}"
        )

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
    2. Create saved_configs directory (for configuration file backups)
    3. Create saved_csv directory (for CSV time-series data)
    4. Print helpful startup messages
    """
    print("=" * 60)
    print("🚀 Data Center Power System Backend Starting...")
    print("=" * 60)
    
    # Initialize the database (create tables if they don't exist)
    # This calls database.init_db() which:
    # 1. Imports all models (Configuration, CSVDataset, ChartAssociation)
    # 2. Reads their structure (columns, types, constraints)
    # 3. Creates the corresponding database tables
    # 4. If tables already exist, does nothing (idempotent)
    try:
        init_db()
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("   The server will continue, but database operations may fail.")
    
    # Create saved_configs directory if it doesn't exist
    # This directory stores JSON files as backups/redundancy for configurations
    saved_configs_dir = "./saved_configs"
    if not os.path.exists(saved_configs_dir):
        os.makedirs(saved_configs_dir)
        print(f"📁 Created directory: {saved_configs_dir}")
    else:
        print(f"📁 Directory exists: {saved_configs_dir}")
    
    # Create saved_csv directory if it doesn't exist
    # This directory stores uploaded CSV files for time-series data
    saved_csv_dir = "./saved_csv"
    if not os.path.exists(saved_csv_dir):
        os.makedirs(saved_csv_dir)
        print(f"📁 Created directory: {saved_csv_dir}")
    else:
        print(f"📁 Directory exists: {saved_csv_dir}")
    
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
