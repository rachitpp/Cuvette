#!/bin/bash

# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Ensure build directory exists
if [ -d "dist" ]; then
  echo "Build directory exists."
else
  echo "Build failed - dist directory not found!"
  exit 1
fi

# Ensure the main file exists
if [ -f "dist/app.js" ]; then
  echo "Build successful: dist/app.js found"
else
  echo "Build failed: dist/app.js not found!"
  exit 1
fi

# Start the app
echo "Starting app..." 