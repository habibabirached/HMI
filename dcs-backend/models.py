"""
DATABASE MODELS - ORM DEFINITIONS

This module defines the database models (tables) using SQLAlchemy ORM.
Each class represents a table, and each class attribute represents a column.

Current Models:
1. Configuration: Stores saved power system configurations
2. CSVDataset: Stores uploaded CSV time-series data for charts
3. ChartAssociation: Links components to CSV datasets with chart configurations
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
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

# ------------------------------------------------------------------------------------------------------
# CSV DATASET MODEL
# ------------------------------------------------------------------------------------------------------

class CSVDataset(Base):
    """
    CSVDataset Model - Stores uploaded CSV time-series data for charting
    
    This table stores CSV files that users upload to associate with components.
    Each CSV contains time-series data (e.g., solar power over 24 hours, wind speed, etc.)
    that can be visualized in charts and used during simulation.
    
    Table Structure:
    - id: Unique identifier (auto-incremented integer)
    - name: Filename of the CSV (e.g., "solar_24hr_realistic.csv") - MUST BE UNIQUE
    - file_path: Path where the CSV is stored on disk (e.g., "saved_csv/solar_24hr_realistic.csv")
    - columns: JSON array of column names from the CSV (e.g., ["timestamp", "power_mw", "voltage_kv"])
    - data_json: The full CSV data stored as JSON array of objects
    - row_count: Number of data rows (for quick reference)
    - uploaded_at: When this CSV was uploaded
    
    Example data_json structure:
    [
        {"timestamp": 0, "power_mw": 0, "voltage_kv": 13.8},
        {"timestamp": 10, "power_mw": 1.2, "voltage_kv": 13.7},
        {"timestamp": 20, "power_mw": 2.5, "voltage_kv": 13.8},
        ...
    ]
    
    The name field is unique to prevent duplicate uploads.
    """
    
    __tablename__ = "csv_datasets"
    
    # PRIMARY KEY
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="Unique identifier for the CSV dataset"
    )
    
    # NAME: Filename (must be unique)
    # This is the CSV filename, used as the identifier when associating with components
    # unique=True ensures no two CSVs can have the same name
    name = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="Filename of the CSV (must be unique)"
    )
    
    # FILE_PATH: Path on disk where CSV is stored
    # Example: "saved_csv/solar_24hr_realistic.csv"
    file_path = Column(
        String(500),
        nullable=True,
        comment="Path to the CSV file on disk"
    )
    
    # COLUMNS: JSON array of column names
    # Stored as JSON string: ["timestamp", "power_mw", "voltage_kv", "temperature_c"]
    # This allows the frontend to show available columns for X/Y axis selection
    columns = Column(
        Text,
        nullable=False,
        comment="JSON array of column names from the CSV"
    )
    
    # DATA_JSON: Full CSV data as JSON
    # Stored as JSON string containing array of objects
    # Each object represents one row with column_name: value pairs
    # This can be large (several MB for high-resolution time-series)
    data_json = Column(
        Text,
        nullable=False,
        comment="Full CSV data as JSON array of objects"
    )
    
    # ROW_COUNT: Number of data rows
    # Stored separately for quick reference without parsing the full JSON
    row_count = Column(
        Integer,
        nullable=True,
        default=0,
        comment="Number of data rows in the CSV"
    )
    
    # UPLOADED_AT: When the CSV was uploaded
    uploaded_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="Timestamp of when this CSV was uploaded"
    )
    
    def __repr__(self):
        """String representation for debugging"""
        return f"<CSVDataset(id={self.id}, name='{self.name}', rows={self.row_count})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "name": self.name,
            "file_path": self.file_path,
            "columns": self.columns,  # Will be parsed to array in API
            "row_count": self.row_count,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
        }

# ------------------------------------------------------------------------------------------------------
# CHART ASSOCIATION MODEL
# ------------------------------------------------------------------------------------------------------

class ChartAssociation(Base):
    """
    ChartAssociation Model - Links components to CSV datasets with chart configurations
    
    This table stores the relationship between:
    - A specific component in a specific configuration (e.g., "Solar-1" in "Tier III Config")
    - A CSV dataset (e.g., "solar_24hr_realistic.csv")
    - Chart display settings (chart type, X/Y columns, colors, etc.)
    
    This allows:
    1. Components to have multiple charts (2D line, histogram, pie, etc.)
    2. Same CSV to be used by multiple components
    3. Different column mappings for the same CSV
    4. Chart settings to persist when saving/loading configurations
    
    Table Structure:
    - id: Unique identifier
    - configuration_id: Which configuration this association belongs to
    - component_id: Which component (e.g., "comp-solar-1")
    - dataset_name: Which CSV dataset (references csv_datasets.name)
    - chart_type: Type of chart (e.g., "scatter", "histogram", "pie")
    - x_column: Which CSV column to use for X-axis (e.g., "timestamp")
    - y_column: Which CSV column to use for Y-axis (e.g., "power_mw")
    - chart_config: Additional Plotly configuration as JSON (colors, titles, etc.)
    - created_at: When this association was created
    
    Example: Solar component with 2 charts
    - Association 1: comp-solar-1 → solar_24hr.csv → scatter (time vs power)
    - Association 2: comp-solar-1 → solar_24hr.csv → histogram (power distribution)
    """
    
    __tablename__ = "chart_associations"
    
    # PRIMARY KEY
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="Unique identifier for the chart association"
    )
    
    # CONFIGURATION_ID: Which configuration this belongs to
    # ForeignKey links to configurations.id
    # When a configuration is deleted, we can optionally delete all its chart associations
    configuration_id = Column(
        Integer,
        ForeignKey("configurations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID of the configuration this association belongs to"
    )
    
    # COMPONENT_ID: Which component (matches component.id in configuration JSON)
    # Example: "comp-solar-1", "comp-wind-2", "comp-bess-1"
    # This is stored as string because component IDs are strings in the frontend
    component_id = Column(
        String(100),
        nullable=False,
        index=True,
        comment="ID of the component (e.g., 'comp-solar-1')"
    )
    
    # DATASET_NAME: Which CSV dataset to use
    # ForeignKey links to csv_datasets.name (not id, because name is unique and user-friendly)
    dataset_name = Column(
        String(255),
        ForeignKey("csv_datasets.name", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Name of the CSV dataset to use"
    )
    
    # CHART_TYPE: Type of Plotly chart
    # Examples: "scatter", "bar", "histogram", "pie", "box", "heatmap", "gauge"
    # This determines how Plotly will render the data
    chart_type = Column(
        String(50),
        nullable=False,
        comment="Type of chart (scatter, histogram, pie, etc.)"
    )
    
    # X_COLUMN: Which column from CSV to use for X-axis
    # Example: "timestamp", "time_sec", "hour_of_day"
    # Can be NULL for chart types that don't need X-axis (e.g., gauge, pie)
    x_column = Column(
        String(100),
        nullable=True,
        comment="CSV column to use for X-axis"
    )
    
    # Y_COLUMN: Which column from CSV to use for Y-axis
    # Example: "power_mw", "voltage_kv", "frequency_hz"
    y_column = Column(
        String(100),
        nullable=False,
        comment="CSV column to use for Y-axis"
    )
    
    # CHART_CONFIG: Additional Plotly configuration as JSON
    # Stores custom settings like colors, titles, axis labels, etc.
    # Example: {"line_color": "gold", "show_legend": true, "title": "Solar Power Output"}
    chart_config = Column(
        Text,
        nullable=True,
        comment="Additional Plotly configuration as JSON"
    )
    
    # CREATED_AT: When this association was created
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="Timestamp of when this association was created"
    )
    
    # COMPOSITE INDEX: Fast lookups by configuration + component
    # This allows quick queries like "get all charts for component X in configuration Y"
    __table_args__ = (
        Index('idx_config_component', 'configuration_id', 'component_id'),
    )
    
    def __repr__(self):
        """String representation for debugging"""
        return f"<ChartAssociation(id={self.id}, component='{self.component_id}', dataset='{self.dataset_name}', type='{self.chart_type}')>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "configuration_id": self.configuration_id,
            "component_id": self.component_id,
            "dataset_name": self.dataset_name,
            "chart_type": self.chart_type,
            "x_column": self.x_column,
            "y_column": self.y_column,
            "chart_config": self.chart_config,  # Will be parsed to object in API
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

# ------------------------------------------------------------------------------------------------------
# DATABASE RELATIONSHIP NOTES
# ------------------------------------------------------------------------------------------------------

"""
Relationships Between Tables:

