import React from 'react';
import './TeamDisplay.css';

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
          <span className="player-price">${Math.round(player.price / 1000)}k</span>
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
                  <span className="trade-player-price">${Math.round(player.price / 1000)}k</span>
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
                    <span className="trade-player-price">${Math.round(player.price / 1000)}k</span>
                  </div>
                ))}
                <div className="trade-option-footer">
                  <span>Total: ${Math.round(option.totalPrice / 1000)}k</span>
                  <span>Remaining: ${Math.round(option.salaryRemaining / 1000)}k</span>
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
  const [tradeOutRecommendations, setTradeOutRecommendations] = React.useState([]);
  const [tradeInRecommendations, setTradeInRecommendations] = React.useState([]);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [selectedStrategy, setSelectedStrategy] = React.useState('3'); // Default to hybrid
  const [selectedTradeType, setSelectedTradeType] = React.useState('positionalSwap');
  const [numTrades, setNumTrades] = React.useState(2);
  const [error, setError] = React.useState(null);

  const handleCalculateTrades = async () => {
    setIsCalculating(true);
    setError(null);
    
    try {
      // Import the API function (we'll create this next)
      const { calculateTeamTrades } = await import('../services/tradeApi.js');
      
      const result = await calculateTeamTrades(
        players,
        cashInBank,
        selectedStrategy,
        selectedTradeType,
        numTrades
      );
      
      setTradeOutRecommendations(result.trade_out);
      setTradeInRecommendations(result.trade_in);
    } catch (err) {
      console.error('Error calculating trades:', err);
      setError(err.message || 'Failed to calculate trades');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleTradeOut = (player) => {
    console.log('Trade out selected:', player);
  };

  const handleTradeIn = (option) => {
    console.log('Trade in selected:', option);
  };

  return (
    <div className="team-view">
      <div className="team-view-main">
        <div className="section-header">
          <h2>My Team</h2>
          <button className="btn-back" onClick={onBack}>
            ← Back to Scanner
          </button>
        </div>
        <TeamDisplay 
          players={players} 
          onTradeOut={handleTradeOut}
        />
      </div>
      
      <div className="team-view-sidebar">
        <h3 className="sidebar-title">Trade Options</h3>
        
        {/* Cash in Bank Input */}
        <div className="cash-in-bank-section">
          <label htmlFor="cashInBank">Cash in Bank ($)</label>
          <input
            id="cashInBank"
            type="number"
            value={cashInBank}
            onChange={(e) => setCashInBank(parseInt(e.target.value) || 0)}
            placeholder="0"
            min="0"
            step="1000"
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
            <option value="positionalSwap">Positional Swap</option>
            <option value="likeForLike">Like for Like</option>
          </select>
        </div>

        {/* Number of Trades */}
        <div className="num-trades-section">
          <label htmlFor="numTrades">Number of Trades</label>
          <input
            id="numTrades"
            type="number"
            value={numTrades}
            onChange={(e) => setNumTrades(parseInt(e.target.value) || 2)}
            min="1"
            max="3"
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
          emptyMessage="Click 'Calculate Trade Recommendations' to see suggestions"
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
  );
}

export default TeamView;

