# ============================================================================
# DOCKERFILE FOR DATA CENTER POWER SYSTEM BACKEND
# ============================================================================
# This file is the "recipe" for building the Python backend Docker container.
# 
# WHAT IT DOES:
# 1. Starts with a base Python image
# 2. Installs all required Python packages (from requirements.txt)
# 3. Copies our application code into the container
# 4. Starts the FastAPI server when the container runs
#
# HOW TO BUILD:
#   docker build -t dcs-backend .
#
# HOW TO RUN:
#   docker run -p 5000:5000 dcs-backend
# ============================================================================

# ----------------------------------------------------------------------------
# BASE IMAGE - Start with official Python image
# ----------------------------------------------------------------------------
# python:3.12-slim = Python 3.12 with minimal OS (Debian-based)
# "slim" means smaller image size (no unnecessary tools)
FROM python:3.12-slim

# ----------------------------------------------------------------------------
# METADATA - Who maintains this image
# ----------------------------------------------------------------------------
LABEL maintainer="Data Center Power System Team"
LABEL description="Backend API server for power system configuration management"

# ----------------------------------------------------------------------------
# SET WORKING DIRECTORY
# ----------------------------------------------------------------------------
# All commands will run inside /app in the container
WORKDIR /app

# ----------------------------------------------------------------------------
# INSTALL SYSTEM DEPENDENCIES (if needed)
# ----------------------------------------------------------------------------
# Some Python packages need compilation tools
# We install them here before installing Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------------------------------------------------------
# COPY REQUIREMENTS FILE FIRST (Layer Caching Optimization)
# ----------------------------------------------------------------------------
# WHY COPY requirements.txt FIRST?
# Docker builds images in "layers". Each command creates a layer.
# Layers are cached - if nothing changed, Docker reuses the cached layer.
#
# Python packages rarely change, but code changes often.
# By copying requirements.txt first and installing packages,
# Docker caches that layer. When you change app.py, Docker only
# rebuilds from the COPY app.py step onward (skips reinstalling packages).
#
# This makes rebuilds MUCH faster!
COPY requirements.txt .

# ----------------------------------------------------------------------------
# INSTALL PYTHON PACKAGES
# ----------------------------------------------------------------------------
# pip install -r requirements.txt downloads and installs all packages
# listed in requirements.txt
#
# --no-cache-dir = Don't save downloaded packages (saves space)
RUN pip install --no-cache-dir -r requirements.txt

# ----------------------------------------------------------------------------
# COPY APPLICATION CODE
# ----------------------------------------------------------------------------
# Now copy the actual Python code (app.py and any other files)
# This happens AFTER installing packages, so changing code doesn't
# force reinstalling packages
COPY . .

# ----------------------------------------------------------------------------
# CREATE DIRECTORIES FOR SAVED CONFIGURATIONS
# ----------------------------------------------------------------------------
# Create the directory where we'll save configuration files to disk
# mkdir -p means "create directory and any parent directories needed,
# and don't error if it already exists"
RUN mkdir -p /app/designs

# ----------------------------------------------------------------------------
# EXPOSE PORT (Documentation)
# ----------------------------------------------------------------------------
# Tells Docker (and humans reading this file) that the application
# listens on port 5000
# NOTE: This doesn't actually publish the port - docker-compose does that
EXPOSE 5000

# ----------------------------------------------------------------------------
# START THE APPLICATION
# ----------------------------------------------------------------------------
# CMD is the command that runs when the container starts
# uvicorn app:app = Run the 'app' object from 'app.py'
# --host 0.0.0.0 = Listen on all network interfaces (so Docker can access it)
# --port 5000 = Listen on port 5000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
