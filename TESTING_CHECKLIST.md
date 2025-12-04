# Testing Checklist

Use this checklist to verify everything is working correctly after setup.

## Pre-Flight Checks

Before starting the application, verify:

- [ ] `.env` file exists in project root with `DATABASE_URL`
- [ ] `.env.local` file exists in project root with `VITE_API_URL`
- [ ] Node modules installed (`node_modules/` directory exists)
- [ ] Python virtual environment exists (`fantasy_trade_calculator_deployment/venv/`)
- [ ] Scripts are executable (`setup-backend.sh` and `start-backend.sh`)

## Backend Testing

- [ ] Backend starts without errors (`./start-backend.sh`)
- [ ] Flask server is running on http://127.0.0.1:5002
- [ ] Database connection is successful (check terminal output)
- [ ] No import errors or missing modules

### Test Backend Endpoints

Open another terminal and test these endpoints:

```bash
# Test players endpoint
curl http://127.0.0.1:5002/players

# Should return a JSON array of player names
```

Expected: JSON array with player names, not an error message.

## Frontend Testing

- [ ] Frontend starts without errors (`npm run dev`)
- [ ] Vite dev server is running on http://localhost:5173
- [ ] No console errors in terminal
- [ ] Page loads in browser

### Browser Testing

Open http://localhost:5173 in your browser and verify:

- [ ] Page loads without errors
- [ ] Browser console has no errors (F12 → Console)
- [ ] "Team Name Scanner" header is visible
- [ ] Image upload area is visible

## Integration Testing

Test the full workflow:

### 1. Image Upload
- [ ] Click or drag-and-drop to upload team screenshot
- [ ] OCR processing starts (loading indicator)
- [ ] Player names are extracted and displayed
- [ ] Prices are extracted correctly

### 2. Team Confirmation
- [ ] Extracted players are shown in a list/preview
- [ ] Can edit or remove incorrectly extracted players
- [ ] Click "Confirm" button
- [ ] Redirected to team view

### 3. Team Display
- [ ] Team is displayed in correct formation
- [ ] All positions are filled
- [ ] Player names are readable
- [ ] Prices are shown correctly (in $XXXk format)

### 4. Trade Calculation Setup
- [ ] Cash in Bank input field is visible
- [ ] Can enter a cash amount
- [ ] Strategy dropdown has 3 options:
  - Maximize Value (Diff)
  - Maximize Base (Projection)
  - Hybrid Approach
- [ ] Trade Type dropdown has 2 options:
  - Positional Swap
  - Like for Like
- [ ] Number of Trades input (min: 1, max: 3)

### 5. Calculate Trades
- [ ] Click "Calculate Trade Recommendations" button
- [ ] Button shows "Calculating..." while processing
- [ ] No CORS errors in browser console
- [ ] Trade recommendations appear after calculation

### 6. Trade Recommendations
- [ ] **Trade Out** section shows:
  - Player names
  - Positions
  - Prices
  - Reason (injured or low upside with diff)
- [ ] **Trade In** section shows:
  - Multiple options (up to 10)
  - Each option shows 1-3 players (based on num_trades)
  - Player details: name, position, team, price
  - Total price and salary remaining
  - Upside (Diff) or Projection value

### 7. Error Handling
- [ ] Test with no cash in bank (should still work)
- [ ] Test with invalid image (should show error)
- [ ] Test with backend stopped (should show connection error)

## Common Issues to Check

### CORS Errors
If you see CORS errors in browser console:
- Check that backend has `flask-cors` installed
- Verify backend is running
- Check that frontend is accessing correct URL

### Database Errors
If backend shows database errors:
- Verify `DATABASE_URL` in `.env` is correct
- Check database is accessible (not firewalled)
- Ensure database has the `player_stats` table

### OCR Not Working
If text extraction fails:
- Check image quality (should be clear, high resolution)
- Verify player names are visible in the screenshot
- Try different screenshot formats (PNG, JPEG)

### API Calls Failing
If trade calculations fail:
- Check browser Network tab (F12 → Network)
- Look for failed requests to `/calculate_team_trades`
- Check backend terminal for Python errors
- Verify request payload format

## Performance Checks

- [ ] Image upload processes in < 10 seconds
- [ ] Trade calculation completes in < 5 seconds
- [ ] No memory leaks (check browser Task Manager)
- [ ] Backend doesn't crash after multiple calculations

## Test Results

Date tested: _______________

Tested by: _______________

Issues found:
- 
- 
- 

All tests passing: [ ] YES [ ] NO

Notes:

