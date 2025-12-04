# Fantasy Team Name Scanner - Setup Guide

This guide will help you set up and run the Fantasy Team Name Scanner with the NRL Trade Calculator backend.

## Architecture Overview

The application consists of two parts:
- **Frontend**: React app built with Vite (runs on port 5173)
- **Backend**: Python Flask API with trade calculation logic (runs on port 5002)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Python 3.11 or higher** - [Download here](https://www.python.org/downloads/)
- **PostgreSQL database** - Either Heroku-hosted or local

## Initial Setup

Follow these steps to set up the application for the first time:

### Step 1: Clone and Install Frontend Dependencies

```bash
# Navigate to the project directory (you're probably already here)
cd /path/to/team-name-scanner

# Install Node.js dependencies
npm install

# Make the backend scripts executable
npm run setup
```

### Step 2: Configure Environment Variables

Create a `.env` file in the project root with your database credentials:

```bash
# Copy the example file
cp env.example .env
```

Then edit the `.env` file and add your database credentials. If you're using Heroku PostgreSQL:

```env
DATABASE_URL=postgresql://username:password@host:port/database
FLASK_ENV=development
```

**To get your Heroku database URL:**
1. Go to your Heroku dashboard
2. Select your app
3. Go to Settings → Config Vars
4. Copy the `DATABASE_URL` value

Alternatively, if you have the `.env` file from the `fantasy_trade_calculator_deployment` folder, you can copy the `DATABASE_URL` from there.

### Step 3: Create Frontend Environment File

Create a `.env.local` file in the project root for frontend configuration:

```bash
# Copy the example file
cp env.local.example .env.local
```

The default content should be:
```env
VITE_API_URL=http://127.0.0.1:5002
```

### Step 4: Set Up the Python Backend

Run the setup script to create a virtual environment and install Python dependencies:

```bash
./setup-backend.sh
```

This script will:
- Create a Python virtual environment in `fantasy_trade_calculator_deployment/venv`
- Install all required Python packages
- Test your database connection
- Verify everything is working

**If you see a "permission denied" error**, make the script executable:
```bash
chmod +x setup-backend.sh
./setup-backend.sh
```

## Running the Application

You need to run both the backend and frontend simultaneously. Use two terminal windows/tabs:

### Terminal 1: Start the Backend

```bash
./start-backend.sh
```

You should see:
```
🚀 Starting Fantasy Trade Calculator Backend...
✓ Virtual environment activated
✓ Starting Flask server on http://127.0.0.1:5002
```

Keep this terminal running.

### Terminal 2: Start the Frontend

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open your browser to `http://localhost:5173` to use the application.

## Usage

1. **Upload Screenshots**: On the main page, upload screenshots of your NRL Fantasy team (in any order)
2. **Confirm Team**: Review the extracted team and confirm
3. **View My Team**: Your team will be displayed in formation
4. **Set Options**: Configure trade options:
   - Cash in Bank
   - Strategy (Value/Base/Hybrid)
   - Trade Type (Positional Swap/Like for Like)
   - Number of Trades
5. **Calculate Trades**: Click "Calculate Trade Recommendations" to get suggestions
6. **Review Recommendations**: See both trade-out and trade-in recommendations

## Troubleshooting

### Backend won't start

**Error: Virtual environment not found**
- Solution: Run `./setup-backend.sh` first

**Error: .env file not found**
- Solution: Create `.env` file with your database credentials (see Step 2)

**Error: Database connection failed**
- Check that your `DATABASE_URL` is correct in `.env`
- Ensure your database is accessible (not behind a firewall)
- Verify your database credentials are correct

### Frontend can't connect to backend

**Error: Failed to fetch**
- Ensure the backend is running (`./start-backend.sh`)
- Check that the backend is running on port 5002
- Verify `.env.local` has the correct `VITE_API_URL`

**CORS errors in browser console**
- The backend should have CORS enabled automatically
- Try restarting both frontend and backend

### Import/Module errors in Python

**Error: No module named 'flask_cors' (or other module)**
- Solution: Run `./setup-backend.sh` again to reinstall dependencies
- Or manually: `cd fantasy_trade_calculator_deployment && source venv/bin/activate && pip install -r requirements.txt`

### Permission denied on scripts

If you get "permission denied" when running `.sh` scripts:
```bash
chmod +x setup-backend.sh start-backend.sh
```

## Project Structure

```
team-name-scanner/
├── fantasy_trade_calculator_deployment/  # Python backend
│   ├── app.py                           # Flask application
│   ├── nrl_trade_calculator.py          # Trade calculation logic
│   ├── trade_recommendations.py         # Trade recommendation engine
│   ├── requirements.txt                 # Python dependencies
│   └── venv/                            # Python virtual environment (created by setup)
├── src/                                 # React frontend
│   ├── components/                      # React components
│   │   ├── ImageUpload.jsx             # Image upload & OCR
│   │   └── TeamDisplay.jsx             # Team display & trade UI
│   ├── services/
│   │   └── tradeApi.js                 # API calls to backend
│   └── App.jsx                          # Main app component
├── .env                                 # Backend environment variables (create this)
├── .env.local                           # Frontend environment variables (create this)
├── env.example                          # Example backend env file
├── env.local.example                    # Example frontend env file
├── setup-backend.sh                     # Backend setup script
├── start-backend.sh                     # Backend startup script
├── package.json                         # Node.js dependencies
├── vite.config.js                       # Vite configuration (includes API proxy)
└── SETUP.md                             # This file
```

## Development Tips

### Stopping the Application

- **Backend**: Press `Ctrl+C` in the terminal running the backend
- **Frontend**: Press `Ctrl+C` in the terminal running the frontend

### Restarting After Changes

**Python/Backend changes:**
- Stop the backend (`Ctrl+C`)
- Run `./start-backend.sh` again

**React/Frontend changes:**
- Vite has hot-reload enabled, changes should appear automatically
- If not, stop (`Ctrl+C`) and run `npm run dev` again

### Checking Logs

**Backend logs**: Visible in the terminal running `./start-backend.sh`

**Frontend logs**: 
- Browser console (F12 → Console tab)
- Terminal running `npm run dev`

### Database Updates

If you need to update the database schema or data:

1. Update the source Excel/CSV files in `fantasy_trade_calculator_deployment/`
2. Run the database initialization script:
```bash
cd fantasy_trade_calculator_deployment
source venv/bin/activate
python init_heroku_db.py
```

## API Endpoints

The backend provides these endpoints (all require the backend to be running):

- `POST /calculate_team_trades` - Calculate trade recommendations for a team
- `GET /players` - Get list of all players
- `GET /get_player_names_with_prices` - Get players with prices
- `POST /check_player_lockout` - Check if a player is locked out

The frontend communicates with these automatically through the Vite proxy.

## Need Help?

If you encounter issues not covered here:

1. Check that both frontend and backend are running
2. Check browser console for errors (F12)
3. Check backend terminal for Python errors
4. Verify all environment variables are set correctly
5. Try running `./setup-backend.sh` again to refresh the Python environment

## Next Steps

Once you have the application running:

1. Test the image upload with your team screenshots
2. Verify trade calculations are working
3. Consider adding the application to your deployment pipeline
4. Review the `DEPLOYMENT_CHECKLIST.md` for production deployment

Enjoy using your Fantasy Team Name Scanner! 🏈📊

