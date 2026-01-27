################################################################################
# DOCKERFILE FOR REACT UI APPLICATION
################################################################################
#
# PURPOSE: This Dockerfile creates a containerized environment to run your
#          React "Hello World" application. It packages everything needed
#          (Node.js, dependencies, your code) into a single Docker image.
#
# WHAT IS A DOCKERFILE?
#   Think of it as a recipe that tells Docker how to build a container.
#   Each line is a step in building the environment where your app runs.
#
# LAYERS: Docker builds in layers (like a cake). Each instruction creates
#         a layer. Layers are cached, so rebuilds are faster if nothing changed.
#
################################################################################

# BUILD-TIME ARGUMENTS
# These are variables you can pass when building the image (optional).
# They're used for corporate proxy settings when downloading packages.
# Example: docker build --build-arg HTTP_PROXY=http://proxy.company.com:80
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

################################################################################
# STEP 1: CHOOSE THE BASE IMAGE
################################################################################
# FROM node:24-alpine
#
# This is like saying "Start with a pre-made computer that already has Node.js"
# 
# Breaking it down:
#   - node: Official Node.js image (JavaScript runtime)
#   - 24: Node.js version 24 (the JavaScript engine version)
#   - alpine: A tiny Linux distribution (only ~5MB vs normal Linux ~100MB+)
#
# Why alpine? It's super lightweight but has everything we need!
# This gives us a mini Linux computer with Node.js already installed.
FROM node:24-alpine

################################################################################
# STEP 2: SET THE USER
################################################################################
# USER root
#
# Run all commands as the "root" user (administrator with full permissions).
# This is needed to install packages and make system changes.
# In production, you'd often switch to a non-root user for security,
# but for simplicity we stay as root here.
USER root

################################################################################
# STEP 3: SET THE WORKING DIRECTORY
################################################################################
# WORKDIR /app/
#
# This is like saying "cd /app" - change to the /app directory.
# If /app doesn't exist, Docker creates it.
# All subsequent commands (COPY, RUN, etc.) happen in this directory.
# 
# Think of /app/ as your project folder inside the container.
WORKDIR /app/

################################################################################
# STEP 4: CONFIGURE NODE.JS MEMORY
################################################################################
# ENV NODE_OPTIONS=--max-old-space-size=7168
#
# This sets an environment variable (like a global setting) for Node.js.
# --max-old-space-size=7168 tells Node.js it can use up to 7168 MB (7 GB) of RAM.
#
# Why? React's build process can be memory-hungry. Without this, Node might
# crash with "JavaScript heap out of memory" errors during npm install or builds.
# 7 GB is generous and prevents out-of-memory crashes.
ENV NODE_OPTIONS=--max-old-space-size=7168

################################################################################
# STEP 5: COPY PACKAGE.JSON (THE DEPENDENCY LIST)
################################################################################
# COPY package.json /app/package.json
#
# Copy ONLY the package.json file from your computer into the container.
# This file lists all the JavaScript libraries your React app needs
# (like react, react-dom, react-scripts, etc.)
#
# Why copy JUST package.json first (not all code)?
# Because of Docker's layer caching! If package.json doesn't change,
# Docker won't re-run npm install (which is slow). It uses the cached layer.
# This makes rebuilds much faster when you only change code, not dependencies.
COPY package.json /app/package.json

################################################################################
# STEP 6: CONFIGURE NPM (NODE PACKAGE MANAGER)
################################################################################
# NPM is the tool that downloads JavaScript libraries from the internet.
# We need to configure it for corporate/security settings.

# RUN npm config set "strict-ssl" false -g
#
# Turn off SSL certificate verification when downloading packages.
# -g means "global" (applies to all npm operations in this container)
#
# Why? Corporate proxies often use custom SSL certificates that npm doesn't
# trust by default. This tells npm "don't worry about SSL verification".
# 
# ⚠️ WARNING: This is less secure! Only use this behind corporate firewalls.
# For public internet, remove this line and let npm verify SSL certificates.
RUN npm config set "strict-ssl" false -g

################################################################################
# STEP 7: INSTALL/UPDATE NPM ITSELF
################################################################################
# RUN npm install --verbose -g npm
#
# Update npm (the package manager) to the latest version.
# -g: Install globally (system-wide)
# --verbose: Show detailed output so we can see what's happening
#
# Why? The base image might have an older npm version.
# We want the latest for bug fixes and better performance.
RUN npm install --verbose -g npm

################################################################################
# STEP 8: INSTALL PROJECT DEPENDENCIES
################################################################################
# RUN npm install --verbose
#
# This is the BIG step! npm reads package.json and downloads ALL the
# JavaScript libraries your React app needs into ./node_modules folder.
# This includes React, ReactDOM, react-scripts, and all their dependencies.
# --verbose: Show detailed progress (good for debugging if something fails)
#
# This step can take 2-5 minutes on first build and downloads hundreds of
# packages (that's normal for React projects - modern JS has many dependencies).
#
# 💡 KEY INSIGHT: We do this BEFORE copying our code (src/, public/).
#    This way, if we change code but not dependencies, Docker reuses the
#    cached node_modules layer and npm install doesn't run again!
RUN npm install --verbose

################################################################################
# STEP 9: COPY APPLICATION CODE
################################################################################
# Now that dependencies are installed, copy the actual application code.
# We do this LAST so that code changes don't invalidate the npm install cache.

# COPY public/ /app/public
# Copy the public folder (contains index.html and any static files)
# This is your app's entry point HTML file.
COPY public/ /app/public

# COPY src/ /app/src  
# Copy the src folder (contains App.js, index.js - your actual React code)
# This is where your "Hello World" component lives!
COPY src/ /app/src

################################################################################
# STEP 10: DECLARE THE PORT
################################################################################
# EXPOSE 3000
#
# This is documentation that says "this container uses port 3000".
# It doesn't actually open the port (docker-compose does that with ports: "3001:3000")
# but it tells other developers "hey, this app runs on port 3000 internally".
#
# React's development server (react-scripts start) runs on port 3000 by default.
EXPOSE 3000

################################################################################
# STEP 11: SET THE DEFAULT COMMAND
################################################################################
# CMD ["./node_modules/.bin/react-scripts", "start"]
#
# This is what runs when the container starts - it's the final "execute" command.
#
# Breaking it down:
#   - ./node_modules/.bin/react-scripts: Path to the React development server
#   - start: Command to start the development server
#
# This is equivalent to running "npm start" on your computer.
# It starts the React dev server which:
#   1. Compiles your React code
#   2. Starts a web server on port 3000
#   3. Watches for file changes and hot-reloads (via the volume mounts)
#   4. Serves your "Hello World" app!
#
# When you visit http://localhost:3001 in your browser, you're connecting to
# this React dev server running inside this container on port 3000 (mapped to 3001).
CMD ["./node_modules/.bin/react-scripts", "start"]

################################################################################
# BUILD & RUN SUMMARY:
#
# BUILD (./docker-dev-build.sh):
#   1. Takes this Dockerfile recipe
#   2. Executes each instruction step-by-step
#   3. Creates a Docker image (frozen snapshot) with everything installed
#   4. Image is stored locally on your machine
#
# RUN (./docker-dev-run.sh):
#   1. Takes the image and creates a running container
#   2. Container is like a running virtual computer
#   3. The CMD instruction runs, starting your React app
#   4. You can visit http://localhost:3001 to see "Hello World"!
#
# VOLUMES (from docker-compose):
#   The docker-compose mounts ./src and ./public into the container.
#   This means when you edit App.js on your computer, the running container
#   sees the change immediately and React hot-reloads! No rebuild needed!
#
################################################################################