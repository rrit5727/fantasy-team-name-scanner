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
  onPreseasonClick
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

    // Determine CSS classes based on preseason mode state
    let cardClasses = 'player-card';
    
    if (isPreseasonMode) {
      // Check if this player was traded in (replaces a traded out player)
      if (isPlayerInList(player, preseasonTradedIn)) {
        cardClasses += ' preseason-traded-in';
      }
      // Check if player is selected for trade out
      else if (isPlayerInList(player, preseasonSelectedOut)) {
        cardClasses += ' preseason-selected-out';
      }
      // Check if player is highlighted as a trade-out recommendation
      else if (isPlayerInList(player, preseasonHighlighted)) {
        cardClasses += ' preseason-highlight';
      }
    } else {
      // Normal mode - use existing selected state
      const isSelected = selectedTradeOut?.name === player.name;
      if (isSelected) {
        cardClasses += ' selected';
      }
    }

    const handleClick = () => {
      if (isPreseasonMode && onPreseasonClick) {
        onPreseasonClick(player, position);
      } else if (onTradeOut) {
        onTradeOut(player);
      }
    };

    return (
      <div 
        key={player.name} 
        className={cardClasses}
        onClick={handleClick}
      >
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

  // Pre-season mode state
  const [isPreseasonMode, setIsPreseasonMode] = React.useState(false);
  const [preseasonHighlightedPlayers, setPreseasonHighlightedPlayers] = React.useState([]); // Up to 6 recommended trade-outs
  const [preseasonSelectedTradeOuts, setPreseasonSelectedTradeOuts] = React.useState([]); // Players user clicked to trade out
  const [preseasonAvailableTradeIns, setPreseasonAvailableTradeIns] = React.useState([]); // Flat list of trade-in candidates
  const [preseasonSelectedTradeIns, setPreseasonSelectedTradeIns] = React.useState([]); // Players selected to trade in
  const [preseasonSalaryCap, setPreseasonSalaryCap] = React.useState(0); // Dynamic salary cap
  const [preseasonPhase, setPreseasonPhase] = React.useState('idle'); // 'idle' | 'highlighting' | 'selecting-out' | 'selecting-in'
  const [showPreseasonTradeIns, setShowPreseasonTradeIns] = React.useState(false); // Show trade-in panel after confirming trade-outs

  React.useEffect(() => {
    setTeamPlayers(players || []);
  }, [players]);

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
    }
  }, [isPreseasonMode]);

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

  // Open modal and calculate trade-out when "Make a Trade" is clicked (mobile only)
  const handleMakeATrade = async () => {
    setShowTradeModal(true);
    
    // Calculate trade-out recommendations for mobile
    if (teamPlayers && teamPlayers.length > 0) {
      setIsCalculatingTradeOut(true);
      setError(null);
      
      try {
        const { calculateTeamTrades } = await import('../services/tradeApi.js');
        
        const result = await calculateTeamTrades(
          teamPlayers,
          0, // No cash needed for trade-out calculation
          selectedStrategy,
          selectedTradeType,
          numTrades,
          selectedTradeType === 'positionalSwap' ? selectedPositions : null,
          targetByeRound
        );
        
        setTradeOutRecommendations(result.trade_out);
      } catch (err) {
        console.error('Error calculating trade-out recommendations:', err);
        setError(err.message || 'Failed to calculate trade-out recommendations');
      } finally {
        setIsCalculatingTradeOut(false);
      }
    }
  };

  // Calculate trade recommendations when "Calculate Trade Recommendations" is clicked
  const handleCalculateTrades = async () => {
    setIsCalculating(true);
    setError(null);
    
    try {
      const { calculateTeamTrades } = await import('../services/tradeApi.js');
      
      const result = await calculateTeamTrades(
        teamPlayers,
        cashInBank * 1000, // Convert from thousands to actual amount
        selectedStrategy,
        selectedTradeType,
        numTrades,
        selectedTradeType === 'positionalSwap' ? selectedPositions : null,
        targetByeRound
      );
      
      // Set both trade-out and trade-in recommendations
      setTradeOutRecommendations(result.trade_out);
      setTradeInRecommendations(result.trade_in);
      
      // On mobile, close modal and show trade-in recommendations page
      // On desktop, just stay on the same page (no action needed, state is updated)
      if (showTradeModal) {
        setShowTradeModal(false);
        setShowTradeInPage(true);
      }
    } catch (err) {
      console.error('Error calculating trades:', err);
      setError(err.message || 'Failed to calculate trades');
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

  const handleTradeOut = (player) => {
    if (!player) return;
    setSelectedTradeOutPlayers(prev => {
      const exists = prev.some(p => p.name === player.name);
      if (exists) {
        return prev.filter(p => p.name !== player.name);
      }
      const updated = [...prev, player];
      if (updated.length > numTrades) {
        // Keep most recent selections up to the number of trades requested
        return updated.slice(updated.length - numTrades);
      }
      return updated;
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
        targetByeRound
      );
      
      // Set highlighted players (up to 6 trade-out recommendations)
      setPreseasonHighlightedPlayers(result.trade_out || []);
      setPreseasonPhase('selecting-out');
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
          setPreseasonSalaryCap(current => current - (player.price || 0));
          return newList;
        } else {
          // Select - increase salary cap
          setPreseasonSalaryCap(current => current + (player.price || 0));
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
      
      // Get positions from selected trade-outs
      const tradeOutPositions = preseasonSelectedTradeOuts.map(p => 
        p.originalPosition || p.positions?.[0]
      ).filter(Boolean);
      
      // Calculate available trade-ins based on selected trade-outs
      const result = await calculatePreseasonTradeIns(
        teamPlayers,
        preseasonSelectedTradeOuts,
        preseasonSalaryCap,
        selectedStrategy,
        tradeOutPositions,
        targetByeRound
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
    
    // Check if we can afford this player
    if (player.price > preseasonSalaryCap) return;
    
    // Find a matching trade-out position for this player
    const playerPosition = player.position || player.positions?.[0];
    const matchingTradeOut = preseasonSelectedTradeOuts.find(out => {
      const outPos = out.originalPosition || out.positions?.[0];
      // Check if this position still needs to be filled
      const alreadyFilledForPosition = preseasonSelectedTradeIns.some(inPlayer => {
        const inPos = inPlayer.swappedPosition;
        return inPos === outPos;
      });
      return outPos === playerPosition && !alreadyFilledForPosition;
    });
    
    if (!matchingTradeOut) return; // No matching position available
    
    // Add to selected trade-ins with position info
    const tradeInWithPosition = {
      ...player,
      swappedPosition: matchingTradeOut.originalPosition || matchingTradeOut.positions?.[0],
      swappedForPlayer: matchingTradeOut.name
    };
    
    setPreseasonSelectedTradeIns(prev => [...prev, tradeInWithPosition]);
    setPreseasonSalaryCap(current => current - player.price);
    
    // Update team display - swap the player in
    setTeamPlayers(prev => {
      return prev.map(p => {
        if (p.name === matchingTradeOut.name) {
          return {
            ...player,
            positions: [tradeInWithPosition.swappedPosition],
            _preseasonSwap: true,
            _originalPlayer: matchingTradeOut
          };
        }
        return p;
      });
    });
  };

  // Handle reversing a trade-in (clicking on a swapped-in player)
  const handleReversePreseasonTradeIn = (tradedInPlayer) => {
    // Find the original player that was traded out
    const originalPlayer = preseasonSelectedTradeOuts.find(
      p => p.name === tradedInPlayer.swappedForPlayer
    );
    
    if (!originalPlayer) return;
    
    // Remove from selected trade-ins
    setPreseasonSelectedTradeIns(prev => 
      prev.filter(p => p.name !== tradedInPlayer.name)
    );
    
    // Restore salary cap
    setPreseasonSalaryCap(current => current + tradedInPlayer.price);
    
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

  // Get remaining positions that need trade-ins
  const getRemainingPositionsForTradeIn = () => {
    const filledPositions = preseasonSelectedTradeIns.map(p => p.swappedPosition);
    return preseasonSelectedTradeOuts
      .map(p => p.originalPosition || p.positions?.[0])
      .filter(pos => !filledPositions.includes(pos));
  };

  // Filter available trade-ins based on remaining positions and salary
  const getFilteredTradeIns = () => {
    const remainingPositions = getRemainingPositionsForTradeIn();
    return preseasonAvailableTradeIns.filter(player => {
      const playerPos = player.position || player.positions?.[0];
      const positionMatch = remainingPositions.includes(playerPos);
      const canAfford = player.price <= preseasonSalaryCap;
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

          {/* Trade-out Recommendations (only in normal mode) */}
          {!isPreseasonMode && (
            <TradePanel 
              title="Trade Out"
              subtitle="Trade-out Recommendations"
              players={tradeOutRecommendations}
              onSelect={handleTradeOut}
              selectedPlayers={selectedTradeOutPlayers}
              emptyMessage={isCalculatingTradeOut ? "Calculating trade-out recommendations..." : "Trade-out recommendations will appear here"}
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
              className="btn-calculate-trades"
              onClick={handleCalculateTrades}
              disabled={isCalculating}
            >
              {isCalculating ? 'Calculating...' : 'Calculate Trade Recommendations'}
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
            subtitle="Trade-out Recommendations"
            players={tradeOutRecommendations}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage="Trade-out recommendations will appear here"
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
  const renderPreseasonTradeInPage = () => {
    if (!showPreseasonTradeIns || !isPreseasonMode) return null;

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
          <div className={`preseason-salary-cap ${preseasonSalaryCap > 0 ? 'has-budget' : ''}`}>
            Remaining: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
          </div>
          <div className="preseason-status">
            {preseasonSelectedTradeIns.length} of {preseasonSelectedTradeOuts.length} trade-ins selected
          </div>
          
          {/* Show selected trade-outs */}
          <div className="trade-panel">
            <h4 className="trade-subtitle">Trading Out</h4>
            <div className="trade-player-list">
              {preseasonSelectedTradeOuts.map((player, index) => {
                const hasTradeIn = preseasonSelectedTradeIns.some(
                  p => p.swappedForPlayer === player.name
                );
                return (
                  <div 
                    key={player.name || index}
                    className={`trade-player-item ${hasTradeIn ? 'selected' : ''}`}
                  >
                    <span className="trade-player-pos">
                      {player.originalPosition || player.positions?.[0] || '—'}
                    </span>
                    <span className="trade-player-name">{player.name}</span>
                    <span className="trade-player-price">
                      ${formatNumberWithCommas(Math.round(player.price / 1000))}k
                    </span>
                    {hasTradeIn && <span style={{color: '#00c864', marginLeft: '0.5rem'}}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Trade-in options - Scrollable */}
        <div className="trade-in-page-content">
          <div className="trade-panel">
            <h4 className="trade-subtitle">Trade-In Options</h4>
            <div className="preseason-tradein-list">
              {getFilteredTradeIns().length > 0 ? (
                getFilteredTradeIns().map((player, index) => (
                  <div 
                    key={player.name || index}
                    className={`preseason-tradein-item ${
                      preseasonSelectedTradeIns.some(p => p.name === player.name) ? 'selected' : ''
                    } ${player.price > preseasonSalaryCap ? 'disabled' : ''}`}
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
                ))
              ) : (
                <p className="empty-message">
                  {preseasonSelectedTradeIns.length === preseasonSelectedTradeOuts.length
                    ? 'All positions filled! Return to team to see your new squad.'
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
      
      <div className={`team-view ${showTradeInPage || showPreseasonTradeIns ? 'hidden-mobile' : ''}`}>
        <div className="team-view-main">
          <div className="section-header">
            <h2>My Team</h2>
            {/* Show preseason salary cap when in preseason mode */}
            {isPreseasonMode && preseasonPhase !== 'idle' && (
              <div className={`salary-cap-display ${preseasonSalaryCap > 0 ? '' : 'warning'}`} style={preseasonSalaryCap > 0 ? {} : {borderColor: 'rgba(255,100,100,0.4)', color: '#ff6464'}}>
                {preseasonPhase === 'selecting-out' ? 'Available' : 'Remaining'}: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
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
                Make a Trade
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

          <TeamDisplay 
            players={teamPlayers} 
            onTradeOut={handleTradeOut}
            isPreseasonMode={isPreseasonMode}
            preseasonHighlighted={preseasonHighlightedPlayers}
            preseasonSelectedOut={preseasonSelectedTradeOuts}
            preseasonTradedIn={preseasonSelectedTradeIns}
            onPreseasonClick={handlePreseasonPlayerClick}
          />
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
                    Available: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
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
                  <div className={`preseason-salary-cap ${preseasonSalaryCap > 0 ? 'has-budget' : ''}`}>
                    Remaining: ${formatNumberWithCommas(Math.round(preseasonSalaryCap / 1000))}k
                  </div>
                  <div className="preseason-status">
                    {preseasonSelectedTradeIns.length} of {preseasonSelectedTradeOuts.length} trade-ins selected
                  </div>
                </>
              )}
            </>
          ) : (
            /* Normal Mode - Calculate Button */
            <button 
              className="btn-calculate-trades"
              onClick={handleCalculateTrades}
              disabled={isCalculating}
            >
              {isCalculating ? 'Calculating...' : 'Calculate Trade Recommendations'}
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
                subtitle="Trade-out Recommendations"
                players={tradeOutRecommendations}
                onSelect={handleTradeOut}
                selectedPlayers={selectedTradeOutPlayers}
                emptyMessage={isCalculatingTradeOut ? "Calculating trade-out recommendations..." : "Trade-out recommendations will appear here"}
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
                  getFilteredTradeIns().map((player, index) => (
                    <div 
                      key={player.name || index}
                      className={`preseason-tradein-item ${
                        preseasonSelectedTradeIns.some(p => p.name === player.name) ? 'selected' : ''
                      } ${player.price > preseasonSalaryCap ? 'disabled' : ''}`}
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
                  ))
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

