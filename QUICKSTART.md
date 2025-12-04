# Quick Start Guide

Get up and running in 5 minutes!

## First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   npm run setup
   ```

2. **Configure database:**
   ```bash
   # Copy the example file
   cp env.example .env
   
   # Edit .env and add your Heroku PostgreSQL DATABASE_URL
   # Get this from: Heroku Dashboard → Your App → Settings → Config Vars → DATABASE_URL
   ```

3. **Set up backend:**
   ```bash
   ./setup-backend.sh
   ```

4. **Create frontend config:**
   ```bash
   cp env.local.example .env.local
   # No need to edit - defaults are correct
   ```

## Running the App

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
./start-backend.sh
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Then open http://localhost:5173 in your browser!

## Troubleshooting

- **Permission denied on scripts?** Run: `chmod +x *.sh`
- **Database connection error?** Double-check your `DATABASE_URL` in `.env`
- **Backend not found?** Make sure you ran `./setup-backend.sh` first

See [SETUP.md](SETUP.md) for detailed instructions and troubleshooting.

