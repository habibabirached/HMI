"""
DATABASE MODELS - ORM DEFINITIONS

This module defines the database models (tables) using SQLAlchemy ORM.
Each class represents a table, and each class attribute represents a column.

Current Models:
1. Configuration: Stores saved power system configurations
   (CSV data and chart configs live in design dir files: .sim.json, .data.csv)
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base

# ------------------------------------------------------------------------------------------------------
# CONFIGURATION MODEL
# ------------------------------------------------------------------------------------------------------

class Configuration(Base):
    """
    Configuration Model - Stores saved power system configurations
    
    This table stores complete snapshots of the data center power system designer's state,
    including all components placed on the canvas, their connections, and their properties.
    
    Table Structure:
    - id: Unique identifier (auto-incremented integer)
    - name: User-friendly name for the configuration (e.g., "Main Data Center Layout", "Emergency Scenario 1")
    - description: Optional longer description of what this configuration represents
    - data: JSON string containing the full configuration (components, connections, system state, etc.)
    - created_at: Timestamp of when this configuration was first saved
    - updated_at: Timestamp of when this configuration was last modified
    
    The 'data' field stores a JSON object that might look like:
    {
        "canvasComponents": [
            {
                "id": "comp-1",
                "type": "turbine",
                "x": 100,
                "y": 200,
                "status": "running",
                ...
            },
            ...
        ],
        "connections": [
            {
                "from": "comp-1",
                "to": "comp-2",
                "isEnergized": true
            },
            ...
        ],
        "systemState": {
            "simulationRunning": false,
            ...
        }
    }
    
    SQLAlchemy automatically maps this class to a database table named 'configurations'.
    """
    
    # Define the table name explicitly
    # If not specified, SQLAlchemy would use the lowercase class name ('configuration')
    __tablename__ = "configurations"
    
    # ------------------------------------------------------------------------------------------------------
    # COLUMNS / FIELDS
    # ------------------------------------------------------------------------------------------------------
    
    # PRIMARY KEY: Unique identifier for each configuration
    # Integer: Stores whole numbers (1, 2, 3, ...)
    # primary_key=True: Makes this the primary key (unique identifier)
    # index=True: Creates a database index on this column for faster lookups
    # autoincrement=True: Database automatically generates the next number (1, 2, 3, ...)
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="Unique identifier for the configuration"
    )
    
    # NAME: User-friendly name for the configuration
    # String(255): Text field with a maximum length of 255 characters
    # nullable=False: This field is REQUIRED (cannot be NULL/empty)
    # index=True: Creates an index for faster searches by name
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="User-friendly name for the configuration"
    )
    
    # DESCRIPTION: Optional longer description
    # Text: Unlimited length text field (use for longer content)
    # nullable=True: This field is OPTIONAL (can be NULL/empty)
    # default=None: If no value provided, store NULL
    description = Column(
        Text,
        nullable=True,
        default=None,
        comment="Optional description of what this configuration represents"
    )
    
    # DATA: The actual configuration data stored as JSON string
    # Text: Unlimited length text field (JSON can be long)
    # nullable=False: This field is REQUIRED
    # 
    # Why store JSON as Text instead of JSON type?
    # - SQLite doesn't have a native JSON type
    # - Text works across all databases (SQLite, PostgreSQL, MySQL)
    # - We can parse it in Python using json.loads() / json.dumps()
    # - If using PostgreSQL in production, you could change this to JSON type
    #   for better querying capabilities (e.g., data->>'key')
    data = Column(
        Text,
        nullable=False,
        comment="JSON string containing the full configuration data"
    )
    
    # CREATED_AT: Timestamp of when this record was first created
    # DateTime: Stores date and time (e.g., 2026-02-04 14:30:00)
    # nullable=False: This field is REQUIRED
    # server_default=func.now(): Database automatically sets this to current time on INSERT
    # 
    # func.now() is a SQLAlchemy function that translates to:
    # - CURRENT_TIMESTAMP in SQLite
    # - NOW() in PostgreSQL
    # - NOW() in MySQL
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="Timestamp of when this configuration was created"
    )
    
    # UPDATED_AT: Timestamp of when this record was last modified
    # DateTime: Stores date and time
    # nullable=False: This field is REQUIRED
    # server_default=func.now(): Database sets this to current time on INSERT
    # onupdate=func.now(): Database automatically updates this to current time on UPDATE
    # 
    # This gives us automatic tracking of when a configuration was last modified
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="Timestamp of when this configuration was last updated"
    )
    
    # ------------------------------------------------------------------------------------------------------
    # STRING REPRESENTATION (for debugging)
    # ------------------------------------------------------------------------------------------------------
    
    def __repr__(self):
        """
        String representation of this Configuration object.
        Useful for debugging and logging.
        
        When you print a Configuration object, this is what you'll see:
        <Configuration(id=1, name='Main Layout', created=2026-02-04 14:30:00)>
        """
        return f"<Configuration(id={self.id}, name='{self.name}', created={self.created_at})>"
    
    # ------------------------------------------------------------------------------------------------------
    # CONVERSION TO DICTIONARY (for API responses)
    # ------------------------------------------------------------------------------------------------------
    
    def to_dict(self):
        """
        Convert this Configuration object to a dictionary.
        Useful for returning data in API responses (FastAPI automatically converts dicts to JSON).
        
        Example usage:
        config = db.query(Configuration).first()
        return config.to_dict()
        
        Returns:
        {
            "id": 1,
            "name": "Main Layout",
            "description": "Primary data center configuration",
            "data": "{...JSON string...}",
            "created_at": "2026-02-04T14:30:00",
            "updated_at": "2026-02-04T15:45:00"
        }
        """
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "data": self.data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# ------------------------------------------------------------------------------------------------------
# NOTES ON SQLALCHEMY ORM
# ------------------------------------------------------------------------------------------------------

"""
How SQLAlchemy ORM Works:

1. CLASS → TABLE
   - Each class (like Configuration) becomes a database table
   - The class name or __tablename__ becomes the table name

2. ATTRIBUTES → COLUMNS
   - Each Column attribute becomes a table column
   - Column types (Integer, String, Text) define the data type

3. INSTANCES → ROWS
   - Each instance of the class represents a row in the table
   - Example:
     config = Configuration(name="Test", data='{"components": []}')
     db.add(config)  # Adds a new row
     db.commit()     # Saves to database

4. QUERIES
   - You can query using Python methods instead of SQL:
     - db.query(Configuration).all()  → SELECT * FROM configurations
     - db.query(Configuration).filter(Configuration.name == "Test").first()
       → SELECT * FROM configurations WHERE name = 'Test' LIMIT 1
     - db.query(Configuration).filter(Configuration.id == 1).delete()
       → DELETE FROM configurations WHERE id = 1

5. RELATIONSHIPS (not used yet, but useful for future)
   - You can define relationships between tables
   - Example: Configuration → User (many-to-one)
   - SQLAlchemy handles the foreign keys automatically

This abstraction makes database operations more Pythonic and less error-prone
than writing raw SQL strings.
"""

# Legacy models (CSVDataset, ChartAssociation, SimulationConfig) removed.
# CSV and sim config data now live in designs/{dir}/*.sim.json and *.data.csv