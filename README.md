# Fantasy Team Name Scanner

A React-based web application for scanning NRL Fantasy team screenshots and getting AI-powered trade recommendations.

## Features

- 📸 **Screenshot Upload**: Upload screenshots of your fantasy team in any order
- 🔍 **OCR Text Extraction**: Automatically extracts player names and prices using Tesseract.js
- 🏈 **Team Display**: Beautiful visual display of your team in formation
- 💡 **Trade Recommendations**: Get intelligent trade suggestions based on:
  - Player injury status
  - Performance projections
  - Value calculations
  - Multiple trading strategies
- 🔄 **Multiple Trade Options**: Compare different trade combinations
- 💰 **Salary Cap Management**: Track your cash in bank and remaining salary

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tesseract.js** - OCR for text extraction from images

### Backend
- **Python/Flask** - REST API server
- **Pandas** - Data manipulation and analysis
- **PostgreSQL** - Player statistics database
- **SQLAlchemy** - Database ORM

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for a 5-minute setup guide.

For detailed setup instructions, see [SETUP.md](SETUP.md).

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  React Frontend │ ◄────► │  Flask Backend   │
│  (Port 5173)    │  CORS   │  (Port 5002)     │
└─────────────────┘         └──────────────────┘
        │                            │
        │                            ▼
        │                   ┌─────────────────┐
        │                   │   PostgreSQL    │
        │                   │    Database     │
        └──────────────────►└─────────────────┘
       (OCR Processing)      (Player Stats)
```

## Project Structure

- `/src` - React frontend code
  - `/components` - React components (ImageUpload, TeamDisplay)
  - `/services` - API service for backend communication
- `/fantasy_trade_calculator_deployment` - Python Flask backend
  - `app.py` - Flask application and API endpoints
  - `nrl_trade_calculator.py` - Trade calculation engine
  - `trade_recommendations.py` - Recommendation algorithms
- Setup scripts for easy development workflow

## Development

### Running Locally

1. Start the backend (Terminal 1):
   ```bash
   ./start-backend.sh
   ```

2. Start the frontend (Terminal 2):
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173

### Making Changes

- **Frontend changes**: Auto-reload with Vite HMR
- **Backend changes**: Restart the Flask server

## Documentation

- [SETUP.md](SETUP.md) - Complete setup guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [TRADE_RECOMMENDATIONS_GUIDE.md](TRADE_RECOMMENDATIONS_GUIDE.md) - Trade algorithm details

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

Private project - All rights reserved
