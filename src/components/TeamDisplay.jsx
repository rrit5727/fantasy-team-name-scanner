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

    return (
      <div 
        key={player.name} 
        className={`player-card ${isSelected ? 'selected' : ''}`}
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

function TradePanel({ title, subtitle, players, onSelect, selectedPlayer, emptyMessage, isTradeOut, isTradeIn }) {
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
                className={`trade-player-item ${selectedPlayer?.name === player.name ? 'selected' : ''}`}
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
                className="trade-option"
                onClick={() => onSelect?.(option)}
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
  const [cashInBank, setCashInBank] = React.useState(0);
  const [cashInBankDisplay, setCashInBankDisplay] = React.useState('');
  const [tradeOutRecommendations, setTradeOutRecommendations] = React.useState([]);
  const [tradeInRecommendations, setTradeInRecommendations] = React.useState([]);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [selectedStrategy, setSelectedStrategy] = React.useState('1'); // Default to Maximize Value
  const [selectedTradeType, setSelectedTradeType] = React.useState('likeForLike'); // Default to Like for Like
  const [numTrades, setNumTrades] = React.useState(2);
  const [selectedPositions, setSelectedPositions] = React.useState([]); // For positional swap
  const [error, setError] = React.useState(null);
  const [showTradeModal, setShowTradeModal] = React.useState(false);
  const [showTradeInPage, setShowTradeInPage] = React.useState(false); // Trade-in recommendations page
  const [isCalculatingTradeOut, setIsCalculatingTradeOut] = React.useState(false);

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
    if (players && players.length > 0) {
      setIsCalculatingTradeOut(true);
      setError(null);
      
      try {
        const { calculateTeamTrades } = await import('../services/tradeApi.js');
        
        const result = await calculateTeamTrades(
          players,
          0, // No cash needed for trade-out calculation
          selectedStrategy,
          selectedTradeType,
          numTrades,
          selectedTradeType === 'positionalSwap' ? selectedPositions : null
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
        players,
        cashInBank * 1000, // Convert from thousands to actual amount
        selectedStrategy,
        selectedTradeType,
        numTrades,
        selectedTradeType === 'positionalSwap' ? selectedPositions : null
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
    console.log('Trade out selected:', player);
  };

  const handleTradeIn = (option) => {
    console.log('Trade in selected:', option);
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
            <div className="header-buttons">
              <button className="btn-back" onClick={onBack}>
                ← Back to Scanner
              </button>
              <button className="btn-make-trade mobile-only" onClick={handleMakeATrade}>
                Make a Trade
              </button>
            </div>
          </div>
          <TeamDisplay 
            players={players} 
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
            emptyMessage={isCalculatingTradeOut ? "Calculating trade-out recommendations..." : "Trade-out recommendations will appear here"}
            isTradeOut={true}
          />
          
          <TradePanel 
            title="Trade In"
            subtitle="Trade-in Recommendations"
            players={tradeInRecommendations}
            onSelect={handleTradeIn}
            emptyMessage="Trade-out players will generate trade-in options"
            isTradeIn={true}
          />
        </div>
      </div>
    </>
  );
}

export default TeamView;

