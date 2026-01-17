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
 * @param {number} numTrades - Number of trades to make
 * @param {Array} allowedPositions - Array of position strings (e.g., ['HOK', 'MID'])
 * @param {boolean} targetByeRound - Whether to prioritize bye round coverage
 * @param {boolean} preseasonMode - If true, only include players that are injured, overvalued (diff < -2), or not selected
 * @returns {Promise<Object>} Trade recommendations with trade_out and trade_in arrays
 */
export async function calculateTeamTrades(
  teamPlayers,
  cashInBank = 0,
  strategy = '1',
  numTrades = 2,
  allowedPositions = null,
  targetByeRound = false,
  preseasonMode = false,
  preselectedTradeOuts = null
) {
  try {
    // Validate inputs
    if (!teamPlayers || teamPlayers.length === 0) {
      throw new Error('No team players provided');
    }

    // Send all players to backend - backend will look up prices from database if not provided
    // This supports Format 2 screenshots where prices aren't visible
    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || null  // null prices will be looked up by backend
      })),
      cash_in_bank: cashInBank,
      strategy: strategy,
      num_trades: numTrades,
      allowed_positions: allowedPositions && allowedPositions.length > 0 ? allowedPositions : null,
      simulate_datetime: null,
      apply_lockout: false,
      excluded_players: null,
      target_bye_round: targetByeRound,
      preseason_mode: preseasonMode,
      preselected_trade_outs: (preselectedTradeOuts && Array.isArray(preselectedTradeOuts)) ? preselectedTradeOuts.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || 0,
        slot_position: player.originalPosition || null,
        trade_in_positions: player.trade_in_positions || null
      })) : null
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

    // Prepare request payload - backend will look up prices from database if not provided
    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || null
      })),
      trade_out_players: tradeOutPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || null,
        position: player.originalPosition || player.positions?.[0],
        trade_in_positions: player.trade_in_positions || null
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
        price: player.price || null
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
 * Analyze team status - get injured players and overvalued players (by threshold)
 * @param {Array} teamPlayers - Array of player objects with name, positions, price
 * @returns {Promise<Object>} Object with injured_players, urgent_overvalued_players, overvalued_players arrays
 * 
 * Overvalued categories (based on Diff value):
 * - urgent_overvalued_players: Diff <= -7 (very overvalued, losing lots of money)
 * - overvalued_players: -7 < Diff <= -1 (moderately overvalued)
 */
