#!/bin/bash

# Build script for deploying React frontend with Flask backend to Heroku
# This script builds the React app and copies it to the Flask static folder

set -e  # Exit on any error

echo "🚀 Starting Heroku deployment build..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Install dependencies (if needed)
echo "📦 Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Step 2: Build the React app
echo "⚛️  Building React app..."
npm run build

# Step 3: Prepare the Flask static folder
echo "📁 Preparing Flask static folder..."
REACT_DEST="fantasy_trade_calculator_deployment/static/react"

# Remove old React build if it exists
if [ -d "$REACT_DEST" ]; then
    rm -rf "$REACT_DEST"
fi

# Create the destination folder
mkdir -p "$REACT_DEST"

# Step 4: Copy the build files
echo "📋 Copying React build to Flask static folder..."
cp -r dist/* "$REACT_DEST/"

# Step 5: Verify the build
if [ -f "$REACT_DEST/index.html" ]; then
    echo "✅ Build successful!"
    echo ""
    echo "Files copied to: $REACT_DEST"
    echo ""
    ls -la "$REACT_DEST"
    echo ""
    echo "📤 Next steps:"
    echo "   1. cd fantasy_trade_calculator_deployment"
    echo "   2. git add ."
    echo "   3. git commit -m 'Deploy new React frontend'"
    echo "   4. git push heroku main"
else
    echo "❌ Build failed - index.html not found"
    exit 1
fi

