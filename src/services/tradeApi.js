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

/**
 * Analyse loop opportunities without performing trades.
 * @param {Array} teamPlayers - Array of player objects (expects play_status/kickoff_rank if available)
 * @param {Object} fixtureMap - Optional mapping of team -> kickoff_rank
 * @returns {Promise<Object>} Loop advisory structure
 */
export async function analyseLoopOptions(teamPlayers, fixtureMap = {}) {
  try {
    const payload = {
      team: teamPlayers,
      fixture_map: fixtureMap
    };

    const response = await fetch(`${API_BASE_URL}/analyse_loops`, {
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

    return response.json();
  } catch (error) {
    console.error('Error analysing loop options:', error);
    throw error;
  }
}

