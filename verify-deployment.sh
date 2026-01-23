#!/bin/bash

# Verify that Heroku deployment has latest code

echo "🔍 Heroku Deployment Verification"
echo "=================================="

read -p "Enter your Heroku app name: " APP_NAME

echo ""
echo "Checking deployment status..."
echo ""

# Check if app is running
echo "1. Testing app health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_NAME.herokuapp.com)
if [ "$HTTP_CODE" == "200" ]; then
    echo "   ✓ App is running (HTTP $HTTP_CODE)"
else
    echo "   ❌ App returned HTTP $HTTP_CODE"
fi

# Check recent builds
echo ""
echo "2. Recent Heroku builds:"
heroku builds -a $APP_NAME -n 3

# Check for the specific code signature
echo ""
echo "3. Checking for latest code..."
echo "   Downloading main JavaScript bundle..."

# Get the deployed index.html to find the JS file
INDEX_HTML=$(curl -s https://$APP_NAME.herokuapp.com)

# Extract JS bundle filename
JS_FILE=$(echo "$INDEX_HTML" | grep -o 'assets/index-[a-zA-Z0-9]*.js' | head -1)

if [ -z "$JS_FILE" ]; then
    echo "   ❌ Could not find JavaScript bundle"
    exit 1
fi

echo "   Found bundle: $JS_FILE"

# Download and check for signature strings
JS_CONTENT=$(curl -s "https://$APP_NAME.herokuapp.com/$JS_FILE")

echo ""
echo "4. Verifying code signatures:"

# Check for the new validation logic
if echo "$JS_CONTENT" | grep -q "Completely removed false positive"; then
    echo "   ✅ NEW CODE DETECTED - Database validation is active"
else
    echo "   ❌ OLD CODE DETECTED - Database validation not found"
    echo ""
    echo "   The deployment didn't work. Try:"
    echo "   1. Run ./fix-heroku-deployment.sh"
    echo "   2. Or manually: heroku builds:cache:purge -a $APP_NAME"
    echo "   3. Then: git push heroku main --force"
fi

# Check for enhanced surname blacklist
if echo "$JS_CONTENT" | grep -q "'mad'"; then
    echo "   ✅ Enhanced surname blacklist found"
else
    echo "   ⚠️  Enhanced surname blacklist not found"
fi

# Check for apostrophe handling
if echo "$JS_CONTENT" | grep -q "a-zA-Z'"; then
    echo "   ✅ Apostrophe handling in regex found"
else
    echo "   ⚠️  Apostrophe handling not found"
fi

echo ""
echo "=================================="
echo "Verification complete!"

echo ""
echo "If any checks failed, run: ./fix-heroku-deployment.sh"
