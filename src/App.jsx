import { useState, useEffect } from 'react'
import ImageUpload from './components/ImageUpload'
import TeamView from './components/TeamDisplay'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'

function App() {
  const [confirmedTeam, setConfirmedTeam] = useState(null);
  const [view, setView] = useState('scanner');
  
  // Tour state management
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(() => {
    const saved = localStorage.getItem('onboardingTourCompleted');
    return saved === 'true';
  });

  useEffect(() => {
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
      if (isTourActive && currentTourStep <= 1) {
        setTimeout(() => {
          setCurrentTourStep(2);
        }, 300);
      }
    }
  };

  const handleBackToScanner = () => {
    setView('scanner');
    if (isTourActive) {
      setCurrentTourStep(0);
    }
  };

  if (view === 'team' && confirmedTeam) {
    return (
      <div className="app min-h-screen">
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
    <div className="app min-h-screen flex flex-col">
      <header className="app-header text-center py-6 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-1 tracking-tight">
          Fantasy Trade Calculator
        </h1>
        <h3 className="text-lg sm:text-xl text-muted-foreground font-medium mb-4">
          Team Scanner
        </h3>
        <Button 
          variant="outline"
          onClick={handleStartTour}
          aria-label="Start onboarding tour"
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          <Info className="w-4 h-4 mr-2" />
          New to the app?
        </Button>
      </header>
      
      <main className="app-main flex-1 flex flex-col px-4 pb-8">
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
