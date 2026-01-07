import { useState, useEffect } from 'react'
import ImageUpload from './components/ImageUpload'
import TeamView from './components/TeamDisplay'
import './App.css'

function App() {
  const [confirmedTeam, setConfirmedTeam] = useState(null);
  const [view, setView] = useState('scanner'); // 'scanner' or 'team'
  
  // Tour state management
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(() => {
    // Check localStorage for tour completion status
    const saved = localStorage.getItem('onboardingTourCompleted');
    return saved === 'true';
  });

  useEffect(() => {
    // Save tour completion status to localStorage
    if (tourCompleted) {
      localStorage.setItem('onboardingTourCompleted', 'true');
    }
  }, [tourCompleted]);

  const handleStartTour = () => {
    setIsTourActive(true);
    setCurrentTourStep(0);
  };

  const handleTourNext = () => {
    setCurrentTourStep(prev => prev + 1);
  };

  const handleTourPrevious = () => {
    setCurrentTourStep(prev => Math.max(0, prev - 1));
  };

  const handleTourSkip = () => {
    setIsTourActive(false);
    setTourCompleted(true);
  };

  const handleTourComplete = () => {
    setIsTourActive(false);
    setTourCompleted(true);
  };

  const handlePlayersExtracted = (players, confirmed = false) => {
    if (confirmed && players.length > 0) {
      setConfirmedTeam(players);
      setView('team');
      // Advance tour to step 2 (status indicators) if tour is active
      // Only advance if we're still on landing page steps (0-1)
      if (isTourActive && currentTourStep <= 1) {
        // Small delay to ensure team view is rendered before showing tour
        setTimeout(() => {
          setCurrentTourStep(2);
        }, 300);
      }
    }
  };

  const handleBackToScanner = () => {
    setView('scanner');
    // Reset tour step if going back to scanner
    if (isTourActive) {
      setCurrentTourStep(0);
    }
  };

  if (view === 'team' && confirmedTeam) {
    return (
      <div className="app app-team-view">
        <TeamView 
          players={confirmedTeam} 
          onBack={handleBackToScanner}
          isTourActive={isTourActive}
          currentTourStep={currentTourStep}
          onTourNext={handleTourNext}
          onTourPrevious={handleTourPrevious}
          onTourSkip={handleTourSkip}
          onTourComplete={handleTourComplete}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Name Scanner</h1>
        <button 
          className="btn-new-to-app"
          onClick={handleStartTour}
          aria-label="Start onboarding tour"
        >
          <span className="btn-new-to-app-icon">ℹ️</span>
          <span>New to the app?</span>
        </button>
      </header>
      
      <main className="app-main">
        <ImageUpload 
          onPlayersExtracted={handlePlayersExtracted}
          isTourActive={isTourActive}
          currentTourStep={currentTourStep}
          onTourNext={handleTourNext}
          onTourPrevious={handleTourPrevious}
          onTourSkip={handleTourSkip}
          onTourComplete={handleTourComplete}
        />
      </main>
    </div>
  )
}

export default App
