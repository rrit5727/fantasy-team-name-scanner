# Trade Recommendations Feature - Testing Guide

## Overview

The Trade Recommendations feature automatically analyzes your NRL Fantasy team (extracted from screenshots) and provides intelligent trade suggestions:

1. **Trade-Out Recommendations**: Identifies players to trade out based on:
   - Injury status (players not in teamlists.csv)
   - Lowest upside (inverse of value algorithm - overvalued players)

2. **Trade-In Recommendations**: Suggests replacement players using the existing value algorithm from nrl_trade_calculator.py

## Setup Instructions

### Backend Setup (Flask)

1. Navigate to the Flask app directory:
```bash
cd fantasy_trade_calculator_deployment
```

2. Ensure you have the required files:
   - `NRL_stats.csv` - Player statistics
   - `teamlists.csv` - Current team lists (for injury detection)

3. Initialize the database (if not already done):
```bash
python init_heroku_db.py
```

4. Start the Flask server:
```bash
python app.py
```

The server should start on `http://127.0.0.1:5002`

### Frontend Setup (React/Vite)

1. Navigate to the project root:
```bash
cd ..
```

2. Install dependencies (if not already done):
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app should open at `http://localhost:5173`

## Testing the Feature

### Step 1: Upload Team Screenshots

1. Open the app in your browser
2. Upload 2 screenshots of your NRL Fantasy team
3. The app will extract:
   - Player names
   - Positions (HOK, MID, EDG, HLF, CTR, WFB)
   - Prices (e.g., $710k, $609k)

4. Verify the extracted players look correct
5. Click "✓ Confirm Team"

### Step 2: Configure Trade Options

In the "My Team" view sidebar, you'll see:

1. **Cash in Bank**: Enter any additional cash available (e.g., 50000 for $50k)
2. **Strategy**: Choose optimization approach:
   - Maximize Value (Diff) - Best upside potential
   - Maximize Base (Projection) - Highest projected scores
   - Hybrid Approach - Balanced value + projection
3. **Trade Type**: 
   - Positional Swap - More flexible positioning
   - Like for Like - Strict position matching
4. **Number of Trades**: 1-3 players to trade

### Step 3: Calculate Recommendations

1. Click "Calculate Trade Recommendations"
2. The app will:
   - Send team data to Flask backend
   - Calculate trade-out recommendations (injured + low upside)
   - Calculate trade-in recommendations (using existing algorithm)
   - Display results in the sidebar

### Step 4: Review Results

**Trade-Out Recommendations** will show:
- Player name and position
- Price (e.g., $710k)
- Reason: 
  - ⚠️ Injured - Player not in teamlists.csv
  - 📉 X.X - Low upside score (Diff value)

**Trade-In Recommendations** will show multiple options:
- Option 1, 2, 3... with combined upside/projection
- Each option shows 2 players (for 2-player trade)
- Individual player details: position, name, price
- Total cost and salary remaining

## Expected Behavior

### Trade-Out Logic

The algorithm prioritizes:
1. **Injured Players First**: Any players in your team NOT found in teamlists.csv
2. **Low Upside Players**: If more trade-outs needed, selects players with lowest Diff values (most overvalued)

Example:
```
If teamlists.csv doesn't include "N. Lawson" and your team has him:
→ N. Lawson recommended for trade-out (reason: injured)

If you need 2 trade-outs and only 1 injured:
→ Also trades out player with lowest Diff (e.g., Diff: -5.2)
```

### Trade-In Logic

Uses the existing nrl_trade_calculator.py algorithm:
- Salary cap = (trade-out prices) + cash in bank
- Filters to players in teamlists.csv
- Applies selected strategy (value/base/hybrid)
- Returns top 10 combinations

## Testing Scenarios

### Scenario 1: Injured Player Detection
**Setup**: Remove a player from teamlists.csv who's in your team
**Expected**: That player appears in trade-out with "⚠️ Injured" tag

### Scenario 2: Low Upside Detection
**Setup**: Upload team with no injured players
**Expected**: Players with lowest Diff values recommended for trade-out

### Scenario 3: Price Extraction
**Setup**: Upload screenshots with visible prices (e.g., "$710k")
**Expected**: 
- Prices displayed on player cards in My Team view
- Correct salary freed calculation
- Trade-in recommendations within salary cap

### Scenario 4: Strategy Comparison
**Setup**: Calculate trades with different strategies
**Expected**:
- Strategy 1 (Value): Highest Diff totals
- Strategy 2 (Base): Highest Projection totals
- Strategy 3 (Hybrid): Balanced recommendations

## Troubleshooting

### No Prices Extracted
**Symptom**: Player cards don't show prices
**Solution**: 
- Ensure screenshots show prices clearly
- Check OCR output (expand Debug section)
- Prices should match pattern: `$XXXk` or `$XXXXk`

### Backend Connection Error
**Symptom**: "Failed to calculate trades" error
**Solution**:
- Verify Flask server is running on port 5002
- Check browser console for CORS errors
- Ensure database is initialized with player data

### No Trade Recommendations
**Symptom**: Empty trade-out or trade-in lists
**Solution**:
- Verify teamlists.csv exists in Flask directory
- Check that NRL_stats.csv has recent data
- Ensure player names match exactly between screenshot and database

### Invalid Player Names
**Symptom**: Players not recognized by backend
**Solution**:
- Check exact spelling in NRL_stats.csv
- OCR might misread names (check debug output)
- Manually correct player names before confirming team

## API Endpoint Details

### POST /calculate_team_trades

**Request Body**:
```json
{
  "team_players": [
    {
      "name": "E. Clark",
      "positions": ["HOK"],
      "price": 710000
    },
    ...
  ],
  "cash_in_bank": 50000,
  "strategy": "3",
  "trade_type": "positionalSwap",
  "num_trades": 2
}
```

**Response**:
```json
{
  "trade_out": [
    {
      "name": "N. Lawson",
      "positions": ["CTR"],
      "price": 268000,
      "reason": "injured",
      "diff": null
    },
    {
      "name": "L. King-Togia",
      "positions": ["HLF"],
      "price": 393000,
      "reason": "low_upside",
      "diff": -5.2
    }
  ],
  "trade_in": [
    {
      "players": [...],
      "totalPrice": 650000,
      "totalDiff": 15.3,
      "salaryRemaining": 11000
    }
  ],
  "total_salary_freed": 661000
}
```

## Files Modified/Created

### New Files:
- `fantasy_trade_calculator_deployment/trade_recommendations.py` - Core trade logic
- `src/services/tradeApi.js` - API client
- `TRADE_RECOMMENDATIONS_GUIDE.md` - This guide

### Modified Files:
- `src/components/ImageUpload.jsx` - Price extraction from OCR
- `src/components/TeamDisplay.jsx` - UI for trade recommendations
- `src/components/TeamDisplay.css` - Styling for new UI elements
- `fantasy_trade_calculator_deployment/app.py` - New Flask endpoint

## Future Enhancements

As mentioned in the requirements:

1. **Database Price Lookup**: Use prices from NRL_stats.csv instead of OCR (for up-to-date prices)
2. **Explicit Injury List**: Dedicated injury tracking beyond teamlists.csv
3. **Multi-Page App**: Separate page for original trade calculator vs. team analysis
4. **Manual Trade Selection**: Allow users to override trade-out recommendations
5. **Trade History**: Track and save previous trade decisions

## Support

For issues or questions, check:
- Console logs (browser DevTools)
- Flask server logs (terminal)
- OCR debug output (expand in app)

