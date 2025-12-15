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
 * @param {boolean} targetByeRound - Whether to prioritize bye round coverage
 * @param {boolean} preseasonMode - If true, only include players that are injured, overvalued (diff < -2), or not selected
 * @returns {Promise<Object>} Trade recommendations with trade_out and trade_in arrays
 */
export async function calculateTeamTrades(
  teamPlayers,
  cashInBank = 0,
  strategy = '1',
  tradeType = 'likeForLike',
  numTrades = 2,
  allowedPositions = null,
  targetByeRound = false,
  preseasonMode = false
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
      target_bye_round: targetByeRound,
      preseason_mode: preseasonMode
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
 * @param {boolean} testApproach - If true, use price band matching (±$75k from trade-out prices)
 * @returns {Promise<Object>} Object with trade_ins array of individual player recommendations
 */
export async function calculatePreseasonTradeIns(
  teamPlayers,
  tradeOutPlayers,
  salaryCap,
  strategy = '1',
  positions = [],
  targetByeRound = false,
  testApproach = false
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
      target_bye_round: targetByeRound,
      test_approach: testApproach
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
 * Check which players from the team are injured
 * @param {Array} teamPlayers - Array of player objects with name, positions, price
 * @returns {Promise<Array>} Array of injured player names
 */
export async function checkInjuredPlayers(teamPlayers) {
  try {
    if (!teamPlayers || teamPlayers.length === 0) {
      return [];
    }

    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0
      }))
    };

    const response = await fetch(`${API_BASE_URL}/check_injured_players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Error checking injured players:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('Injured players detected:', data.injured_players);
    return data.injured_players || [];
  } catch (error) {
    console.error('Error checking injured players:', error);
    return [];
  }
}

/**
 * Analyze team status - get both injured players and low-upside (overvalued) players
 * @param {Array} teamPlayers - Array of player objects with name, positions, price
 * @param {number} lowUpsideCount - Number of low-upside players to identify (default 2)
 * @returns {Promise<Object>} Object with injured_players and low_upside_players arrays
 */
export async function analyzeTeamStatus(teamPlayers, lowUpsideCount = 2) {
  try {
    if (!teamPlayers || teamPlayers.length === 0) {
      return { injured_players: [], low_upside_players: [], not_selected_players: [] };
    }

    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0
      })),
      low_upside_count: lowUpsideCount
    };

    const response = await fetch(`${API_BASE_URL}/analyze_team_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Error analyzing team status:', response.status);
      // Fallback to just checking injured players if endpoint doesn't exist
      const injured = await checkInjuredPlayers(teamPlayers);
      return { injured_players: injured, low_upside_players: [], not_selected_players: [] };
    }

    const data = await response.json();
    console.log('Team analysis complete:', data);
    return {
      injured_players: data.injured_players || [],
      low_upside_players: data.low_upside_players || [],
      not_selected_players: data.not_selected_players || [],
      junk_cheapies: data.junk_cheapies || []
    };
  } catch (error) {
    console.error('Error analyzing team status:', error);
    // Fallback to just checking injured players
    try {
      const injured = await checkInjuredPlayers(teamPlayers);
      return { injured_players: injured, low_upside_players: [] };
    } catch {
      return { injured_players: [], low_upside_players: [], not_selected_players: [] };
    }
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

