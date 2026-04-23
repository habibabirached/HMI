"""
DATABASE CONNECTION AND SESSION MANAGEMENT

This module handles the SQLite database connection and provides session management
for the FastAPI application. It uses SQLAlchemy ORM (Object-Relational Mapping)
to interact with the database in a Pythonic way.

Key Components:
1. DATABASE_URL: Connection string for SQLite database
2. engine: SQLAlchemy engine that manages the database connection pool
3. SessionLocal: Factory for creating database sessions
4. Base: Base class for all ORM models
5. init_db(): Function to create all database tables
6. get_db(): Dependency function for FastAPI routes to get database sessions
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# ------------------------------------------------------------------------------------------------------
# DATABASE CONFIGURATION
# ------------------------------------------------------------------------------------------------------

# Database URL - points to a SQLite file in the current directory
# SQLite is a file-based database that stores all data in a single file.
# The format is: sqlite:///./filename.db
# The triple slash (///) indicates it's a relative path from the current directory.
# You can also use an absolute path: sqlite:////absolute/path/to/database.db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./datacenter_configs.db")

# For production, you might use PostgreSQL instead:
# DATABASE_URL = "postgresql://user:password@localhost:5432/dbname"

# ------------------------------------------------------------------------------------------------------
# CREATE DATABASE ENGINE
# ------------------------------------------------------------------------------------------------------

# The engine is the starting point for any SQLAlchemy application.
# It represents the core interface to the database and handles connection pooling.
# 
# connect_args={"check_same_thread": False}:
#   - This is ONLY needed for SQLite
#   - SQLite by default only allows one thread to access a connection
#   - In FastAPI (async framework), we might access DB from multiple threads
#   - This setting disables that check, making it safe for FastAPI
#   - DO NOT use this setting for PostgreSQL or MySQL
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# ------------------------------------------------------------------------------------------------------
# CREATE SESSION FACTORY
# ------------------------------------------------------------------------------------------------------

# SessionLocal is a factory that creates new database sessions.
# A session represents a "workspace" for database operations.
# Think of it like a transaction context - you do multiple operations,
# then commit them all at once.
#
# autocommit=False:
#   - Changes are NOT automatically committed
#   - You must explicitly call session.commit() to save changes
#   - This gives you control over transaction boundaries
#
# autoflush=False:
#   - Changes are NOT automatically flushed to the database before queries
#   - You must explicitly call session.flush() if needed
#   - This gives you more control over when database writes happen
#
# bind=engine:
#   - Connects this session factory to our database engine
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ------------------------------------------------------------------------------------------------------
# CREATE BASE CLASS FOR MODELS
# ------------------------------------------------------------------------------------------------------

# Base is the declarative base class for all ORM models.
# All your database models (like Configuration) will inherit from this.
# When you call Base.metadata.create_all(engine), it creates tables for
# all models that inherit from this Base class.
Base = declarative_base()

# ------------------------------------------------------------------------------------------------------
# DATABASE INITIALIZATION FUNCTION
# ------------------------------------------------------------------------------------------------------

def init_db():
    """
    Initialize the database by creating all tables defined in the models.
    
    This function should be called once when the application starts.
    It uses metadata from all models that inherit from Base to create
    the corresponding database tables.
    
    If the tables already exist, this function does nothing (it's idempotent).
    
    How it works:
    1. Base.metadata contains information about all models (tables, columns, etc.)
    2. create_all() reads that metadata and generates CREATE TABLE SQL statements
    3. Those statements are executed against the database via the engine
    4. If a table already exists, SQLAlchemy skips creating it
    
    Note: This is a simple approach suitable for development and small projects.
    For production applications with complex schema changes, consider using
    Alembic for database migrations (already in requirements.txt).
    """
    print("🔧 Initializing database...")
    print(f"   Database URL: {DATABASE_URL}")
    
    # Import all models here to ensure they are registered with Base.metadata
    # This must happen BEFORE calling create_all()
    from models import (  # noqa: F401 — register ORM models with Base.metadata
        Configuration,
        SimulationCsvImport,
        SimulationCsvRow,
    )
    
    # Create all tables defined in models
    Base.metadata.create_all(bind=engine)
    
    print("✅ Database tables created successfully!")

# ------------------------------------------------------------------------------------------------------
# DEPENDENCY FOR FASTAPI ROUTES
# ------------------------------------------------------------------------------------------------------

def get_db():
    """
    Dependency function for FastAPI routes to get a database session.
    
    This is a generator function that:
    1. Creates a new database session
    2. Yields it to the route handler
    3. Automatically closes the session when the request is done
    
    Usage in FastAPI routes:
    
    @app.get("/api/configs")
    def get_configs(db: Session = Depends(get_db)):
        configs = db.query(Configuration).all()
        return configs
    
    The "Depends(get_db)" tells FastAPI to:
    1. Call get_db() before executing the route handler
    2. Pass the yielded session as the 'db' parameter
    3. Automatically run the 'finally' block after the request (closing the session)
    
    Why use 'yield' instead of 'return'?
    - It allows cleanup code in the 'finally' block
    - Ensures the session is always closed, even if an exception occurs
    
    Why close the session?
    - Releases database connections back to the pool
    - Prevents connection leaks
    - Good practice for resource management
    """
    # Create a new database session
    db = SessionLocal()
    try:
        # Yield the session to the route handler
        yield db
    finally:
        # Always close the session when done (even if an exception occurred)
        db.close()
