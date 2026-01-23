#!/bin/bash

# Fix Heroku deployment by forcing a fresh build

echo "🔧 Heroku Deployment Fix Script"
echo "================================"

# Step 1: Clear local dist folder
echo ""
echo "Step 1: Cleaning local build artifacts..."
rm -rf dist/
echo "✓ Removed dist/ folder"

# Step 2: Verify latest code is committed
echo ""
echo "Step 2: Checking Git status..."
if [[ -n $(git status -s) ]]; then
    echo "⚠️  You have uncommitted changes:"
    git status -s
    echo ""
    read -p "Commit these changes now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Fix: Update OCR validation logic"
        echo "✓ Changes committed"
    else
        echo "❌ Please commit your changes before deploying"
        exit 1
    fi
else
    echo "✓ Working directory clean"
fi

# Step 3: Force rebuild on Heroku
echo ""
echo "Step 3: Deploying to Heroku..."
echo "This will:"
echo "  - Clear Heroku's build cache"
echo "  - Reinstall all dependencies"
echo "  - Run fresh build"

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Get Heroku app name
read -p "Enter your Heroku app name: " APP_NAME

# Clear cache and deploy
echo ""
echo "Clearing Heroku build cache..."
heroku plugins:install heroku-builds
heroku builds:cache:purge -a $APP_NAME

echo ""
echo "Pushing to Heroku..."
git push heroku main --force

echo ""
echo "Deployment complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Wait 30-60 seconds for the build to complete"
echo "2. Visit: https://$APP_NAME.herokuapp.com"
echo "3. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "4. Check browser console for the log: 'Completely removed false positive'"