export async function analyzeTeamStatus(teamPlayers) {
  try {
    if (!teamPlayers || teamPlayers.length === 0) {
      return { 
        injured_players: [], 
        urgent_overvalued_players: [], 
        overvalued_players: [], 
        not_selected_players: [] 
      };
    }

    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || null
      }))
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
      return { 
        injured_players: injured, 
        urgent_overvalued_players: [], 
        overvalued_players: [], 
        not_selected_players: [] 
      };
    }

    const data = await response.json();
    console.log('Team analysis complete:', data);
    return {
      injured_players: data.injured_players || [],
      urgent_overvalued_players: data.urgent_overvalued_players || [],
      overvalued_players: data.overvalued_players || [],
      not_selected_players: data.not_selected_players || [],
      junk_cheapies: data.junk_cheapies || []
    };
  } catch (error) {
    console.error('Error analyzing team status:', error);
    // Fallback to just checking injured players
    try {
      const injured = await checkInjuredPlayers(teamPlayers);
      return { 
        injured_players: injured, 
        urgent_overvalued_players: [], 
        overvalued_players: [] 
      };
    } catch {
      return { 
        injured_players: [], 
        urgent_overvalued_players: [], 
        overvalued_players: [], 
        not_selected_players: [] 
      };
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

// Cache for player validation list
let playerValidationCache = null;
let playerValidationCacheTime = 0;
const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the list of valid player names for OCR validation
 * Returns cached data if available and not expired
 * @returns {Promise<Array>} Array of player objects with fullName, abbreviatedName, surname, initial
 */
export async function fetchPlayerValidationList() {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (playerValidationCache && (now - playerValidationCacheTime) < VALIDATION_CACHE_TTL) {
      console.log('Using cached player validation list');
      return playerValidationCache;
    }

    console.log('Fetching fresh player validation list...');
    const response = await fetch(`${API_BASE_URL}/get_player_validation_list`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('Error fetching player validation list:', response.status);
      return playerValidationCache || []; // Return stale cache if available
    }

    const data = await response.json();
    playerValidationCache = data;
    playerValidationCacheTime = now;
    console.log(`Cached ${data.length} players for OCR validation`);
    
    return data;
  } catch (error) {
    console.error('Error fetching player validation list:', error);
    return playerValidationCache || []; // Return stale cache if available
  }
}

/**
 * Validate an OCR-extracted player name against the database
 * Uses fuzzy matching to handle OCR errors
 * @param {string} extractedName - Name extracted from OCR (e.g., "A. Fonua-Blake")
 * @param {Array} validPlayers - Array from fetchPlayerValidationList()
 * @returns {Object|null} Matched player object or null if no match
 */
export function validatePlayerName(extractedName, validPlayers) {
  if (!extractedName || !validPlayers || validPlayers.length === 0) {
    return null;
  }

  // Parse the extracted name (expected format: "I. Surname")
  const parts = extractedName.split('. ');
  if (parts.length !== 2) {
    return null;
  }

  const [initial, surname] = parts;
  const normalizedInitial = initial.toLowerCase().trim();
  const normalizedSurname = surname.toLowerCase().trim();

  // Exact match first
  const exactMatch = validPlayers.find(p => 
    p.initial === normalizedInitial && p.surname === normalizedSurname
  );
  if (exactMatch) {
    return { ...exactMatch, matchType: 'exact' };
  }

  // Fuzzy surname match with same initial (handles minor OCR errors)
  const fuzzyMatches = validPlayers.filter(p => {
    if (p.initial !== normalizedInitial) return false;
    
    // Calculate Levenshtein-like similarity
    const similarity = calculateSimilarity(p.surname, normalizedSurname);
    return similarity >= 0.85; // 85% similarity threshold
  });

  if (fuzzyMatches.length === 1) {
    return { ...fuzzyMatches[0], matchType: 'fuzzy' };
  }

  // No match found - this is likely a false positive (UI text, team name, etc.)
  return null;
}

/**
 * Calculate string similarity (0-1) between two strings
 * Uses a simple character-based approach optimized for surname matching
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  const longerLength = longer.length;
  if (longerLength === 0) return 1;

  // Calculate edit distance
  const editDistance = levenshteinDistance(str1, str2);
  return (longerLength - editDistance) / longerLength;
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Validate a list of OCR-extracted players against the database
 * Returns only valid players (those that match real players in the database)
 * @param {Array} extractedPlayers - Array of player objects from OCR
 * @param {Array} validPlayers - Array from fetchPlayerValidationList()
 * @returns {Array} Array of validated player objects with matched database names
 */
export function validateExtractedPlayers(extractedPlayers, validPlayers) {
  if (!extractedPlayers || extractedPlayers.length === 0) {
    return [];
  }

  const validatedPlayers = [];
  const rejectedNames = [];

  for (const player of extractedPlayers) {
    const match = validatePlayerName(player.name, validPlayers);
    
    if (match) {
      validatedPlayers.push({
        ...player,
        // Use the abbreviated name from database for consistency
        name: match.abbreviatedName,
        fullName: match.fullName,
        matchType: match.matchType
      });
    } else {
      rejectedNames.push(player.name);
    }
  }

  if (rejectedNames.length > 0) {
    console.log('OCR validation rejected (not real players):', rejectedNames);
  }
  console.log(`OCR validation: ${validatedPlayers.length} valid, ${rejectedNames.length} rejected`);

  return validatedPlayers;
}

/**
 * Look up player prices from the database
 * Used for Format 2 screenshots where prices aren't visible in the OCR text
 * @param {Array} teamPlayers - Array of player objects with name, positions (price may be null/0)
 * @returns {Promise<Array>} Array of player objects with prices filled in
 */
export async function lookupPlayerPrices(teamPlayers) {
  try {
    if (!teamPlayers || teamPlayers.length === 0) {
      return [];
    }

    const payload = {
      team_players: teamPlayers.map(player => ({
        name: player.name,
        positions: player.positions || [],
        price: player.price || null
      }))
    };

    console.log('Looking up player prices:', payload);

    const response = await fetch(`${API_BASE_URL}/lookup_player_prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Error looking up player prices:', response.status);
      return teamPlayers; // Return original players if lookup fails
    }

    const data = await response.json();
    console.log('Player prices looked up:', data);
    
    return data.players || teamPlayers;
  } catch (error) {
    console.error('Error looking up player prices:', error);
    return teamPlayers; // Return original players if lookup fails
  }
}

