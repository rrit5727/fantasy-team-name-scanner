#!/bin/bash

# Backend Setup Script
# This script sets up the Python virtual environment and installs dependencies

set -e  # Exit on error

echo "🚀 Setting up Fantasy Trade Calculator Backend..."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

# Display Python version
PYTHON_VERSION=$(python3 --version)
echo "✓ Found $PYTHON_VERSION"
echo ""

# Navigate to the backend directory
BACKEND_DIR="fantasy_trade_calculator_deployment"
cd "$BACKEND_DIR"

# Check if virtual environment already exists
if [ -d "venv" ]; then
    echo "⚠️  Virtual environment already exists. Removing old venv..."
    rm -rf venv
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "✓ Virtual environment created"
echo ""
echo "📥 Installing dependencies..."

# Activate and install
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip > /dev/null 2>&1

# Install requirements
pip install -r requirements.txt

echo "✓ Dependencies installed successfully"
echo ""

# Check for .env file
cd ..
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo ""
    echo "📝 Please create a .env file in the project root with your database credentials."
    echo "   You can copy env.example to .env and fill in your credentials:"
    echo ""
    echo "   cp env.example .env"
    echo "   # Then edit .env with your database credentials"
    echo ""
else
    echo "✓ Found .env file"
    echo ""
    
    # Test database connection
    echo "🔌 Testing database connection..."
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    python3 << 'PYTHON_SCRIPT'
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load .env from project root
dotenv_path = os.path.join(os.path.dirname(os.getcwd()), '.env')
load_dotenv(dotenv_path)

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ Error: DATABASE_URL not found in .env file")
    sys.exit(1)

# Handle postgres:// format
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(database_url)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("✓ Database connection successful!")
except Exception as e:
    print(f"❌ Database connection failed: {str(e)}")
    sys.exit(1)
PYTHON_SCRIPT
    
    if [ $? -eq 0 ]; then
        cd ..
        echo ""
        echo "✅ Backend setup complete!"
        echo ""
        echo "To start the backend server, run:"
        echo "  ./start-backend.sh"
    else
        cd ..
        echo ""
        echo "⚠️  Setup complete but database connection failed."
        echo "   Please check your .env file credentials."
    fi
fi

