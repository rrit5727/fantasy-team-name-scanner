/**
 * API service for trade recommendations
 */

// API base URL - adjust this based on your Flask server configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5002';

/**
 * Calculate trade recommendations based on the user's team
 * @param {Array} teamPlayers - Array of player objects with name, positions, price
 * @param {number} cashInBank - Cash available in bank
 * @param {string} strategy - '1' = value, '2' = base, '3' = hybrid
 * @param {string} tradeType - 'likeForLike' or 'positionalSwap'
 * @param {number} numTrades - Number of trades to make
 * @param {Array} allowedPositions - Array of position strings for positional swap (e.g., ['HOK', 'MID'])
 * @returns {Promise<Object>} Trade recommendations with trade_out and trade_in arrays
 */
export async function calculateTeamTrades(
  teamPlayers,
  cashInBank = 0,
  strategy = '1',
  tradeType = 'likeForLike',
  numTrades = 2,
  allowedPositions = null,
  targetByeRound = false
) {
  try {
    // Validate inputs
    if (!teamPlayers || teamPlayers.length === 0) {
      throw new Error('No team players provided');
    }

    // Filter out players without prices for now (though backend can handle it)
    const playersWithPrices = teamPlayers.filter(p => p.price && p.price > 0);
    
    if (playersWithPrices.length === 0) {
      throw new Error('No players with valid prices found. Please ensure prices are extracted from screenshots.');
    }

    // Prepare request payload
    const payload = {
      team_players: playersWithPrices.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0
      })),
      cash_in_bank: cashInBank,
      strategy: strategy,
      trade_type: tradeType,
      num_trades: numTrades,
      allowed_positions: allowedPositions && allowedPositions.length > 0 ? allowedPositions : null,
      simulate_datetime: null,
      apply_lockout: false,
      excluded_players: null,
      target_bye_round: targetByeRound
    };

    console.log('Sending trade calculation request:', payload);

    // Make API request
    const response = await fetch(`${API_BASE_URL}/calculate_team_trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Trade recommendations received:', data);

    return data;
  } catch (error) {
    console.error('Error calculating team trades:', error);
    throw error;
  }
}

/**
 * Calculate preseason trade-in recommendations (individual players, not pairs)
 * @param {Array} teamPlayers - Array of player objects in the user's team
 * @param {Array} tradeOutPlayers - Array of players selected for trade-out
 * @param {number} salaryCap - Available salary cap for trade-ins
 * @param {string} strategy - '1' = value, '2' = base, '3' = hybrid
 * @param {Array} positions - Positions to filter trade-ins by (from trade-outs)
 * @param {boolean} targetByeRound - Whether to prioritize bye round coverage
 * @returns {Promise<Object>} Object with trade_ins array of individual player recommendations
 */
export async function calculatePreseasonTradeIns(
  teamPlayers,
  tradeOutPlayers,
  salaryCap,
  strategy = '1',
  positions = [],
  targetByeRound = false
) {
  try {
    // Validate inputs
    if (!tradeOutPlayers || tradeOutPlayers.length === 0) {
      throw new Error('No trade-out players provided');
    }

    // Prepare request payload
    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0
      })),
      trade_out_players: tradeOutPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0,
        position: player.originalPosition || player.positions?.[0]
      })),
      salary_cap: salaryCap,
      strategy: strategy,
      positions: positions.filter(Boolean),
      target_bye_round: targetByeRound
    };

    console.log('Sending preseason trade-in request:', payload);

    // Make API request
    const response = await fetch(`${API_BASE_URL}/calculate_preseason_trade_ins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Preseason trade-in recommendations received:', data);

    return data;
  } catch (error) {
    console.error('Error calculating preseason trade-ins:', error);
    throw error;
  }
}

/**
 * Check if the Flask backend is running
 * @returns {Promise<boolean>} True if backend is accessible
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/players`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