1. Configuration (1) → ChartAssociation (Many)
   - One configuration can have many chart associations
   - Each chart association belongs to exactly one configuration
   - When configuration is deleted, all its chart associations are deleted (CASCADE)

2. CSVDataset (1) → ChartAssociation (Many)
   - One CSV dataset can be used by many chart associations
   - Each chart association uses exactly one CSV dataset
   - When CSV is deleted, all chart associations using it are deleted (CASCADE)

3. Configuration → CSVDataset (Many-to-Many through ChartAssociation)
   - A configuration can use multiple CSV datasets (through its components' chart associations)
   - A CSV dataset can be used by multiple configurations
   - The ChartAssociation table acts as the "join table" connecting them

Example Query Patterns:

1. Get all charts for a configuration:
   db.query(ChartAssociation).filter(ChartAssociation.configuration_id == 1).all()

2. Get all charts for a specific component in a configuration:
   db.query(ChartAssociation)\
     .filter(ChartAssociation.configuration_id == 1)\
     .filter(ChartAssociation.component_id == "comp-solar-1")\
     .all()

3. Get CSV data for a chart:
   chart = db.query(ChartAssociation).filter(ChartAssociation.id == 1).first()
   csv = db.query(CSVDataset).filter(CSVDataset.name == chart.dataset_name).first()
   data = json.loads(csv.data_json)

4. Find all components using a specific CSV:
   charts = db.query(ChartAssociation)\
     .filter(ChartAssociation.dataset_name == "solar_24hr_realistic.csv")\
     .all()
"""

# ------------------------------------------------------------------------------------------------------
# SIMULATION CONFIG MODEL
# ------------------------------------------------------------------------------------------------------

class SimulationConfig(Base):
    """
    SimulationConfig Model - Stores simulation scenario configurations
    
    This table stores JSON configurations that define:
    - Which charts to display for each simulation scenario
    - Event marker settings (colors, labels)
    - Display names for simulation buttons
    
    Each design configuration can have ONE simulation config that defines
    multiple simulation scenarios (e.g., sim_Torsional, sim_LVRT, sim_SmallSignal).
    
    Table Structure:
    - id: Unique identifier
    - design_name: Name of the design this config belongs to (UNIQUE)
    - json_data: Full simulation configuration as JSON string
    - created_at: When this config was created
    - updated_at: When this config was last modified
    
    Example json_data structure:
    {
        "design_name": "LM2500-BESS-Integrated-Power-Node",
        "csv_file": "LM2500-BESS-Integrated-Power-Node.csv",
        "simulations": {
            "sim_Torsional": {
                "display_name": "Torsional Vibration Analysis",
                "description": "Steady-state validation...",
                "charts_to_display": [
                    {"type": "single", "component_id": "comp-turbine-1", "chart_id": "chart-123"},
                    {"type": "multi", "chart_id": "multiChart-456", "components": [...]}
                ],
                "event_markers": {
                    "bess_connected": {"label": "BESS Connected", "color": "rgba(0,255,0,0.15)"}
                }
            },
            "sim_LVRT": {...},
            "sim_SmallSignal": {...}
        }
    }
    
    The design_name field is unique to ensure one simulation config per design.
    """
    
    __tablename__ = "simulation_configs"
    
    # PRIMARY KEY
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="Unique identifier for the simulation config"
    )
    
    # DESIGN_NAME: Name of the design configuration (must be unique)
    # This links the simulation config to a specific design
    # Example: "LM2500-BESS-Integrated-Power-Node"
    design_name = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="Name of the design configuration (must match Configuration.name)"
    )
    
    # JSON_DATA: Full simulation configuration as JSON string
    # Stores the complete simulation config including all scenarios, charts, and event markers
    json_data = Column(
        Text,
        nullable=False,
        comment="Full simulation configuration as JSON string"
    )
    
    # CREATED_AT: When this simulation config was created
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="Timestamp of when this simulation config was created"
    )
    
    # UPDATED_AT: When this simulation config was last modified
    # Auto-updates on every save
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="Timestamp of when this simulation config was last updated"
    )
    
    def __repr__(self):
        """String representation for debugging"""
        return f"<SimulationConfig(id={self.id}, design='{self.design_name}', updated={self.updated_at})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "design_name": self.design_name,
            "json_data": self.json_data,  # Will be parsed to object in API
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

