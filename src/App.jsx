import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import './App.css'

function App() {
  const [allPlayers, setAllPlayers] = useState([]);

  const handlePlayersExtracted = (players) => {
    setAllPlayers(prev => {
      const combined = [...prev, ...players];
      return [...new Set(combined)]; // Remove duplicates
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Name Scanner</h1>
        <p className="subtitle">Upload team screenshots to extract player names & positions</p>
      </header>
      
      <main className="app-main">
        <ImageUpload onPlayersExtracted={handlePlayersExtracted} />
      </main>

      <footer className="app-footer">
        <p>Upload screenshots from NRL Fantasy, SuperCoach, or similar apps</p>
      </footer>
    </div>
  )
}

export default App
