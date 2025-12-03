import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import TeamView from './components/TeamDisplay'
import './App.css'

function App() {
  const [confirmedTeam, setConfirmedTeam] = useState(null);
  const [view, setView] = useState('scanner'); // 'scanner' or 'team'

  const handlePlayersExtracted = (players, confirmed = false) => {
    if (confirmed && players.length > 0) {
      setConfirmedTeam(players);
      setView('team');
    }
  };

  const handleBackToScanner = () => {
    setView('scanner');
  };

  if (view === 'team' && confirmedTeam) {
    return (
      <div className="app app-team-view">
        <TeamView 
          players={confirmedTeam} 
          onBack={handleBackToScanner}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Name Scanner</h1>
        <p className="subtitle">Upload screenshots in any order - auto-detects correct sequence</p>
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
