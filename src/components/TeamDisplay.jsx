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

function TeamDisplay({ players, onTradeOut, selectedTradeOut }) {
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
    const primaryPos = player.displaySlot || player.positions?.[0];
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

    const isSelected = selectedTradeOut?.name === player.name;
    const moved = player?.loopMoved;

    return (
      <div 
        key={player.name} 
        className={`player-card ${isSelected ? 'selected' : ''} ${moved ? 'moved' : ''}`}
        onClick={() => onTradeOut?.(player)}
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
  const [loopAnalysis, setLoopAnalysis] = React.useState(null);
  const [loopViewPlayers, setLoopViewPlayers] = React.useState(players || []);
  const [loopError, setLoopError] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [showTradeModal, setShowTradeModal] = React.useState(false);
  const [showTradeInPage, setShowTradeInPage] = React.useState(false); // Trade-in recommendations page
  const [isCalculatingTradeOut, setIsCalculatingTradeOut] = React.useState(false);
  const [selectedTradeOutPlayers, setSelectedTradeOutPlayers] = React.useState([]);
  const [selectedTradeInIndex, setSelectedTradeInIndex] = React.useState(null);
  const [salaryCapRemaining, setSalaryCapRemaining] = React.useState(null);

  React.useEffect(() => {
    setTeamPlayers(players || []);
    setLoopViewPlayers(players || []);
    setLoopAnalysis(null);
  }, [players]);

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

  // Analyse loop opportunities without performing trades
  const handleAnalyseLoop = async () => {
    setLoopError(null);
    try {
      const { analyseLoopOptions } = await import('../services/tradeApi.js');
      const result = await analyseLoopOptions(teamPlayers);
      setLoopAnalysis(result);

      if (result?.loop_available && Array.isArray(result.loops) && result.loops.length > 0) {
        const suggestion = result.loops[0];
        const anchorName = suggestion.anchor_player;
        const candidateName = suggestion.candidate_player;

        const updatedView = teamPlayers.map(player => {
          let displaySlot = undefined;
          let loopMoved = false;

          if (player.name === candidateName) {
            displaySlot = 'INT';
            loopMoved = true;
          } else if (player.name === anchorName) {
            loopMoved = true;
          }

          return {
            ...player,
            displaySlot,
            loopMoved
          };
        });

        setLoopViewPlayers(updatedView);
      } else {
        setLoopViewPlayers(teamPlayers);
      }
    } catch (err) {
      console.error('Error analysing loop options:', err);
      setLoopError(err.message || 'Failed to analyse loop options');
      setLoopAnalysis(null);
      setLoopViewPlayers(teamPlayers);
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

          {/* Trade-out Recommendations (First) */}
          <TradePanel 
            title="Trade Out"
            subtitle="Trade-out Recommendations"
            players={tradeOutRecommendations}
            onSelect={handleTradeOut}
            selectedPlayers={selectedTradeOutPlayers}
            emptyMessage={isCalculatingTradeOut ? "Calculating trade-out recommendations..." : "Trade-out recommendations will appear here"}
            isTradeOut={true}
          />

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

          {/* Bye round weighting toggle */}
          <div className="toggle-section">
            <div className="toggle-labels">
              <label htmlFor="targetByeRound">Target Bye Round Players</label>
              <span className="toggle-caption">Prioritise bye coverage</span>
            </div>
            <label className="toggle-switch">
              <input
                id="targetByeRound"
                type="checkbox"
                checked={targetByeRound}
                onChange={(e) => setTargetByeRound(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Position Selection (only shown for Positional Swap) */}
          {selectedTradeType === 'positionalSwap' && (
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

          {/* Number of Trades */}
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

          {/* Calculate Button */}
          <button 
            className="btn-calculate-trades"
            onClick={handleCalculateTrades}
            disabled={isCalculating}
          >
            {isCalculating ? 'Calculating...' : 'Calculate Trade Recommendations'}
          </button>

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
    if (!showTradeInPage) return null;

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

  return (
    <>
      {renderTradeOptionsModal()}
      {renderTradeInPage()}
      
      <div className={`team-view ${showTradeInPage ? 'hidden-mobile' : ''}`}>
        <div className="team-view-main">
          <div className="section-header">
            <h2>My Team</h2>
            {salaryCapRemaining !== null && (
              <div className="salary-cap-display">
                Salary Cap: ${formatNumberWithCommas(Math.round(salaryCapRemaining / 1000))}k
              </div>
            )}
            <div className="header-buttons">
              <div className="header-actions">
                <button className="btn-back" onClick={onBack}>
                  ← Back to Scanner
                </button>
                <button
                  className="btn-loop desktop-only"
                  onClick={() => handleAnalyseLoop()}
                >
                  Analyse Loop Options
                </button>
              </div>
              <button className="btn-make-trade mobile-only" onClick={handleMakeATrade}>
                Make a Trade
              </button>
              <button
                className="btn-loop mobile-only"
                onClick={() => handleAnalyseLoop()}
              >
                Analyse Loop Options
              </button>
            </div>
          </div>

          {(loopAnalysis || loopError) && (
            <div className="loop-advisory">
              {loopError && (
                <p className="loop-error">{loopError}</p>
              )}
              {loopAnalysis && (
                loopAnalysis.loop_available && loopAnalysis.loops?.length > 0 ? (
                  <>
                    <p className="loop-title">Loop found: {loopAnalysis.loops[0].anchor_player} with {loopAnalysis.loops[0].candidate_player}</p>
                    <ul className="loop-actions">
                      {loopAnalysis.loops[0].recommended_actions?.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="loop-none">No loop opportunities detected.</p>
                )
              )}
            </div>
          )}

          <TeamDisplay 
            players={loopViewPlayers} 
            onTradeOut={handleTradeOut}
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

          {/* Position Selection (only shown for Positional Swap) */}
          {selectedTradeType === 'positionalSwap' && (
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

          {/* Number of Trades */}
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

          {/* Calculate Button */}
          <button 
            className="btn-calculate-trades"
            onClick={handleCalculateTrades}
            disabled={isCalculating}
          >
            {isCalculating ? 'Calculating...' : 'Calculate Trade Recommendations'}
          </button>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
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
        </div>
      </div>
    </>
  );
}

export default TeamView;

