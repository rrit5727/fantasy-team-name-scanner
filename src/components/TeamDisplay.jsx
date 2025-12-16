import React from 'react';
import './TeamDisplay.css';

// Helper function to format numbers with comma separators
const formatNumberWithCommas = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Position order for NRL Fantasy team display
const POSITION_CONFIG = {
  HOK: { label: 'HOK', count: 1, color: '#00d9a3' },
  MID: { label: 'MID', count: 3, color: '#00d9a3' },
  EDG: { label: 'EDG', count: 2, color: '#00d9a3' },
  HLF: { label: 'HLF', count: 2, color: '#f5a623' },
  CTR: { label: 'CTR', count: 2, color: '#00d9a3' },
  WFB: { label: 'WFB', count: 3, color: '#00d9a3' },
  INT: { label: 'INT', count: 4, color: '#d98cd9' },
  EMG: { label: 'EMG', count: 4, color: '#e8927c' },
};

const POSITION_ORDER = ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB', 'INT', 'EMG'];

function TeamDisplay({
  players,
  onTradeOut,
  selectedTradeOut,
  // Pre-season mode props
  isPreseasonMode = false,
  preseasonHighlighted = [],
  preseasonSelectedOut = [],
  preseasonTradedIn = [],
  onPreseasonClick,
  // Player status indicator props
  injuredPlayers = [],
  lowUpsidePlayers = [],
  notSelectedPlayers = [],
  junkCheapies = [],
  // Normal mode trade recommendations
  normalModeHighlighted = [],
  normalModePriorities = {}
}) {
  // Group players by their primary position
  const groupedPlayers = {};
  POSITION_ORDER.forEach(pos => {
    groupedPlayers[pos] = [];
  });

  // Assign players to positions based on their extracted position or order
  let playerIndex = 0;
  
  // First, try to place players by their detected position
  const unassigned = [];
  players.forEach(player => {
    const primaryPos = player.positions?.[0];
    if (primaryPos && groupedPlayers[primaryPos] && 
        groupedPlayers[primaryPos].length < POSITION_CONFIG[primaryPos]?.count) {
      groupedPlayers[primaryPos].push(player);
    } else {
      unassigned.push(player);
    }
  });

  // Fill remaining slots in order with unassigned players
  POSITION_ORDER.forEach(pos => {
    const config = POSITION_CONFIG[pos];
    while (groupedPlayers[pos].length < config.count && unassigned.length > 0) {
      groupedPlayers[pos].push(unassigned.shift());
    }
  });

  // Helper to check if player is in a list by name
  const isPlayerInList = (player, list) => {
    return list.some(p => p.name === player.name);
  };

  // Helper to check if player is injured (by name string match)
  const isPlayerInjured = (player) => {
    if (!player || !injuredPlayers || injuredPlayers.length === 0) return false;
    return injuredPlayers.some(injuredName => 
      injuredName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is low-upside/overvalued (by name string match)
  const isPlayerLowUpside = (player) => {
    if (!player || !lowUpsidePlayers || lowUpsidePlayers.length === 0) return false;
    return lowUpsidePlayers.some(lowUpsideName =>
      lowUpsideName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is not selected (by name string match)
  const isPlayerNotSelected = (player) => {
    if (!player || !notSelectedPlayers || notSelectedPlayers.length === 0) return false;
    return notSelectedPlayers.some(notSelectedName =>
      notSelectedName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  // Helper to check if player is a junk cheapie (by name string match)
  const isPlayerJunkCheap = (player) => {
    if (!player || !junkCheapies || junkCheapies.length === 0) return false;
    return junkCheapies.some(junkName =>
      junkName.toLowerCase() === player.name?.toLowerCase()
    );
  };

  const renderPlayerCard = (player, position, index) => {
    if (!player) {
      return (
        <div key={`empty-${position}-${index}`} className="player-card empty">
          <div className="position-badge" style={{ background: POSITION_CONFIG[position]?.color }}>
            {position}
          </div>
          <div className="player-info">
            <span className="empty-slot">Empty</span>
          </div>
        </div>
      );
    }

    // Check player status
    const isInjured = isPlayerInjured(player);
    const isLowUpside = isPlayerLowUpside(player);
    const isNotSelected = isPlayerNotSelected(player);
    const isJunkCheap = isPlayerJunkCheap(player);

    // Check if player is highlighted in normal mode
    const isNormalModeHighlighted = normalModeHighlighted?.some(p => p.name === player.name);
    const normalModePriority = normalModePriorities?.[player.name];

    // Determine CSS classes based on preseason mode state
    let cardClasses = 'player-card';
    
    if (isPreseasonMode) {
      // Check if this player was traded in (replaces a traded out player)
      if (isPlayerInList(player, preseasonTradedIn)) {
        cardClasses += ' preseason-traded-in';
      }
      // Check if player is selected for trade out
      else if (isPlayerInList(player, preseasonSelectedOut)) {
        // Use different selected styles based on whether injured or low-upside
        if (isInjured) {
          cardClasses += ' preseason-selected-out-injured';
        } else {
          cardClasses += ' preseason-selected-out-lowupside';
        }
      }
      // Check if player is highlighted as a trade-out recommendation
      else if (isPlayerInList(player, preseasonHighlighted)) {
        // Use different highlight styles based on whether injured or low-upside
        if (isInjured) {
          cardClasses += ' preseason-highlight-injured';
        } else {
          cardClasses += ' preseason-highlight-lowupside';
        }
      }
    } else {
      // Normal mode - check for highlighting and selection
      const isSelected = selectedTradeOut?.name === player.name;
      if (isSelected) {
        cardClasses += ' selected';
      } else if (isNormalModeHighlighted) {
        // Use different highlight styles based on player status
        if (isInjured) {
          cardClasses += ' preseason-highlight-injured';
        } else {
          cardClasses += ' preseason-highlight-lowupside';
        }
      }
    }

    const handleClick = () => {
      if (isPreseasonMode && onPreseasonClick) {
        onPreseasonClick(player, position);
      } else if (onTradeOut) {
        onTradeOut(player, position);
      }
    };

    return (
      <div
        key={player.name}
        className={cardClasses}
        onClick={handleClick}
      >
        {/* Priority indicator for normal mode trade recommendations */}
        {normalModePriority && (
          <div className="priority-indicator">
            {normalModePriority}
          </div>
        )}
        {/* Injury indicator - warning triangle with exclamation mark */}
        {isInjured && (
          <div className="injury-indicator">
            <svg viewBox="0 0 24 24" className="warning-icon">
              {/* Warning triangle */}
              <path d="M12 2L22 20H2L12 2Z" fill="#ff9800"/>
              {/* Exclamation mark */}
              <path d="M12 8V14" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="1" fill="#000000"/>
            </svg>
            <div className="tooltip">player injured</div>
          </div>
        )}
        {/* Low upside indicator - green banknote with red arrow in top-right */}
        {isLowUpside && !isInjured && (
          <div className="lowupside-indicator">
            <svg viewBox="0 0 24 24" className="lowupside-icon">
              {/* Banknote (green) */}
              <rect x="2" y="6" width="14" height="10" rx="1" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.5"/>
              <circle cx="9" cy="11" r="2.5" fill="#2E7D32"/>
              <text x="9" y="12.5" textAnchor="middle" fontSize="4" fill="#fff" fontWeight="bold">$</text>
              {/* Downward arrow (red) */}
              <path d="M18 4 L18 16 L14 12 M18 16 L22 12" stroke="#e53935" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="tooltip">overvalued - will lose money</div>
          </div>
        )}
        {/* Not selected indicator - prohibition symbol */}
        {isNotSelected && !isInjured && !isLowUpside && (
          <div className="not-selected-indicator">
            <svg viewBox="0 0 24 24" className="prohibition-icon">
              {/* Circle */}
              <circle cx="12" cy="12" r="10" fill="none" stroke="#e53935" strokeWidth="2"/>
              {/* Diagonal line */}
              <path d="M7 7L17 17" stroke="#e53935" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="tooltip">not selected</div>
          </div>
        )}
        {/* Junk cheapies indicator - poo emoji */}
        {isJunkCheap && !isInjured && !isLowUpside && (
          <div className="junk-cheap-indicator">
            💩
            <div className="tooltip">junk cheapie - trade out</div>
          </div>
        )}
        <div className="position-badge" style={{ background: POSITION_CONFIG[position]?.color }}>
          {position}
        </div>
        <div className="player-info">
          <span className="player-name">{player.name}</span>
        {player.price && (
          <span className="player-price">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
        )}
        </div>
      </div>
    );
  };

  const renderPositionRow = (position) => {
    const config = POSITION_CONFIG[position];
    const posPlayers = groupedPlayers[position] || [];
    
    // Pad array to expected count
    const paddedPlayers = [...posPlayers];
    while (paddedPlayers.length < config.count) {
      paddedPlayers.push(null);
    }

    return (
      <div key={position} className={`position-row position-${position.toLowerCase()}`}>
        {paddedPlayers.map((player, idx) => renderPlayerCard(player, position, idx))}
      </div>
    );
  };

  return (
    <div className="team-display">
      <div className="team-field">
        {POSITION_ORDER.map(pos => renderPositionRow(pos))}
      </div>
    </div>
  );
}

function TradePanel({ 
  title, 
  subtitle, 
  players, 
  onSelect, 
  selectedPlayer, 
  selectedPlayers,
  selectedOptionIndex,
  onConfirmOption,
  emptyMessage, 
  isTradeOut, 
  isTradeIn,
  showConfirmButton
}) {
  return (
    <div className="trade-panel">
      <h4 className="trade-subtitle">{subtitle}</h4>
      <div className="trade-player-list">
        {players && players.length > 0 ? (
          isTradeOut ? (
            // Trade-out display
            players.map((player, index) => (
              <div 
                key={player.name || index}
                className={`trade-player-item ${
                  selectedPlayer?.name === player.name || selectedPlayers?.some(p => p.name === player.name)
                    ? 'selected'
                    : ''
                }`}
                onClick={() => onSelect?.(player)}
              >
                <span className="trade-player-pos">
                  {player.positions?.[0] || '—'}
                </span>
                <span className="trade-player-name">{player.name}</span>
                {player.price && (
                  <span className="trade-player-price">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
                )}
                {player.reason && (
                  <span className={`trade-player-reason ${player.reason}`}>
                    {player.reason === 'injured' ? '⚠️ Injured' : `📉 ${player.diff?.toFixed(1)}`}
                  </span>
                )}
              </div>
            ))
          ) : isTradeIn ? (
            // Trade-in display (options with multiple players)
            players.map((option, index) => (
              <div 
                key={index}
                className={`trade-option ${selectedOptionIndex === index ? 'selected' : ''}`}
                onClick={() => onSelect?.(option, index)}
              >
                <div className="trade-option-header">
                  <span className="option-number">Option {index + 1}</span>
                  {option.totalDiff && (
                    <span className="option-diff">Upside: {option.totalDiff.toFixed(1)}</span>
                  )}
                  {option.totalProjection && (
                    <span className="option-projection">Proj: {option.totalProjection.toFixed(1)}</span>
                  )}
                </div>
                {option.players.map((player, pIndex) => (
                  <div key={pIndex} className="trade-option-player">
                    <span className="trade-player-pos">{player.position}</span>
                    <span className="trade-player-name">{player.name}</span>
                    <span className="trade-player-price">${formatNumberWithCommas(Math.round(player.price / 1000))}k</span>
                  </div>
                ))}
                <div className="trade-option-footer">
                  <span>Total: ${formatNumberWithCommas(Math.round(option.totalPrice / 1000))}k</span>
                  <span>Remaining: ${formatNumberWithCommas(Math.round(option.salaryRemaining / 1000))}k</span>
                </div>
                {showConfirmButton && selectedOptionIndex === index && (
                  <button
                    className="btn-confirm-trade-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmOption?.();
                    }}
                  >
                    Confirm Trade
                  </button>
                )}
              </div>
            ))
          ) : (
            // Default display
          players.map((player, index) => (
            <div 
              key={player.name || index}
              className={`trade-player-item ${selectedPlayer?.name === player.name ? 'selected' : ''}`}
              onClick={() => onSelect?.(player)}
            >
              <span className="trade-player-pos">
                {player.positions?.[0] || '—'}
              </span>
              <span className="trade-player-name">{player.name}</span>
            </div>
          ))
          )
        ) : (
          <p className="empty-message">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

function TeamView({ players, onBack }) {
  const [teamPlayers, setTeamPlayers] = React.useState(players || []);
  const [cashInBank, setCashInBank] = React.useState(0);
  const [cashInBankDisplay, setCashInBankDisplay] = React.useState('');
  const [tradeOutRecommendations, setTradeOutRecommendations] = React.useState([]);
  const [tradeInRecommendations, setTradeInRecommendations] = React.useState([]);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [selectedStrategy, setSelectedStrategy] = React.useState('1'); // Default to Maximize Value
  const [selectedTradeType, setSelectedTradeType] = React.useState('likeForLike'); // Default to Like for Like
  const [numTrades, setNumTrades] = React.useState(2);
  const [selectedPositions, setSelectedPositions] = React.useState([]); // For positional swap
  const [targetByeRound, setTargetByeRound] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [showTradeModal, setShowTradeModal] = React.useState(false);
  const [showTradeInPage, setShowTradeInPage] = React.useState(false); // Trade-in recommendations page
  const [isCalculatingTradeOut, setIsCalculatingTradeOut] = React.useState(false);
  const [selectedTradeOutPlayers, setSelectedTradeOutPlayers] = React.useState([]);
  const [selectedTradeInIndex, setSelectedTradeInIndex] = React.useState(null);
  const [salaryCapRemaining, setSalaryCapRemaining] = React.useState(null);

  // Normal mode trade highlights
  const [normalModeHighlighted, setNormalModeHighlighted] = React.useState([]);
  const [normalModePriorities, setNormalModePriorities] = React.useState({});

  // Normal mode trade workflow state
  const [normalModePhase, setNormalModePhase] = React.useState('recommend'); // 'recommend' | 'calculate'
  const [hasCalculatedHighlights, setHasCalculatedHighlights] = React.useState(false);

  // Pre-season mode state
  const [isPreseasonMode, setIsPreseasonMode] = React.useState(false);
  const [preseasonHighlightedPlayers, setPreseasonHighlightedPlayers] = React.useState([]); // Up to 6 recommended trade-outs
  const [preseasonSelectedTradeOuts, setPreseasonSelectedTradeOuts] = React.useState([]); // Players user clicked to trade out
  const [preseasonAvailableTradeIns, setPreseasonAvailableTradeIns] = React.useState([]); // Flat list of trade-in candidates
  const [preseasonSelectedTradeIns, setPreseasonSelectedTradeIns] = React.useState([]); // Players selected to trade in
  const [preseasonSalaryCap, setPreseasonSalaryCap] = React.useState(0); // Dynamic salary cap
  const [preseasonPhase, setPreseasonPhase] = React.useState('idle'); // 'idle' | 'highlighting' | 'selecting-out' | 'selecting-in'
  const [showPreseasonTradeIns, setShowPreseasonTradeIns] = React.useState(false); // Show trade-in panel after confirming trade-outs
  const [preseasonTestApproach, setPreseasonTestApproach] = React.useState(false); // Test approach toggle - price band matching
  const [preseasonPriceBands, setPreseasonPriceBands] = React.useState([]); // Track price bands for test approach

  // Team status analysis state - front-loaded when team is displayed
  const [injuredPlayers, setInjuredPlayers] = React.useState([]);
  const [lowUpsidePlayers, setLowUpsidePlayers] = React.useState([]);
  const [notSelectedPlayers, setNotSelectedPlayers] = React.useState([]);
  const [junkCheapies, setJunkCheapies] = React.useState([]);
  const [isAnalyzingTeam, setIsAnalyzingTeam] = React.useState(true);
  const [teamAnalysisComplete, setTeamAnalysisComplete] = React.useState(false);

  React.useEffect(() => {
    setTeamPlayers(players || []);
    // Reset analysis state when players change
    if (players && players.length > 0) {
      setTeamAnalysisComplete(false);
      setIsAnalyzingTeam(true);
    }
  }, [players]);

  // Front-load team analysis (injured + low-upside) when team players are loaded
  React.useEffect(() => {
    const analyzeTeam = async () => {
      if (!teamPlayers || teamPlayers.length === 0) {
        setInjuredPlayers([]);
        setLowUpsidePlayers([]);
        setNotSelectedPlayers([]);
        setJunkCheapies([]);
        setNormalModeHighlighted([]);
        setNormalModePriorities({});
        setIsAnalyzingTeam(false);
        setTeamAnalysisComplete(true);
        return;
      }

      setIsAnalyzingTeam(true);
      try {
        const { analyzeTeamStatus } = await import('../services/tradeApi.js');
        const result = await analyzeTeamStatus(teamPlayers, 2);
        setInjuredPlayers(result.injured_players || []);
        setLowUpsidePlayers(result.low_upside_players || []);
        setNotSelectedPlayers(result.not_selected_players || []);
        setJunkCheapies(result.junk_cheapies || []);
        console.log('Team analysis complete:', result);
        console.log('Not selected players:', result.not_selected_players || []);
        console.log('Junk cheapies:', result.junk_cheapies || []);
      } catch (err) {
        console.error('Error analyzing team:', err);
        setInjuredPlayers([]);
        setLowUpsidePlayers([]);
        setNotSelectedPlayers([]);
        setJunkCheapies([]);
        setNormalModeHighlighted([]);
        setNormalModePriorities({});
      } finally {
        setIsAnalyzingTeam(false);
        setTeamAnalysisComplete(true);
      }
    };

    analyzeTeam();
  }, [teamPlayers]);

  // Reset preseason state when mode is toggled off
  React.useEffect(() => {
    if (!isPreseasonMode) {
      setPreseasonHighlightedPlayers([]);
      setPreseasonSelectedTradeOuts([]);
      setPreseasonAvailableTradeIns([]);
      setPreseasonSelectedTradeIns([]);
      setPreseasonSalaryCap(0);
      setPreseasonPhase('idle');
      setShowPreseasonTradeIns(false);
      setPreseasonTestApproach(false);
      setPreseasonPriceBands([]);
    } else {
      // Clear normal mode highlights when entering preseason mode
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
    }
  }, [isPreseasonMode]);

  // Reset normal mode phase when players change
  React.useEffect(() => {
    if (!isPreseasonMode) {
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
      setTradeOutRecommendations([]);
      setSelectedTradeOutPlayers([]);
    }
  }, [teamPlayers]);

  // Handle cash in bank input with formatting
  const handleCashChange = (e) => {
    const value = e.target.value;
    // Extract numeric value only
    const numericValue = value.replace(/[^0-9]/g, '');
    const parsedValue = parseInt(numericValue) || 0;
    
    // Update numeric state
    setCashInBank(parsedValue);
    
    // Update display value with formatting
    if (numericValue === '' || parsedValue === 0) {
      setCashInBankDisplay('');
    } else {
      setCashInBankDisplay(`$ ${formatNumberWithCommas(parsedValue)} k`);
    }
  };

  // Open trade options modal (mobile) without auto-calculating
  const handleMakeATrade = () => {
    // Preseason keeps using the modal
    if (isPreseasonMode) {
      setShowTradeModal(true);
      setError(null);
      return;
    }

    // In normal mode, if we're still in the recommend phase, run highlight flow in-place
    if (normalModePhase === 'recommend') {
      handleTradeWorkflow();
      return;
    }

    // Otherwise open modal for calculating trade recommendations
    setShowTradeModal(true);
    setError(null);
  };

  // Handle the trade recommendation workflow
  const handleTradeWorkflow = async () => {
    setIsCalculating(true);
    setError(null);

    try {
      if (!isPreseasonMode && normalModePhase === 'recommend') {
        // Phase 1: Just highlight players, don't calculate trade recommendations
        // Combine all players that have issues: injured + overvalued + not selected + junk cheapies
        const allProblemPlayers = new Set([
          ...injuredPlayers,
          ...lowUpsidePlayers,
          ...notSelectedPlayers,
          ...junkCheapies
        ]);

        // Find the actual player objects from teamPlayers that match these names
        const highlightedPlayers = teamPlayers.filter(player =>
          allProblemPlayers.has(player.name)
        );

        // Get trade-out recommendations for priority ordering
        const { calculateTeamTrades } = await import('../services/tradeApi.js');
        const result = await calculateTeamTrades(
          teamPlayers,
          cashInBank * 1000,
          selectedStrategy,
          selectedTradeType,
          numTrades,
          selectedTradeType === 'positionalSwap' ? selectedPositions : null,
          targetByeRound
        );

        const tradeOutNames = (result.trade_out || []).map(p => p.name);
        const priorities = {};

        // Priority 1-2: Top trade-out recommendations
        tradeOutNames.forEach((name, index) => {
          if (allProblemPlayers.has(name)) {
            priorities[name] = index + 1;
          }
        });

        // Priority 3+: Other players with issues
        let nextPriority = Math.max(3, tradeOutNames.length + 1);
        highlightedPlayers.forEach(player => {
          if (!(player.name in priorities)) {
            priorities[player.name] = nextPriority++;
          }
        });

        setNormalModeHighlighted(highlightedPlayers);
        setNormalModePriorities(priorities);
        setTradeOutRecommendations([]);
        setSelectedTradeOutPlayers([]);
        setHasCalculatedHighlights(true);
        setNormalModePhase('calculate');
        
        // Close modal on mobile after highlighting so the team view is visible
        if (showTradeModal) {
          setShowTradeModal(false);
        }

      } else {
        // Phase 2: Calculate trade-in recommendations based on user's selected trade-outs
        const { calculateTeamTrades } = await import('../services/tradeApi.js');

        const result = await calculateTeamTrades(
          teamPlayers,
          cashInBank * 1000,
          selectedStrategy,
          selectedTradeType,
          selectedTradeOutPlayers.length,
          selectedTradeType === 'positionalSwap' ? selectedPositions : null,
          targetByeRound,
          false, // preseasonMode
          selectedTradeOutPlayers // preselected trade-outs
        );

        // Set trade-in recommendations based on user's selections
        setTradeInRecommendations(result.trade_in);

        // On mobile, close modal and show trade-in recommendations page
        if (showTradeModal) {
          setShowTradeModal(false);
          setShowTradeInPage(true);
        }
      }
    } catch (err) {
      console.error('Error in trade workflow:', err);
      setError(err.message || 'Failed to process trade recommendations');
    } finally {
      setIsCalculating(false);
    }
  };

  const togglePosition = (position) => {
    setSelectedPositions(prev => {
      if (prev.includes(position)) {
        return prev.filter(p => p !== position);
      } else {
        return [...prev, position];
      }
    });
  };

  const handleTradeOut = (player, position) => {
    if (!player) return;

    // Only allow selection of highlighted players in normal mode
    if (!isPreseasonMode && !normalModeHighlighted.some(p => p.name === player.name)) {
      return;
    }

    setSelectedTradeOutPlayers(prev => {
      const exists = prev.some(p => p.name === player.name);
      if (exists) {
        // Allow deselection even if at limit
        return prev.filter(p => p.name !== player.name);
      }
      // Prevent selection if already at limit
      if (prev.length >= numTrades) {
        return prev;
      }
      return [...prev, { ...player, originalPosition: position }];
    });
  };

  const handleTradeIn = (option, index) => {
    setSelectedTradeInIndex(index);
  };

  const handleConfirmTrade = () => {
    const selectedOption = selectedTradeInIndex !== null
      ? tradeInRecommendations[selectedTradeInIndex]
      : null;

    if (!selectedOption) return;

    const tradeInPlayers = (selectedOption.players || []).map(player => ({
      name: player.name,
      positions: player.positions || (player.position ? [player.position] : []),
      price: player.price
    }));

    const expectedTradeCount = tradeInPlayers.length || numTrades;
    const tradeOutList = selectedTradeOutPlayers.length > 0
      ? selectedTradeOutPlayers.slice(0, expectedTradeCount)
      : tradeOutRecommendations.slice(0, expectedTradeCount);

    // Swap trade-outs with trade-ins in-place where possible
    const updatedTeam = [...teamPlayers];
    const minLength = Math.min(tradeOutList.length, tradeInPlayers.length);

    for (let i = 0; i < minLength; i++) {
      const outPlayer = tradeOutList[i];
      const inPlayer = tradeInPlayers[i];
      const idx = updatedTeam.findIndex(p => p.name === outPlayer.name);
      if (idx !== -1) {
        updatedTeam[idx] = inPlayer;
      } else {
        // If not found (defensive), append the new player
        updatedTeam.push(inPlayer);
      }
    }

    // If there are extra trade-ins, append them; if extra trade-outs, remove them
    if (tradeInPlayers.length > minLength) {
      for (let i = minLength; i < tradeInPlayers.length; i++) {
        updatedTeam.push(tradeInPlayers[i]);
      }
    } else if (tradeOutList.length > minLength) {
      const extraOutNames = new Set(tradeOutList.slice(minLength).map(p => p.name));
      for (let i = updatedTeam.length - 1; i >= 0; i--) {
        if (extraOutNames.has(updatedTeam[i].name)) {
          updatedTeam.splice(i, 1);
        }
      }
    }

    setTeamPlayers(updatedTeam);

    const tradeOutValue = tradeOutList.reduce((sum, p) => sum + (p.price || 0), 0);
    const tradeInCost = tradeInPlayers.reduce((sum, p) => sum + (p.price || 0), 0);
    const calculatedRemaining = (cashInBank * 1000) + tradeOutValue - tradeInCost;
    const remainingCap = typeof selectedOption.salaryRemaining === 'number'
      ? selectedOption.salaryRemaining
      : calculatedRemaining;

    setSalaryCapRemaining(remainingCap);
    setSelectedTradeOutPlayers([]);
    setSelectedTradeInIndex(null);
    setShowTradeInPage(false);
    setShowTradeModal(false);

    // Reset normal mode workflow state
    if (!isPreseasonMode) {
      setNormalModePhase('recommend');
      setHasCalculatedHighlights(false);
      setNormalModeHighlighted([]);
      setNormalModePriorities({});
    }
  };

  // ========== PRE-SEASON MODE HANDLERS ==========

  // Handle "Highlight Options" button - calculates and highlights trade-out recommendations
  const handleHighlightOptions = async () => {
    if (!teamPlayers || teamPlayers.length === 0) return;
    
    setIsCalculating(true);
    setError(null);
    
    try {
      const { calculateTeamTrades } = await import('../services/tradeApi.js');
      
      // In preseason mode, use 6 trades
      const preseasonNumTrades = 6;
      
      const result = await calculateTeamTrades(
        teamPlayers,
        cashInBank * 1000,
        selectedStrategy,
        'likeForLike', // Use like-for-like for preseason recommendations
        preseasonNumTrades,
        null,
        targetByeRound,
        true // preseasonMode - only include injured, overvalued (diff < -2), or not selected players
      );
      
      // Set highlighted players (up to 6 trade-out recommendations)
      setPreseasonHighlightedPlayers(result.trade_out || []);
      setPreseasonPhase('selecting-out');
      // Initialize salary cap to cash in bank only - traded-out salaries will be added as players are selected
      setPreseasonSalaryCap(cashInBank * 1000);
      
      // On mobile, close modal and go to team screen with highlights
      if (showTradeModal) {
        setShowTradeModal(false);
      }
    } catch (err) {
      console.error('Error calculating preseason trade-out recommendations:', err);
      setError(err.message || 'Failed to calculate trade-out recommendations');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle clicking on a player in preseason mode (team display)
  const handlePreseasonPlayerClick = (player, position) => {
    if (!player) return;

    // During selecting-out phase - user is selecting which highlighted players to trade out
    if (preseasonPhase === 'selecting-out') {
      // Check if player is highlighted (recommended for trade-out)
      const isHighlighted = preseasonHighlightedPlayers.some(p => p.name === player.name);
      if (!isHighlighted) return; // Only allow clicking highlighted players

      setPreseasonSelectedTradeOuts(prev => {
        const exists = prev.some(p => p.name === player.name);
        if (exists) {
          // Deselect - reduce salary cap
          const newList = prev.filter(p => p.name !== player.name);
          // Note: preseasonSalaryCap stays as cash in bank - total is calculated when needed
          return newList;
        } else {
          // Select - don't change displayed salary cap (it stays as cash in bank)
          return [...prev, { ...player, originalPosition: position }];
        }
      });
    }
    // During selecting-in phase - user might click a traded-in player to reverse
    else if (preseasonPhase === 'selecting-in') {
      const tradedInPlayer = preseasonSelectedTradeIns.find(p => p.name === player.name);
      if (tradedInPlayer) {
        // Reverse the trade-in
        handleReversePreseasonTradeIn(tradedInPlayer);
      }
    }
  };

  // Handle confirming trade-out selections and moving to trade-in phase
  const handleConfirmPreseasonTradeOuts = async () => {
    if (preseasonSelectedTradeOuts.length === 0) return;
    
    setIsCalculating(true);
    setError(null);
    
    try {
      const { calculatePreseasonTradeIns } = await import('../services/tradeApi.js');
      
      // Check if any flexible slots (INT/EMG) are being traded out
      const hasFlexibleSlots = preseasonSelectedTradeOuts.some(p => 
        isFlexibleSlot(p.originalPosition)
      );
      
      // Get positions from selected trade-outs (only non-flexible slots)
      const nonFlexiblePositions = preseasonSelectedTradeOuts
        .filter(p => !isFlexibleSlot(p.originalPosition))
        .map(p => p.originalPosition)
        .filter(Boolean);
      
      // If there are flexible slots, don't filter by position (get all positions)
      // Otherwise, only get players matching the traded-out positions
      const tradeOutPositions = hasFlexibleSlots ? [] : nonFlexiblePositions;
      
      console.log('Trade-out slots:', preseasonSelectedTradeOuts.map(p => p.originalPosition));
      console.log('Has flexible slots:', hasFlexibleSlots);
      console.log('Position filter for API:', tradeOutPositions.length ? tradeOutPositions : 'ALL POSITIONS');
      console.log('Test approach enabled:', preseasonTestApproach);
      
      // Calculate total salary cap = cash in bank + traded-out salaries
      const totalSalaryCap = (cashInBank * 1000) + preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0);

      // If test approach is enabled, set up price bands for filtering
      if (preseasonTestApproach) {
        const bands = preseasonSelectedTradeOuts.map(p => ({
          playerName: p.name,
          originalPosition: p.originalPosition,
          price: p.price,
          minPrice: p.price - 75000,
          maxPrice: p.price + 75000,
          filled: false
        }));
        setPreseasonPriceBands(bands);
        console.log('Price bands created:', bands);
      } else {
        setPreseasonPriceBands([]);
      }

      // Calculate available trade-ins based on selected trade-outs
      const result = await calculatePreseasonTradeIns(
        teamPlayers,
        preseasonSelectedTradeOuts,
        totalSalaryCap,
        selectedStrategy,
        tradeOutPositions,
        targetByeRound,
        preseasonTestApproach // Pass test approach flag
      );
      
      setPreseasonAvailableTradeIns(result.trade_ins || []);
      setPreseasonPhase('selecting-in');
      setShowPreseasonTradeIns(true);
    } catch (err) {
      console.error('Error calculating preseason trade-ins:', err);
      setError(err.message || 'Failed to calculate trade-in options');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle selecting a trade-in player
  const handlePreseasonTradeInSelect = (player) => {
    if (!player) return;

    // Check if player is already selected
    const isAlreadySelected = preseasonSelectedTradeIns.some(p => p.name === player.name);
    if (isAlreadySelected) return;

    // Calculate total available salary = cash in bank + traded-out salaries - already selected trade-in costs
    const totalAvailableSalary = (cashInBank * 1000) +
      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

    // Check if we can afford this player
    if (player.price > totalAvailableSalary) return;
    
    // Get remaining slots that haven't been filled
    const remainingSlots = getRemainingTradeOutSlots();
    const playerPosition = player.position || player.positions?.[0];
    
    let matchingTradeOut = null;
    let matchingBandIndex = -1;

    // TEST APPROACH: Match based on price bands using backend's matching_bands data
    if (preseasonTestApproach && preseasonPriceBands.length > 0) {
      // Use the matching_bands data provided by the backend
      const playerMatchingBands = player.matching_bands || [];
      console.log('Player', player.name, 'matches bands:', playerMatchingBands.map(b => b.index));

      // Find an unfilled band that this player can fill, considering position compatibility
      for (const bandInfo of playerMatchingBands) {
        const bandIndex = bandInfo.index;
        const band = preseasonPriceBands[bandIndex];

        // Skip filled bands
        if (band.filled) continue;

        // Check if the corresponding trade-out slot is still available
        const bandSlot = remainingSlots.find(s => s.name === band.playerName);
        if (!bandSlot) continue;

        // Check position compatibility
        const isFlexible = isFlexibleSlot(bandSlot.originalPosition);
        const positionMatches = bandSlot.originalPosition === playerPosition;

        if (isFlexible || positionMatches) {
          matchingTradeOut = bandSlot;
          matchingBandIndex = bandIndex;
          console.log('Using band', bandIndex, 'for player', band.playerName, '- filled by', player.name);
          break;
        }
      }

      if (!matchingTradeOut) {
        console.log('Test approach: No available matching price band found for:', player.name);
        return;
      }
    } else {
      // NORMAL APPROACH: Match based on position
      // Priority 1: Find a non-flexible slot with matching position
      matchingTradeOut = remainingSlots.find(out => {
        return !isFlexibleSlot(out.originalPosition) && out.originalPosition === playerPosition;
      });
      
      // Priority 2: If no position match, use a flexible slot (INT/EMG)
      if (!matchingTradeOut) {
        matchingTradeOut = remainingSlots.find(out => isFlexibleSlot(out.originalPosition));
      }
    }
    
    if (!matchingTradeOut) {
      console.log('No matching slot found for:', playerPosition);
      return;
    }
    
    // Add to selected trade-ins with position info
    const tradeInWithPosition = {
      ...player,
      swappedPosition: matchingTradeOut.originalPosition, // Keep original slot for display
      swappedForPlayer: matchingTradeOut.name,
      matchedBandIndex: matchingBandIndex // Track which band this came from (test approach)
    };
    
    console.log('Trade-in selected:', player.name, '(', playerPosition, ') for slot:', matchingTradeOut.originalPosition);
    
    setPreseasonSelectedTradeIns(prev => [...prev, tradeInWithPosition]);
    
    // Mark the price band as filled (test approach)
    if (preseasonTestApproach && matchingBandIndex >= 0) {
      setPreseasonPriceBands(prev => {
        const updated = [...prev];
        updated[matchingBandIndex] = { ...updated[matchingBandIndex], filled: true };
        return updated;
      });
    }
    
    // Update team display - swap the player in
    setTeamPlayers(prev => {
      return prev.map(p => {
        if (p.name === matchingTradeOut.name) {
          return {
            ...player,
            positions: [matchingTradeOut.originalPosition], // Keep in same slot
            _preseasonSwap: true,
            _originalPlayer: matchingTradeOut
          };
        }
        return p;
      });
    });
  };

  // Handle reversing a trade-in (clicking on a swapped-in player or swap row)
  const handleReversePreseasonTradeIn = (tradedInPlayer) => {
    // Find the original player that was traded out
    const originalPlayer = preseasonSelectedTradeOuts.find(
      p => p.name === tradedInPlayer.swappedForPlayer
    );

    if (!originalPlayer) return;

    // If test approach, reset the price band to unfilled
    if (preseasonTestApproach && tradedInPlayer.matchedBandIndex >= 0) {
      setPreseasonPriceBands(prev => {
        const updated = [...prev];
        if (updated[tradedInPlayer.matchedBandIndex]) {
          updated[tradedInPlayer.matchedBandIndex] = {
            ...updated[tradedInPlayer.matchedBandIndex],
            filled: false
          };
        }
        return updated;
      });
    }

    // Remove from selected trade-ins
    setPreseasonSelectedTradeIns(prev =>
      prev.filter(p => p.name !== tradedInPlayer.name)
    );

    // Note: remaining salary is calculated dynamically, no need to update preseasonSalaryCap

    // Restore original player in team
    setTeamPlayers(prev => {
      return prev.map(p => {
        if (p.name === tradedInPlayer.name && p._preseasonSwap) {
          return originalPlayer;
        }
        return p;
      });
    });
  };

  // Handle reversing a swap by clicking on the swap row
  const handleReversePreseasonSwap = (tradeOutPlayer) => {
    // Find the corresponding trade-in player
    const tradeInPlayer = preseasonSelectedTradeIns.find(
      p => p.swappedForPlayer === tradeOutPlayer.name
    );

    if (!tradeInPlayer) return; // No swap to reverse

    // Use the existing reverse function
    handleReversePreseasonTradeIn(tradeInPlayer);
  };

  // Check if a slot is flexible (INT/EMG can accept any position)
  const isFlexibleSlot = (slotPosition) => {
    return slotPosition === 'INT' || slotPosition === 'EMG';
  };

  // Get remaining slots that need trade-ins (returns objects with slot info)
  const getRemainingTradeOutSlots = () => {
    const filledSlotNames = preseasonSelectedTradeIns.map(p => p.swappedForPlayer);
    return preseasonSelectedTradeOuts.filter(p => !filledSlotNames.includes(p.name));
  };

  // Filter available trade-ins based on remaining positions and salary
  const getFilteredTradeIns = () => {
    const remainingSlots = getRemainingTradeOutSlots();

    // Get unique positions needed (for non-flexible slots)
    const positionsNeeded = new Set();
    let hasFlexibleSlot = false;

    remainingSlots.forEach(slot => {
      if (isFlexibleSlot(slot.originalPosition)) {
        hasFlexibleSlot = true;
      } else {
        positionsNeeded.add(slot.originalPosition);
      }
    });

    // Calculate total available salary = cash in bank + traded-out salaries - already selected trade-in costs
    const totalAvailableSalary = (cashInBank * 1000) +
      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

    console.log('Remaining slots:', remainingSlots.map(s => s.originalPosition));
    console.log('Positions needed:', Array.from(positionsNeeded), 'Has flexible slot:', hasFlexibleSlot);
    console.log('Total available salary:', totalAvailableSalary);

    // TEST APPROACH: Filter by price bands using backend's matching_bands data
    if (preseasonTestApproach && preseasonPriceBands.length > 0) {
      // Get unfilled bands
      const unfilledBands = preseasonPriceBands.filter(band => !band.filled);
      const unfilledBandIndices = new Set(unfilledBands.map(band => preseasonPriceBands.indexOf(band)));
      console.log('Test approach - Unfilled bands:', unfilledBands.map(b => `${b.playerName}: $${b.minPrice/1000}k-$${b.maxPrice/1000}k`));

      return preseasonAvailableTradeIns.filter(player => {
        const playerPos = player.position || player.positions?.[0];
        const notAlreadySelected = !preseasonSelectedTradeIns.some(p => p.name === player.name);
        const canAfford = player.price <= totalAvailableSalary;

        if (!notAlreadySelected || !canAfford) return false;

        // Use backend's pre-calculated matching_bands data
        const playerMatchingBands = player.matching_bands || [];

        // Check if player can fill any unfilled band with position compatibility
        return playerMatchingBands.some(bandInfo => {
          const bandIndex = bandInfo.index;

          // Only consider unfilled bands
          if (!unfilledBandIndices.has(bandIndex)) return false;

          // Check position compatibility with the band's original slot
          const band = preseasonPriceBands[bandIndex];
          const bandSlot = remainingSlots.find(s => s.name === band.playerName);
          if (!bandSlot) return false;

          const isFlexible = isFlexibleSlot(bandSlot.originalPosition);
          const positionMatches = bandSlot.originalPosition === playerPos;

          return isFlexible || positionMatches;
        });
      });
    }

    // NORMAL APPROACH: Filter by position
    return preseasonAvailableTradeIns.filter(player => {
      const playerPos = player.position || player.positions?.[0];
      // Position matches if:
      // 1. There's a flexible slot (INT/EMG) available, OR
      // 2. The player's position matches one of the needed positions
      const positionMatch = hasFlexibleSlot || positionsNeeded.has(playerPos);
      const canAfford = player.price <= totalAvailableSalary;
      const notAlreadySelected = !preseasonSelectedTradeIns.some(p => p.name === player.name);
      return positionMatch && canAfford && notAlreadySelected;
    });
  };

  // Render Trade Options Modal for Mobile
  const renderTradeOptionsModal = () => {
    if (!showTradeModal) return null;

    return (
      <div className="trade-modal-overlay" onClick={() => setShowTradeModal(false)}>
        <div className="trade-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="trade-modal-header">
            <h3 className="sidebar-title">Trade Options</h3>
            <button className="btn-close-modal" onClick={() => setShowTradeModal(false)}>×</button>
          </div>

          {/* Trade-out selections (only in normal mode) */}
          {!isPreseasonMode && (
          <TradePanel 
            title="Trade Out"
            subtitle="Trade-out Selections"
            players={selectedTradeOutPlayers}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage="Select highlighted players to add them here"
            isTradeOut={true}
          />
          )}

          {/* Preseason mode info */}
          {isPreseasonMode && (
            <div className="preseason-status highlight">
              Trade-out recommendations will be highlighted on your team screen
            </div>
          )}

          {/* Cash in Bank Input */}
          <div className="cash-in-bank-section">
            <label htmlFor="cashInBank">Cash in Bank ($)</label>
            <input
              id="cashInBank"
              type="text"
              value={cashInBankDisplay}
              onChange={handleCashChange}
              placeholder="$ 000 k"
            />
          </div>

          {/* Strategy Selection */}
          <div className="strategy-section">
            <label htmlFor="strategy">Strategy</label>
            <select 
              id="strategy" 
              value={selectedStrategy} 
              onChange={(e) => setSelectedStrategy(e.target.value)}
            >
              <option value="1">Maximize Value (Diff)</option>
              <option value="2">Maximize Base (Projection)</option>
              <option value="3">Hybrid Approach</option>
            </select>
          </div>

          {/* Trade Type Selection */}
          <div className="trade-type-section">
            <label htmlFor="tradeType">Trade Type</label>
            <select 
              id="tradeType" 
              value={selectedTradeType} 
              onChange={(e) => setSelectedTradeType(e.target.value)}
            >
              <option value="likeForLike">Like for Like</option>
              <option value="positionalSwap">Positional Swap</option>
            </select>
          </div>

          {/* Bye round weighting toggle */}
          <div className="toggle-section">
            <div className="toggle-labels">
              <label htmlFor="targetByeRoundMobile">Target Bye Round Players</label>
              <span className="toggle-caption">Prioritise bye coverage</span>
            </div>
            <label className="toggle-switch">
              <input
                id="targetByeRoundMobile"
                type="checkbox"
                checked={targetByeRound}
                onChange={(e) => setTargetByeRound(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Pre-season Mode Toggle (Mobile) */}
          <div className={`preseason-mode-section ${isPreseasonMode ? 'active' : ''}`}>
            <div className="preseason-mode-header toggle-section">
              <div className="toggle-labels">
                <label htmlFor="preseasonModeMobile">Pre-season Mode</label>
                <span className="toggle-caption">Up to 6 trades</span>
              </div>
              <label className="toggle-switch">
                <input
                  id="preseasonModeMobile"
                  type="checkbox"
                  checked={isPreseasonMode}
                  onChange={(e) => setIsPreseasonMode(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            {/* Test Approach Toggle - only visible when preseason mode is on */}
            {isPreseasonMode && (
              <div className="test-approach-section toggle-section">
                <div className="toggle-labels">
                  <label htmlFor="testApproachMobile">Test Approach</label>
                  <span className="toggle-caption">Price band matching (±$75k)</span>
                </div>
                <label className="toggle-switch">
                  <input
                    id="testApproachMobile"
                    type="checkbox"
                    checked={preseasonTestApproach}
                    onChange={(e) => setPreseasonTestApproach(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            )}
          </div>

          {/* Position Selection (only shown for Positional Swap in normal mode) */}
          {!isPreseasonMode && selectedTradeType === 'positionalSwap' && (
            <div className="position-selection-section">
              <label>Select Positions for Swap</label>
              <div className="position-checkboxes">
                {['HOK', 'HLF', 'CTR', 'WFB', 'EDG', 'MID'].map(position => (
                  <label key={position} className="position-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPositions.includes(position)}
                      onChange={() => togglePosition(position)}
                    />
                    <span>{position}</span>
                  </label>
                ))}
              </div>
              <p className="position-hint">
                {selectedPositions.length === 0 
                  ? 'Select positions to filter trade recommendations' 
                  : `${selectedPositions.length} position${selectedPositions.length > 1 ? 's' : ''} selected`}
              </p>
            </div>
          )}

          {/* Number of Trades (hidden in preseason mode) */}
          {!isPreseasonMode && (
          <div className="num-trades-section">
            <label htmlFor="numTrades">Number of Trades</label>
            <input
              id="numTrades"
              type="number"
              value={numTrades}
              onChange={(e) => setNumTrades(parseInt(e.target.value) || 2)}
              min="1"
            max="2"
            />
          </div>
          )}

          {/* Button changes based on mode */}
          {isPreseasonMode ? (
            <button 
              className="btn-highlight-options"
              onClick={() => {
                handleHighlightOptions();
                // Modal will be closed in handleHighlightOptions
              }}
              disabled={isCalculating}
            >
              {isCalculating ? 'Calculating...' : 'Highlight Trade-Out Options'}
            </button>
          ) : (
          <button
            className={`btn-calculate-trades ${normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 2 ? 'disabled' : ''}`}
            onClick={handleTradeWorkflow}
            disabled={isCalculating || (normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 2)}
          >
            {isCalculating ? 'Calculating...' :
             normalModePhase === 'recommend' ? 'Recommend players to trade out' :
             'Calculate trade recommendations'}
          </button>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Trade-In Recommendations Page for Mobile (separate page from Trade Options)
  const renderTradeInPage = () => {
    // Don't show normal trade-in page in preseason mode
    if (!showTradeInPage || isPreseasonMode) return null;

    return (
      <div className="trade-in-page">
        <div className="trade-in-page-header">
          <button 
            className="btn-header-action" 
            onClick={() => setShowTradeInPage(false)}
          >
            ← My Team
          </button>
          <button 
            className="btn-header-action" 
            onClick={() => {
              setShowTradeInPage(false);
              setShowTradeModal(true);
            }}
          >
            ← Trade Options
          </button>
        </div>
        
        {/* Trade-out Recommendations - Pinned at top */}
        <div className="trade-out-pinned">
          <TradePanel 
            title="Trade Out"
            subtitle="Trade-out Selections"
            players={selectedTradeOutPlayers}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage="Select highlighted players to add them here"
            isTradeOut={true}
          />
        </div>
        
        {/* Trade-in Recommendations - Scrollable */}
        <div className="trade-in-page-content">
          <TradePanel 
            title="Trade In"
            subtitle="Trade-in Recommendations"
            players={tradeInRecommendations}
            onSelect={handleTradeIn}
            selectedOptionIndex={selectedTradeInIndex}
            onConfirmOption={handleConfirmTrade}
            showConfirmButton={true}
            emptyMessage="Trade-in recommendations will appear here"
            isTradeIn={true}
          />
        </div>
      </div>
    );
  };

  // Render Pre-season Trade-In Page for Mobile
  // Handle confirming all preseason trades and returning to team view
  const handleConfirmAllPreseasonTrades = () => {
    // All swaps are already applied to teamPlayers state via handlePreseasonTradeInSelect
    // Reset preseason mode state
    setShowPreseasonTradeIns(false);
    setPreseasonPhase('idle');
    setPreseasonHighlightedPlayers([]);
    setPreseasonSelectedTradeOuts([]);
    setPreseasonSelectedTradeIns([]);
    setPreseasonAvailableTradeIns([]);
    setPreseasonSalaryCap(0);
    // Stay in preseason mode so user can make more trades if needed
  };

  const renderPreseasonTradeInPage = () => {
    if (!showPreseasonTradeIns || !isPreseasonMode) return null;

    const allPositionsFilled = preseasonSelectedTradeIns.length === preseasonSelectedTradeOuts.length;

    return (
      <div className="trade-in-page">
        <div className="trade-in-page-header">
          <button 
            className="btn-header-action" 
            onClick={() => {
              setShowPreseasonTradeIns(false);
              setPreseasonPhase('selecting-out');
            }}
          >
            ← Back to Team
          </button>
        </div>
        
        {/* Preseason salary cap and status */}
        <div className="trade-out-pinned">
                  {(() => {
                    // Calculate remaining = cash + traded-out salaries - selected trade-in costs
                    const remaining = (cashInBank * 1000) +
                      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

            return (
              <div className={`preseason-salary-cap ${remaining > 0 ? 'has-budget' : ''}`}>
                Remaining: ${formatNumberWithCommas(Math.round(remaining / 1000))}k
              </div>
            );
          })()}
          <div className="preseason-status">
            {preseasonSelectedTradeIns.length} of {preseasonSelectedTradeOuts.length} trade-ins selected
          </div>
          
          {/* Show trade swap rows - split bubble design */}
          <div className="trade-panel">
            <h4 className="trade-subtitle">Trade Swaps</h4>
            <div className="trade-swap-list">
              {preseasonSelectedTradeOuts.map((tradeOutPlayer, index) => {
                const tradeInPlayer = preseasonSelectedTradeIns.find(
                  p => p.swappedForPlayer === tradeOutPlayer.name
                );
                const hasTradeIn = !!tradeInPlayer;
                
                return (
                  <div
                    key={tradeOutPlayer.name || index}
                    className={`trade-swap-row ${hasTradeIn ? 'completed clickable' : ''}`}
                    onClick={() => hasTradeIn && handleReversePreseasonSwap(tradeOutPlayer)}
                    title={hasTradeIn ? 'Click to reverse this trade swap' : ''}
                  >
                    {/* Left bubble - Trade Out Player */}
                    <div className={`trade-swap-bubble trade-out-bubble ${hasTradeIn ? 'active' : ''}`}>
                      <span className="trade-player-pos">
                        {tradeOutPlayer.originalPosition || tradeOutPlayer.positions?.[0] || '—'}
                      </span>
                      <span className="trade-player-name">{tradeOutPlayer.name}</span>
                      <span className="trade-player-price">
                        ${formatNumberWithCommas(Math.round(tradeOutPlayer.price / 1000))}k
                      </span>
                    </div>
                    
                    {/* Swap arrows in center */}
                    <div className={`trade-swap-arrows ${hasTradeIn ? 'active' : ''}`}>
                      <span className="arrow-up">⇄</span>
                      {hasTradeIn && <span className="reverse-hint">↶</span>}
                    </div>
                    
                    {/* Right bubble - Trade In Player */}
                    <div className={`trade-swap-bubble trade-in-bubble ${hasTradeIn ? 'active' : ''}`}>
                      {hasTradeIn ? (
                        <>
                          <span className="trade-player-pos">
                            {tradeInPlayer.position || tradeInPlayer.positions?.[0] || '—'}
                          </span>
                          <span className="trade-player-name">{tradeInPlayer.name}</span>
                          <span className="trade-player-price">
                            ${formatNumberWithCommas(Math.round(tradeInPlayer.price / 1000))}k
                          </span>
                        </>
                      ) : (
                        <span className="trade-player-name empty">Select trade-in...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Confirm Trades button - appears when all positions filled */}
            {allPositionsFilled && (
              <button 
                className="btn-confirm-trades"
                onClick={handleConfirmAllPreseasonTrades}
              >
                ✓ Confirm Trades
              </button>
            )}
          </div>
        </div>
        
        {/* Trade-in options - Scrollable */}
        <div className="trade-in-page-content">
          <div className="trade-panel">
            <h4 className="trade-subtitle">Trade-In Options</h4>
            <div className="preseason-tradein-list">
              {getFilteredTradeIns().length > 0 ? (
                getFilteredTradeIns().map((player, index) => {
                  // Calculate total available salary for this render = cash + traded-out salaries - selected trade-in costs
                  const totalAvailableSalary = (cashInBank * 1000) +
                    preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                    preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);
                  const isDisabled = player.price > totalAvailableSalary;

                  return (
                    <div
                      key={player.name || index}
                      className={`preseason-tradein-item ${
                        preseasonSelectedTradeIns.some(p => p.name === player.name) ? 'selected' : ''
                      } ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => handlePreseasonTradeInSelect(player)}
                    >
                    <span className="trade-player-pos">
                      {player.position || player.positions?.[0] || '—'}
                    </span>
                    <span className="trade-player-name">{player.name}</span>
                    <span className="trade-player-price">
                      ${formatNumberWithCommas(Math.round(player.price / 1000))}k
                    </span>
                      {player.diff && (
                        <span className="trade-player-diff">+{player.diff.toFixed(1)}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="empty-message">
                  {allPositionsFilled
                    ? 'All positions filled! Click "Confirm Trades" above.'
                    : 'No trade-in options available for remaining positions'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderTradeOptionsModal()}
      {renderTradeInPage()}
      {renderPreseasonTradeInPage()}
      
      <div className={`team-view ${showTradeInPage || showPreseasonTradeIns ? 'hidden-mobile' : ''} ${(!isPreseasonMode && normalModePhase === 'calculate') ? 'mobile-tradeout-visible' : ''}`}>
        <div className="team-view-main">
          <div className="section-header">
            <h2>My Team</h2>
            {/* Show preseason salary cap when in preseason mode */}
            {isPreseasonMode && preseasonPhase !== 'idle' && (
              <div className={`salary-cap-display ${preseasonSalaryCap > 0 ? '' : 'warning'}`} style={preseasonSalaryCap > 0 ? {} : {borderColor: 'rgba(255,100,100,0.4)', color: '#ff6464'}}>
                {preseasonPhase === 'selecting-out' ? 'Cash in Bank' : 'Remaining'}: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
              </div>
            )}
            {/* Show normal salary cap when not in preseason mode */}
            {!isPreseasonMode && salaryCapRemaining !== null && (
              <div className="salary-cap-display">
                Salary Cap: ${formatNumberWithCommas(Math.round(salaryCapRemaining / 1000))}k
              </div>
            )}
            <div className="header-buttons">
              <button className="btn-back" onClick={onBack}>
                ← Back to Scanner
              </button>
              <button className="btn-make-trade mobile-only" onClick={handleMakeATrade}>
                {isPreseasonMode
                  ? 'Trade options'
                  : normalModePhase === 'calculate'
                    ? 'Calc trade recs'
                    : 'Recommend trade-outs'}
              </button>
              {/* Mobile Confirm Trade-Outs button */}
              {isPreseasonMode && preseasonPhase === 'selecting-out' && preseasonSelectedTradeOuts.length > 0 && (
                <button 
                  className="btn-confirm-trade-outs mobile-only"
                  onClick={handleConfirmPreseasonTradeOuts}
                  disabled={isCalculating}
                >
                  {isCalculating ? 'Loading...' : `Confirm ${preseasonSelectedTradeOuts.length} Trade-Out${preseasonSelectedTradeOuts.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>

          {/* Loading screen while analyzing team */}
          {isAnalyzingTeam && !teamAnalysisComplete && (
            <div className="team-loading-overlay">
              <div className="team-loading-content">
                <div className="interchange-loader">
                  <svg viewBox="0 0 60 60" className="interchange-icon">
                    {/* Arrow 1 - curving from top-right to bottom-left */}
                    <path 
                      className="arrow arrow-1" 
                      d="M 45 15 Q 50 30, 35 40 L 38 35 M 35 40 L 40 43"
                      fill="none" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Arrow 2 - curving from bottom-left to top-right */}
                    <path 
                      className="arrow arrow-2" 
                      d="M 15 45 Q 10 30, 25 20 L 22 25 M 25 20 L 20 17"
                      fill="none" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="loading-text">Analyzing team...</p>
              </div>
            </div>
          )}

          {/* Only show team once analysis is complete */}
          {teamAnalysisComplete && (
          <TeamDisplay
            players={teamPlayers}
            onTradeOut={handleTradeOut}
            isPreseasonMode={isPreseasonMode}
            preseasonHighlighted={preseasonHighlightedPlayers}
            preseasonSelectedOut={preseasonSelectedTradeOuts}
            preseasonTradedIn={preseasonSelectedTradeIns}
            onPreseasonClick={handlePreseasonPlayerClick}
            injuredPlayers={injuredPlayers}
            lowUpsidePlayers={lowUpsidePlayers}
            notSelectedPlayers={notSelectedPlayers}
            junkCheapies={junkCheapies}
            normalModeHighlighted={normalModeHighlighted}
            normalModePriorities={normalModePriorities}
          />
          )}

        {/* Mobile-only trade-out selections panel under the team field */}
        {!isPreseasonMode && normalModePhase === 'calculate' && (
          <div className="mobile-tradeout-panel mobile-only">
            <TradePanel
              title="Trade Out"
              subtitle="Trade-out Selections"
              players={selectedTradeOutPlayers}
              onSelect={handleTradeOut}
              selectedPlayers={selectedTradeOutPlayers}
              emptyMessage="Tap highlighted players to add them here"
              isTradeOut={true}
            />
          </div>
        )}
        </div>
        
        <div className="team-view-sidebar desktop-only">
          <h3 className="sidebar-title">Trade Options</h3>
          
          {/* Cash in Bank Input */}
          <div className="cash-in-bank-section">
            <label htmlFor="cashInBank">Cash in Bank ($)</label>
            <input
              id="cashInBank"
              type="text"
              value={cashInBankDisplay}
              onChange={handleCashChange}
              placeholder="$ 000 k"
            />
          </div>

          {/* Strategy Selection */}
          <div className="strategy-section">
            <label htmlFor="strategy">Strategy</label>
            <select 
              id="strategy" 
              value={selectedStrategy} 
              onChange={(e) => setSelectedStrategy(e.target.value)}
            >
              <option value="1">Maximize Value (Diff)</option>
              <option value="2">Maximize Base (Projection)</option>
              <option value="3">Hybrid Approach</option>
            </select>
          </div>

          {/* Trade Type Selection */}
          <div className="trade-type-section">
            <label htmlFor="tradeType">Trade Type</label>
            <select 
              id="tradeType" 
              value={selectedTradeType} 
              onChange={(e) => setSelectedTradeType(e.target.value)}
            >
              <option value="likeForLike">Like for Like</option>
              <option value="positionalSwap">Positional Swap</option>
            </select>
          </div>

          {/* Bye round weighting toggle */}
          <div className="toggle-section">
            <div className="toggle-labels">
              <label htmlFor="targetByeRoundDesktop">Target Bye Round Players</label>
              <span className="toggle-caption">Prioritise bye coverage</span>
            </div>
            <label className="toggle-switch">
              <input
                id="targetByeRoundDesktop"
                type="checkbox"
                checked={targetByeRound}
                onChange={(e) => setTargetByeRound(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Pre-season Mode Toggle */}
          <div className={`preseason-mode-section ${isPreseasonMode ? 'active' : ''}`}>
            <div className="preseason-mode-header toggle-section">
              <div className="toggle-labels">
                <label htmlFor="preseasonModeDesktop">Pre-season Mode</label>
                <span className="toggle-caption">Up to 6 trades</span>
              </div>
              <label className="toggle-switch">
                <input
                  id="preseasonModeDesktop"
                  type="checkbox"
                  checked={isPreseasonMode}
                  onChange={(e) => setIsPreseasonMode(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            {/* Test Approach Toggle - only visible when preseason mode is on */}
            {isPreseasonMode && (
              <div className="test-approach-section toggle-section">
                <div className="toggle-labels">
                  <label htmlFor="testApproachDesktop">Test Approach</label>
                  <span className="toggle-caption">Price band matching (±$75k)</span>
                </div>
                <label className="toggle-switch">
                  <input
                    id="testApproachDesktop"
                    type="checkbox"
                    checked={preseasonTestApproach}
                    onChange={(e) => setPreseasonTestApproach(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            )}
          </div>

          {/* Position Selection (only shown for Positional Swap in normal mode) */}
          {!isPreseasonMode && selectedTradeType === 'positionalSwap' && (
            <div className="position-selection-section">
              <label>Select Positions for Swap</label>
              <div className="position-checkboxes">
                {['HOK', 'HLF', 'CTR', 'WFB', 'EDG', 'MID'].map(position => (
                  <label key={position} className="position-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPositions.includes(position)}
                      onChange={() => togglePosition(position)}
                    />
                    <span>{position}</span>
                  </label>
                ))}
              </div>
              <p className="position-hint">
                {selectedPositions.length === 0 
                  ? 'Select positions to filter trade recommendations' 
                  : `${selectedPositions.length} position${selectedPositions.length > 1 ? 's' : ''} selected`}
              </p>
            </div>
          )}

          {/* Number of Trades (hidden in preseason mode) */}
          {!isPreseasonMode && (
          <div className="num-trades-section">
            <label htmlFor="numTrades">Number of Trades</label>
            <input
              id="numTrades"
              type="number"
              value={numTrades}
              onChange={(e) => setNumTrades(parseInt(e.target.value) || 2)}
              min="1"
            max="2"
            />
          </div>
          )}

          {/* Button changes based on mode */}
          {isPreseasonMode ? (
            <>
              {/* Preseason Mode Buttons */}
              {preseasonPhase === 'idle' && (
                <button 
                  className="btn-highlight-options"
                  onClick={handleHighlightOptions}
                  disabled={isCalculating}
                >
                  {isCalculating ? 'Calculating...' : 'Highlight Trade-Out Options'}
                </button>
              )}
              
              {preseasonPhase === 'selecting-out' && (
                <>
                  <div className="preseason-salary-cap">
                    Cash in Bank: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
                  </div>
                  <div className="preseason-status selecting">
                    {preseasonSelectedTradeOuts.length} player{preseasonSelectedTradeOuts.length !== 1 ? 's' : ''} selected for trade-out
                  </div>
                  <button 
                    className="btn-confirm-trade-outs"
                    onClick={handleConfirmPreseasonTradeOuts}
                    disabled={isCalculating || preseasonSelectedTradeOuts.length === 0}
                  >
                    {isCalculating ? 'Loading Trade-Ins...' : 'Confirm Trade-Outs'}
                  </button>
                </>
              )}
              
              {preseasonPhase === 'selecting-in' && (
                <>
                  {(() => {
                    // Calculate remaining = cash + traded-out salaries - selected trade-in costs
                    const remaining = (cashInBank * 1000) +
                      preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                      preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);

                    return (
                      <>
                        <div className={`preseason-salary-cap ${remaining > 0 ? 'has-budget' : ''}`}>
                          Remaining: ${formatNumberWithCommas(Math.round(remaining / 1000))}k
                        </div>
                        <div className="preseason-status">
                          {preseasonSelectedTradeIns.length} of {preseasonSelectedTradeOuts.length} trade-ins selected
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </>
          ) : (
            /* Normal Mode - Calculate Button */
          <button
            className={`btn-calculate-trades ${normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 2 ? 'disabled' : ''}`}
            onClick={handleTradeWorkflow}
            disabled={isCalculating || (normalModePhase === 'calculate' && selectedTradeOutPlayers.length < 2)}
          >
            {isCalculating ? 'Calculating...' :
             normalModePhase === 'recommend' ? 'Recommend players to trade out' :
             'Calculate trade recommendations'}
          </button>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {/* Trade Panels - Normal mode only */}
          {!isPreseasonMode && (
            <>
          <TradePanel
            title="Trade Out"
            subtitle="Trade-out Selections"
            players={selectedTradeOutPlayers}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage="Click on highlighted players to select them for trade-out"
            isTradeOut={true}
          />
          
          <TradePanel 
            title="Trade In"
            subtitle="Trade-in Recommendations"
            players={tradeInRecommendations}
            onSelect={handleTradeIn}
            selectedOptionIndex={selectedTradeInIndex}
            onConfirmOption={handleConfirmTrade}
            showConfirmButton={true}
            emptyMessage="Trade-out players will generate trade-in options"
            isTradeIn={true}
          />
            </>
          )}
          
          {/* Pre-season Trade-In List */}
          {isPreseasonMode && preseasonPhase === 'selecting-in' && (
            <div className="trade-panel">
              <h4 className="trade-subtitle">Trade-In Options</h4>
              <div className="preseason-tradein-list">
              {getFilteredTradeIns().length > 0 ? (
                getFilteredTradeIns().map((player, index) => {
                  // Calculate total available salary for this render = cash + traded-out salaries - selected trade-in costs
                  const totalAvailableSalary = (cashInBank * 1000) +
                    preseasonSelectedTradeOuts.reduce((sum, p) => sum + (p.price || 0), 0) -
                    preseasonSelectedTradeIns.reduce((sum, p) => sum + (p.price || 0), 0);
                  const isDisabled = player.price > totalAvailableSalary;

                  return (
                    <div
                      key={player.name || index}
                      className={`preseason-tradein-item ${
                        preseasonSelectedTradeIns.some(p => p.name === player.name) ? 'selected' : ''
                      } ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => handlePreseasonTradeInSelect(player)}
                    >
                      <span className="trade-player-pos">
                        {player.position || player.positions?.[0] || '—'}
                      </span>
                      <span className="trade-player-name">{player.name}</span>
                      <span className="trade-player-price">
                        ${formatNumberWithCommas(Math.round(player.price / 1000))}k
                      </span>
                        {player.diff && (
                          <span className="trade-player-diff">+{player.diff.toFixed(1)}</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-message">
                    {preseasonSelectedTradeIns.length === preseasonSelectedTradeOuts.length
                      ? 'All positions filled!'
                      : 'No trade-in options available for remaining positions'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default TeamView;

