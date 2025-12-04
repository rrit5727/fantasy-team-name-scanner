#!/bin/bash

# Backend Startup Script
# This script activates the virtual environment and starts the Flask server

set -e  # Exit on error

echo "🚀 Starting Fantasy Trade Calculator Backend..."
echo ""

# Check if virtual environment exists
BACKEND_DIR="fantasy_trade_calculator_deployment"
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "❌ Error: Virtual environment not found!"
    echo "   Please run ./setup-backend.sh first"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create a .env file with your database credentials"
    echo "   You can copy env.example to .env and fill in your credentials"
    exit 1
fi

# Navigate to backend directory
cd "$BACKEND_DIR"

# Activate virtual environment
source venv/bin/activate

# Start Flask server
echo "✓ Virtual environment activated"
echo "✓ Starting Flask server on http://127.0.0.1:5002"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python app.py

