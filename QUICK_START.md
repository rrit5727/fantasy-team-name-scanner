# Quick Start Guide - Trade Recommendations Feature

## Overview
Your team-name-scanner app now includes automated trade recommendations! Upload screenshots of your NRL Fantasy team and get intelligent suggestions for players to trade out and trade in.

## How It Works

1. **Upload Screenshots** → Extract player names, positions, and prices
2. **Confirm Team** → View your team in formation
3. **Calculate Trades** → Get automated recommendations:
   - **Trade Out**: Injured players + overvalued players (lowest upside)
   - **Trade In**: Undervalued players (highest upside) within your salary cap

## Running the App

### Step 1: Start the Backend (Flask)

Open Terminal 1:
```bash
cd fantasy_trade_calculator_deployment
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5002
```

### Step 2: Start the Frontend (React)

Open Terminal 2:
```bash
npm run dev
```

You should see:
```
Local:   http://localhost:5173/
```

### Step 3: Use the App

1. Open browser to `http://localhost:5173`
2. Upload 2 screenshots of your team (any order)
3. Review extracted players
4. Click "✓ Confirm Team"
5. In sidebar, enter "Cash in Bank" (optional)
6. Click "Calculate Trade Recommendations"
7. Review trade-out and trade-in suggestions

## What You'll See

### Trade-Out Recommendations
```
⚠️ N. Lawson - $268k - Injured
📉 L. King-Togia - $393k - Low Upside (-5.2)
```

### Trade-In Recommendations
```
Option 1 - Upside: 15.3
├─ HLF J. Reynolds - $420k
└─ CTR K. Feeney - $310k
Total: $730k | Remaining: $20k
```

## Algorithm Explained

### Trade-Out Logic (New)
1. **Priority 1**: Players NOT in `teamlists.csv` (injured)
2. **Priority 2**: Players with lowest Diff (most overvalued)

This is the **inverse** of the trade-in algorithm.

### Trade-In Logic (Existing)
Uses your proven `nrl_trade_calculator.py`:
- Filters to players in `teamlists.csv`
- Finds highest Diff (most undervalued)
- Respects salary cap = trade-out prices + cash in bank
- Returns top 10 combinations

## Strategies

- **Maximize Value (Diff)**: Best upside potential
- **Maximize Base (Projection)**: Highest projected scores
- **Hybrid Approach**: Balanced recommendations (default)

## Troubleshooting

### "Failed to calculate trades"
- Check Flask server is running on port 5002
- Verify database is initialized: `python init_heroku_db.py`

### No prices showing
- Ensure screenshots clearly show prices (e.g., "$710k")
- Check OCR debug output (expand in app)

### Backend not connecting
- Ensure Flask is on port 5002
- Check for CORS errors in browser console
- Verify `teamlists.csv` and `NRL_stats.csv` exist in Flask directory

## Files You Need

In `fantasy_trade_calculator_deployment/`:
- `NRL_stats.csv` ✓ (player statistics)
- `teamlists.csv` ✓ (current team lists for injury detection)
- `app.py` ✓ (Flask server)
- `trade_recommendations.py` ✓ (new - trade logic)
- `nrl_trade_calculator.py` ✓ (existing algorithm)

## Key Features

✅ **Price Extraction**: Automatically reads prices from screenshots  
✅ **Injury Detection**: Flags players not in teamlists.csv  
✅ **Smart Recommendations**: Uses proven value algorithm  
✅ **Salary Cap Management**: Calculates freed-up funds automatically  
✅ **Multiple Options**: Shows top 10 trade combinations  
✅ **Visual Feedback**: Clear UI with reasons for each recommendation  

## Next Steps

After testing, you mentioned future enhancements:
1. Use database prices instead of OCR (for accuracy)
2. Add dedicated injury list API
3. Create separate page for original calculator
4. Allow manual trade-out selection
5. Track trade history

## Documentation

- **TRADE_RECOMMENDATIONS_GUIDE.md**: Detailed testing procedures
- **IMPLEMENTATION_SUMMARY.md**: Technical implementation details
- **QUICK_START.md**: This guide

## Support

Having issues? Check:
1. Browser console (F12) for frontend errors
2. Flask terminal for backend errors
3. OCR debug output (expand in app)
4. Player name matching in database

Enjoy your automated trade recommendations! 🏉📊

