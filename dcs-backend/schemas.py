"""
PYDANTIC SCHEMAS - Request/Response Models

Pydantic is a data validation library that:
1. Validates incoming data (type checking, required fields, etc.)
2. Provides automatic documentation in FastAPI
3. Serializes/deserializes data (Python dict ↔ Python object)
4. Generates clear error messages for invalid data

These schemas define the "shape" of data that flows in and out of our API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime

# ------------------------------------------------------------------------------------------------------
# CONFIGURATION SAVE REQUEST SCHEMA
# ------------------------------------------------------------------------------------------------------

class ConfigurationSaveRequest(BaseModel):
    """
    Schema for the request body when saving a configuration.
    
    This defines what data the frontend must send when calling POST /api/save.
    
    Example request body:
    {
        "name": "Main Data Center Layout",
        "description": "Production configuration with dual turbines",
        "data": {
            "canvasComponents": [...],
            "connections": [...],
            "systemState": {...}
        }
    }
    """
    
    # NAME: User-friendly name for the configuration
    # Field(...) means this field is REQUIRED
    # min_length=1: Must have at least 1 character (no empty strings)
    # max_length=255: Maximum 255 characters (matches database column)
    # example: Shown in API documentation
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="User-friendly name for the configuration",
        example="Main Data Center Layout"
    )
    
    # DESCRIPTION: Optional longer description
    # Optional[str]: Can be None or a string
    # None: Default value if not provided
    description: Optional[str] = Field(
        None,
        description="Optional description of what this configuration represents",
        example="Production configuration with dual turbines and redundant power supply"
    )
    
    # DATA: The actual configuration data (components, connections, etc.)
    # Any: Can be any valid JSON structure (dict, list, etc.)
    # This is flexible because the frontend structure might evolve
    # We'll store this as a JSON string in the database
    data: Any = Field(
        ...,
        description="Full configuration data including components, connections, and system state",
        example={
            "canvasComponents": [
                {"id": "comp-1", "type": "turbine", "x": 100, "y": 200, "status": "running"}
            ],
            "connections": [
                {"from": "comp-1", "to": "comp-2", "isEnergized": True}
            ],
            "systemState": {
                "simulationRunning": False,
                "zoom": 1,
                "pan": {"x": 0, "y": 0}
            }
        }
    )
    
    class Config:
        """
        Pydantic configuration options.
        
        json_schema_extra: Provides a complete example in the API documentation.
        This helps developers understand what a valid request looks like.
        """
        json_schema_extra = {
            "example": {
                "name": "Emergency Scenario 1",
                "description": "Configuration for testing grid loss scenarios",
                "data": {
                    "canvasComponents": [
                        {
                            "id": "turbine-1",
                            "type": "turbine",
                            "x": 150,
                            "y": 100,
                            "status": "running",
                            "properties": {"power": 1000}
                        },
                        {
                            "id": "breaker-1",
                            "type": "breaker",
                            "x": 300,
                            "y": 100,
                            "status": "closed"
                        }
                    ],
                    "connections": [
                        {
                            "id": "conn-1",
                            "from": "turbine-1",
                            "to": "breaker-1",
                            "isEnergized": True
                        }
                    ],
                    "systemState": {
                        "simulationRunning": False,
                        "zoom": 1,
                        "pan": {"x": 0, "y": 0}
                    }
                }
            }
        }

# ------------------------------------------------------------------------------------------------------
# CONFIGURATION RESPONSE SCHEMA
# ------------------------------------------------------------------------------------------------------

class ConfigurationResponse(BaseModel):
    """
    Schema for the response when saving or retrieving a configuration.
    
    This defines what data the API will return to the frontend.
    It includes all the fields from the request, plus auto-generated fields
    like id, created_at, and updated_at.
    
    Example response:
    {
        "id": 1,
        "name": "Main Data Center Layout",
        "description": "Production configuration",
        "data": {...},
        "created_at": "2026-02-04T14:30:00",
        "updated_at": "2026-02-04T14:30:00"
    }
    """
    
    # ID: Unique identifier assigned by the database
    id: int = Field(
        ...,
        description="Unique identifier for the configuration",
        example=1
    )
    
    # NAME: User-friendly name
    name: str = Field(
        ...,
        description="User-friendly name for the configuration",
        example="Main Data Center Layout"
    )
    
    # DESCRIPTION: Optional description
    description: Optional[str] = Field(
        None,
        description="Optional description of what this configuration represents",
        example="Production configuration"
    )
    
    # DATA: The configuration data (as a Python dict/list, will be JSON in response)
    data: Any = Field(
        ...,
        description="Full configuration data",
        example={"canvasComponents": [], "connections": []}
    )
    
    # CREATED_AT: When the configuration was first saved
    created_at: datetime = Field(
        ...,
        description="Timestamp of when this configuration was created",
        example="2026-02-04T14:30:00"
    )
    
    # UPDATED_AT: When the configuration was last modified
    updated_at: datetime = Field(
        ...,
        description="Timestamp of when this configuration was last updated",
        example="2026-02-04T14:30:00"
    )
    
    class Config:
        """
        Pydantic configuration options.
        
        from_attributes=True: Allows Pydantic to read data from SQLAlchemy models.
        This is essential because we'll be converting SQLAlchemy Configuration objects
        to Pydantic ConfigurationResponse objects.
        
        Without this, Pydantic would only work with dictionaries, not ORM objects.
        """
        from_attributes = True

# ------------------------------------------------------------------------------------------------------
# CONFIGURATION LIST ITEM SCHEMA
# ------------------------------------------------------------------------------------------------------

class ConfigurationListItem(BaseModel):
    """
    Schema for a single item in the configuration list.
    
    This is a lighter version of ConfigurationResponse that excludes the full 'data' field.
    Used for listing configurations (GET /api/configs) where we don't need the full data,
    just the metadata (id, name, description, timestamps).
    
    Why exclude 'data'?
    - Listing configs can return many items
    - The 'data' field can be very large (thousands of components)
    - Sending all that data would be slow and wasteful
    - Frontend typically only needs metadata for the list view
    - Full data is loaded separately when user clicks "Load"
    
    Example response for a list:
    [
        {
            "id": 1,
            "name": "Config 1",
            "description": "...",
            "created_at": "2026-02-04T14:30:00",
            "updated_at": "2026-02-04T14:30:00"
        },
        {
            "id": 2,
            "name": "Config 2",
            "description": "...",
            "created_at": "2026-02-04T15:00:00",
            "updated_at": "2026-02-04T15:00:00"
        }
    ]
    """
    
    id: int = Field(..., description="Unique identifier", example=1)
    name: str = Field(..., description="Configuration name", example="Config 1")
    description: Optional[str] = Field(None, description="Optional description")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------------------------------
# ERROR RESPONSE SCHEMA
# ------------------------------------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    """
    Schema for error responses.
    
    When something goes wrong (validation error, database error, not found, etc.),
    the API returns a consistent error format.
    
    Example error response:
    {
        "detail": "Configuration not found",
        "error_type": "NotFound",
        "timestamp": "2026-02-04T14:30:00"
    }
    """
    
    detail: str = Field(
        ...,
        description="Human-readable error message",
        example="Configuration not found"
    )
    
    error_type: Optional[str] = Field(
        None,
        description="Type of error (e.g., 'ValidationError', 'NotFound', 'DatabaseError')",
        example="NotFound"
    )
    
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the error occurred"
    )

# ------------------------------------------------------------------------------------------------------
# NOTES ON PYDANTIC
# ------------------------------------------------------------------------------------------------------

"""
Why use Pydantic?

1. AUTOMATIC VALIDATION
   - FastAPI automatically validates incoming requests against the schema
   - If data is invalid, FastAPI returns a 422 error with details
   - No need to write manual validation code

2. AUTOMATIC DOCUMENTATION
   - FastAPI uses these schemas to generate OpenAPI docs
   - Visit /docs to see interactive API documentation
   - All fields, types, and examples appear automatically

3. TYPE SAFETY
   - Python type hints provide editor autocomplete
   - Catches type errors during development
   - Makes code more maintainable

4. SERIALIZATION
   - Converts Python objects → JSON (for responses)
   - Converts JSON → Python objects (for requests)
   - Handles datetime, UUID, and other complex types automatically

5. CONSISTENCY
   - Ensures all responses have the same structure
   - Makes frontend integration easier
   - Reduces bugs from unexpected data formats

Example flow:
1. Frontend sends JSON: {"name": "Test", "data": {...}}
2. FastAPI validates against ConfigurationSaveRequest
3. If valid, converts to Python object: ConfigurationSaveRequest(name="Test", data={...})
4. Your code saves to database
5. You return a Configuration ORM object
6. FastAPI converts to ConfigurationResponse
7. FastAPI serializes to JSON and sends to frontend
"""
