#!/bin/bash

# Setup Verification Script
# Checks if all required files and configurations are in place

echo "🔍 Verifying Fantasy Team Name Scanner Setup..."
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found - please install Node.js"
    ERRORS=$((ERRORS + 1))
fi

# Check Python 3
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Python installed: $PYTHON_VERSION"
else
    echo "❌ Python 3 not found - please install Python 3"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check node_modules
if [ -d "node_modules" ]; then
    echo "✓ Node modules installed"
else
    echo "⚠️  Node modules not found - run: npm install"
    WARNINGS=$((WARNINGS + 1))
fi

# Check .env file
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    
    # Check if DATABASE_URL is set
    if grep -q "^DATABASE_URL=" .env && ! grep -q "^DATABASE_URL=your-database-url-here" .env; then
        echo "  ✓ DATABASE_URL is configured"
    else
        echo "  ⚠️  DATABASE_URL not configured in .env"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ .env file not found"
    echo "   Create it with: cp env.example .env"
    echo "   Then add your DATABASE_URL"
    ERRORS=$((ERRORS + 1))
fi

# Check .env.local file
if [ -f ".env.local" ]; then
    echo "✓ .env.local file exists"
else
    echo "⚠️  .env.local file not found"
    echo "   Create it with: cp env.local.example .env.local"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Check virtual environment
if [ -d "fantasy_trade_calculator_deployment/venv" ]; then
    echo "✓ Python virtual environment exists"
else
    echo "❌ Virtual environment not found"
    echo "   Run: ./setup-backend.sh"
    ERRORS=$((ERRORS + 1))
fi

# Check if scripts are executable
if [ -x "setup-backend.sh" ]; then
    echo "✓ setup-backend.sh is executable"
else
    echo "⚠️  setup-backend.sh not executable"
    echo "   Run: chmod +x setup-backend.sh"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -x "start-backend.sh" ]; then
    echo "✓ start-backend.sh is executable"
else
    echo "⚠️  start-backend.sh not executable"
    echo "   Run: chmod +x start-backend.sh"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! You're ready to run the application."
    echo ""
    echo "Next steps:"
    echo "  1. Terminal 1: ./start-backend.sh"
    echo "  2. Terminal 2: npm run dev"
    echo "  3. Open: http://localhost:5173"
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Setup complete with $WARNINGS warning(s)"
    echo "   You can proceed, but check the warnings above"
else
    echo "❌ Setup incomplete - $ERRORS error(s) and $WARNINGS warning(s)"
    echo "   Please fix the errors above before running the application"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $ERRORS

