import pandas as pd
from typing import List, Dict, Tuple
from dataclasses import dataclass
from itertools import combinations
from datetime import datetime
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from bye_analyser import apply_bye_weighting

@dataclass
class Player:
    name: str
    price: int
    position: str
    secondary_position: str = None
    team: str = None
    projection: float = 0
    diff: float = 0


# Central fixture ordering so kickoff ranking can be reused
FIXTURES = [
    ("2025-08-07 19:50", ["MEL", "BRI"]),  # Storm vs Broncos
    ("2025-08-08 18:00", ["NEW", "PEN"]),  # Knights vs Panthers
    ("2025-08-08 20:00", ["CAN", "MAN"]),  # Raiders vs Sea Eagles
    ("2025-08-09 15:00", ["SGI", "CRO"]),  # Dragons vs Sharks
    ("2025-08-09 17:30", ["DOL", "SYD"]),  # Dolphins vs Roosters
    ("2025-08-09 19:35", ["CBY", "WAR"]),  # Bulldogs vs Warriors
    ("2025-08-10 14:00", ["GLD", "SOU"]),  # Titans vs Rabbitohs
    ("2025-08-10 16:05", ["PAR", "NQL"]),  # Eels vs Cowboys
]


def get_fixture_rank_map() -> Dict[str, int]:
    """Return mapping of team code to kickoff order rank (lower = earlier)."""
    rank_map: Dict[str, int] = {}
    for idx, (_, teams) in enumerate(FIXTURES):
        for team in teams:
            rank_map[team] = idx + 1  # 1-based rank
    return rank_map


def match_abbreviated_name_to_full(abbreviated_name: str, all_players: pd.DataFrame) -> str:
    """
    Match an abbreviated name like "A. Fonua-Blake" to a full name like "Addin Fonua-Blake".
    
    Parameters:
    abbreviated_name (str): Name in format "I. Surname" (e.g., "A. Fonua-Blake")
    all_players (pd.DataFrame): DataFrame containing player data with 'Player' column
    
    Returns:
    str: The full player name if found, otherwise the original abbreviated name
    """
    # Check if already a full name (not abbreviated)
    if abbreviated_name in all_players['Player'].values:
        return abbreviated_name
    
    # Parse the abbreviated name
    parts = abbreviated_name.split('. ', 1)
    if len(parts) != 2:
        return abbreviated_name
    
    initial, surname = parts
    
    # Try to find a matching player
    # Match: surname matches AND first name starts with the initial
    for player_name in all_players['Player'].unique():
        player_parts = player_name.split(' ', 1)
        if len(player_parts) == 2:
            first_name, last_name = player_parts
            # Check if surname matches and first name starts with initial
            if last_name == surname and first_name[0].upper() == initial.upper():
                return player_name
    
    # If no match found, return the original name
    return abbreviated_name


def load_data() -> pd.DataFrame:
    """
    Load data from PostgreSQL database and rename columns to match expected names.
    
    Returns:
    pd.DataFrame: DataFrame with standardized column names
    """
    # Read database connection parameters from environment
    # Load .env from project root
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path)
    
    # Get the database URL from Heroku environment or local env file
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        # Handle Heroku's postgres:// URL format
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        
        # Create SQLAlchemy engine
        engine = create_engine(database_url)
    else:
        # Use individual connection parameters if DATABASE_URL is not available
        db_params = {
            'host': os.getenv('DB_HOST'),
            'database': os.getenv('DB_DATABASE'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'port': os.getenv('DB_PORT')
        }
        
        # Create connection string
        conn_str = f"postgresql://{db_params['user']}:{db_params['password']}@{db_params['host']}:{db_params['port']}/{db_params['database']}"
        engine = create_engine(conn_str)
    
    try:
        # See what columns are actually in the database
        with engine.connect() as connection:
            # Get column names from the table
            query = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'player_stats';
            """
            db_columns = pd.read_sql(query, connection)
            
            # Now fetch the actual data
            query = "SELECT * FROM player_stats;"
            df = pd.read_sql(query, connection)

            print(f"Database columns found: {db_columns['column_name'].tolist()}")
            print(f"DataFrame columns after loading: {df.columns.tolist()}")
            print(f"Sample bye_round_grading data: {df['bye_round_grading'].dropna().head() if 'bye_round_grading' in df.columns else 'Column not found'}")
            print(f"Sample Bye_Round_Grading data: {df['Bye_Round_Grading'].dropna().head() if 'Bye_Round_Grading' in df.columns else 'Column not found'}")
        
        # Ensure required columns exist
        required_columns = ['Round', 'Team', 'POS1', 'Player', 'Price', 'Diff', 'Projection']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        # Convert Round to integer
        df['Round'] = df['Round'].astype(int)
        
        # Standardise optional columns
        if 'POS2' not in df.columns:
            df['POS2'] = None

        # Normalise bye-round grade column name if present
        print(f"Before column renaming - bye_round_grade in columns: {'bye_round_grade' in df.columns}")
        print(f"Before column renaming - Bye_Round_Grading in columns: {'Bye_Round_Grading' in df.columns}")
        print(f"Before column renaming - bye_round_grading in columns: {'bye_round_grading' in df.columns}")

        if 'bye_round_grade' not in df.columns:
            for alt in ['Bye Round Grading', 'Bye_Round_Grading', 'Bye_round_grade']:
                if alt in df.columns:
                    print(f"Renaming column '{alt}' to 'bye_round_grade'")
                    df = df.rename(columns={alt: 'bye_round_grade'})
                    break

        if 'bye_round_grade' not in df.columns:
            print("Warning: bye_round_grade column not found in data. Available columns:", df.columns.tolist())
            df['bye_round_grade'] = None
        else:
            df['bye_round_grade'] = pd.to_numeric(df['bye_round_grade'], errors='coerce')
            print(f"bye_round_grade column loaded. Sample values: {df['bye_round_grade'].dropna().unique()[:10].tolist()}")

        # Normalise Injured column if present
        if 'Injured' not in df.columns:
            df['Injured'] = False
        else:
            # Convert to boolean (handle various formats: True/False, TRUE/FALSE, 1/0, 't'/'f', etc.)
            def convert_to_bool(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bool):
                    return val
                if isinstance(val, (int, float)):
                    return bool(val)
                if isinstance(val, str):
                    return val.lower() in ('true', 't', 'yes', 'y', '1')
                return bool(val)
            
            df['Injured'] = df['Injured'].apply(convert_to_bool)
            print(f"Injured column after conversion - unique values: {df['Injured'].unique()}, dtype: {df['Injured'].dtype}")

        return df
        
    except Exception as e:
        print(f"Error loading data from database: {str(e)}")
        raise


def get_rounds_data(df: pd.DataFrame) -> List[pd.DataFrame]:
    """
    Split consolidated data into list of DataFrames by round.
    """
    rounds = sorted(df['Round'].unique())
    return [df[df['Round'] == round_num].copy() for round_num in rounds]


def get_traded_out_positions(traded_out_players, consolidated_data: pd.DataFrame) -> List[Dict]:
    """
    Get the position requirements for each player being traded out.
    Players in positional slots require coverage of their position.
    Players in INT/EMG slots can specify trade_in_positions for coverage.

    Parameters:
    traded_out_players: List of player names (str) or player dicts with slot_position and trade_in_positions
    consolidated_data (pd.DataFrame): Full dataset containing player information

    Returns:
    List[Dict]: List of dicts with 'player_name' and 'required_positions' for each trade-out player
    """
    position_requirements = []

    # Handle both old format (list of strings) and new format (list of dicts)
    for player in traded_out_players:
        if isinstance(player, dict):
            # New format: player dict with slot_position and trade_in_positions
            player_name = player['name']
            slot_position = player.get('slot_position')
            trade_in_positions = player.get('trade_in_positions')

            required_positions = []

            # Check for explicit trade_in_positions (new feature for INT/EMG players)
            if trade_in_positions and len(trade_in_positions) > 0:
                # Use the specified trade_in_positions
                required_positions = trade_in_positions
            # Fallback to slot position logic for backward compatibility
            elif slot_position and slot_position not in ['INT', 'EMG']:
                player_data = consolidated_data[consolidated_data['Player'] == player_name].sort_values('Round', ascending=False)
                if not player_data.empty:
                    required_positions = [player_data.iloc[0]['POS1']]

            position_requirements.append({
                'player_name': player_name,
                'required_positions': required_positions
            })
        else:
            # Old format: just player name string (fallback for compatibility)
            player_name = player
            player_data = consolidated_data[consolidated_data['Player'] == player_name].sort_values('Round', ascending=False)
            required_positions = []
            if not player_data.empty:
                required_positions = [player_data.iloc[0]['POS1']]

            position_requirements.append({
                'player_name': player_name,
                'required_positions': required_positions
            })

    return position_requirements


def get_locked_out_players(simulate_datetime: str, consolidated_data: pd.DataFrame) -> set:
    """
    Get the set of players who are locked out based on the simulated date/time.
    """
    if not simulate_datetime:
        return set()
    
    # Parse the simulated date/time
    simulate_dt = datetime.strptime(simulate_datetime, '%Y-%m-%dT%H:%M')
    
    locked_out_teams = set()
    for fixture_time, teams in FIXTURES:
        fixture_dt = datetime.strptime(fixture_time, '%Y-%m-%d %H:%M')
        if fixture_dt <= simulate_dt:
            locked_out_teams.update(teams)
    
    # Use the Team column from the main data instead of teamlists.csv
    locked_out_players = set()
    latest_round_data = consolidated_data.sort_values('Round').groupby('Player').last().reset_index()
    
    for team in locked_out_teams:
        team_players = latest_round_data[latest_round_data['Team'] == team]['Player'].tolist()
        locked_out_players.update(team_players)
    
    return locked_out_players


def is_player_locked(player_name: str, consolidated_data: pd.DataFrame, simulate_datetime: str) -> bool:
    """
    Check if a player is locked based on the simulated date/time.
    """
    if not simulate_datetime:
        return False
    
    # Parse the simulated date/time
    simulate_dt = datetime.strptime(simulate_datetime, '%Y-%m-%dT%H:%M')
    
    locked_out_teams = set()
    for fixture_time, teams in FIXTURES:
        fixture_dt = datetime.strptime(fixture_time, '%Y-%m-%d %H:%M')
        if fixture_dt <= simulate_dt:
            locked_out_teams.update(teams)
    
    # Use the Team column from the main data instead of teamlists.csv
    latest_round_data = consolidated_data.sort_values('Round').groupby('Player').last().reset_index()
    player_data = latest_round_data[latest_round_data['Player'] == player_name]
    
    if player_data.empty:
        return False
        
    player_team = player_data['Team'].values[0]
    return player_team in locked_out_teams


def create_combination(players, total_price, salary_freed):
    """Helper function to create a trade combination dictionary"""
    return {
        'players': [create_player_dict(player) for player in players],
        'total_price': total_price,
        'total_projection': sum(player.get('Projection', 0) for player in players),
        'total_diff': sum(player.get('Diff', 0) for player in players),
        'salary_remaining': salary_freed - total_price
    }


def create_player_dict(player):
    """Helper function to create consistent player dictionary"""
    bye_grade = player.get('bye_round_grade')
    # Convert NaN to None for JSON serialization
    if pd.isna(bye_grade):
        bye_grade = None

    return {
        'name': player['Player'],
        'team': player['Team'],
        'position': player['POS1'],
        'secondary_position': player.get('POS2'),
        'price': player['Price'],
        'projection': player.get('Projection', 0),
        'diff': player.get('Diff', 0),
        'bye_round_grade': bye_grade
    }


def generate_trade_options(
    available_players: pd.DataFrame,
    salary_freed: float,
    maximize_base: bool = False,
    hybrid_approach: bool = False,
    max_options: int = 10,
    traded_out_positions = None,  # Can be List[str] (old format) or List[Dict] (new format)
    num_players_needed: int = 2,
    target_bye_round: bool = False
) -> List[Dict]:
    """
    Generate trade combinations based on selected optimization strategy while ensuring
    position requirements are met for both like-for-like and positional swap trades.
    """
    valid_combinations = []
    used_players = set()
    
    # Make a copy to avoid modifying the original DataFrame
    players_df = available_players.copy()
    
    # Ensure numeric columns are properly typed
    numeric_columns = ['Price', 'Diff', 'Projection']
    for col in numeric_columns:
        if col in players_df.columns:
            players_df[col] = pd.to_numeric(players_df[col], errors='coerce').fillna(0)
    
    # Convert DataFrame to list of dictionaries for easier manipulation
    print(f"DataFrame columns before dict conversion: {players_df.columns.tolist()}")
    print(f"Sample bye_round_grade values before dict conversion: {players_df['bye_round_grade'].dropna().head().tolist() if 'bye_round_grade' in players_df.columns else 'Column not found'}")
    players = players_df.to_dict('records')
    print(f"First player dict keys: {list(players[0].keys()) if players else 'No players'}")
    print(f"First player bye_round_grade: {players[0].get('bye_round_grade') if players else 'No players'}")
    
    # Create a position mapping for each player
    position_mapping = {}
    for player in players:
        positions = [player['POS1']]
        if pd.notna(player.get('POS2')):
            positions.append(player['POS2'])
        position_mapping[player['Player']] = positions
    
    # Function to check if a player has at least one position from the required positions
    def has_valid_position(player, valid_positions):
        player_positions = position_mapping[player['Player']]
        return any(pos in valid_positions for pos in player_positions)
    
    # Function to check if a player combination meets position requirements
    def is_valid_trade_combo(player_combo):
        if not traded_out_positions:
            return True  # No positional requirements

        # Check if we're using the new format (list of dicts with per-player requirements)
        if traded_out_positions and len(traded_out_positions) > 0 and isinstance(traded_out_positions[0], dict):
            # New format: check per-player requirements
            # Each trade-out player with specific position requirements must be satisfied by at least one trade-in player

            # First, ensure all trade-in players can play at least one position overall
            all_positions = ['HOK', 'MID', 'EDG', 'HLF', 'CTR', 'WFB']
            for trade_in_player in player_combo:
                if not has_valid_position(trade_in_player, all_positions):
                    return False

            # Check per-trade-out-player requirements with DPP limitation:
            # Each trade-out player with requirements must be satisfied by at least one trade-in player,
            # but each trade-in player can only satisfy one trade-out player's requirements

            # First, collect unsatisfied trade-out requirements
            unsatisfied_requirements = []
            for trade_out_req in traded_out_positions:
                required_positions = trade_out_req.get('required_positions', [])
                if required_positions:
                    unsatisfied_requirements.append(required_positions)

            if not unsatisfied_requirements:
                return True  # No requirements to satisfy

            # For each trade-in player, see which requirements they can satisfy
            # Each trade-in player can only satisfy one requirement group
            satisfied_count = 0
            used_players = set()

            for trade_in_player in player_combo:
                if trade_in_player['Player'] in used_players:
                    continue

                # Check if this player can satisfy any unsatisfied requirement
                for i, req_positions in enumerate(unsatisfied_requirements):
                    if any(pos in position_mapping[trade_in_player['Player']] for pos in req_positions):
                        # This player can satisfy this requirement
                        unsatisfied_requirements.pop(i)  # Remove satisfied requirement
                        used_players.add(trade_in_player['Player'])
                        satisfied_count += 1
                        break

            # All requirements must be satisfied
            return len(unsatisfied_requirements) == 0
        else:
            # Old format: each player must have at least one valid position (backward compatibility)
            if not all(has_valid_position(player, traded_out_positions) for player in player_combo):
                return False

            # All required positions must be covered
            positions_covered = set()
            for player in player_combo:
                for pos in position_mapping[player['Player']]:
                    if pos in traded_out_positions:
                        positions_covered.add(pos)

            return set(traded_out_positions) == positions_covered
    
    
    # Function to get price bracket for a player
    def get_price_bracket(price):
        brackets = [
            (250000, 317500),   # Bracket 1
            (317501, 385000),   # Bracket 2
            (385001, 452500),   # Bracket 3
            (452501, 520000),   # Bracket 4
            (520001, 587500),   # Bracket 5
            (587501, 655000),   # Bracket 6
            (655001, 722500),   # Bracket 7
            (722501, 790000),   # Bracket 8
            (790001, 857500)    # Bracket 9
        ]
        
        for i, (min_price, max_price) in enumerate(brackets):
            if min_price <= price <= max_price:
                return i + 1
        return None  # Price out of all defined brackets
    
    # Function to check if a player meets requirements for a specific level
    def meets_level_requirements(diff, price, level):
        bracket = get_price_bracket(price)
        if bracket is None:
            return False
        
        # Level 1 Requirements
        if level == 1:
            if bracket == 1 and diff >= 32.50: return True
            if bracket == 2 and 29.58 <= diff <= 32.49: return True
            if bracket == 3 and 26.67 <= diff <= 29.57: return True
            if bracket == 4 and 23.75 <= diff <= 26.66: return True
            if bracket == 5 and 20.83 <= diff <= 23.74: return True
            if bracket == 6 and 17.92 <= diff <= 20.82: return True
            if bracket == 7 and 15.00 <= diff <= 17.91: return True
            if bracket == 8 and 12.08 <= diff <= 14.99: return True
            if bracket == 9 and 9.17 <= diff <= 12.07: return True
            
        # Level 2 Requirements
        elif level == 2:
            if bracket == 1 and 29.58 <= diff <= 32.49: return True
            if bracket == 2 and 26.67 <= diff <= 29.57: return True
            if bracket == 3 and 23.75 <= diff <= 26.66: return True
            if bracket == 4 and 20.83 <= diff <= 23.74: return True
            if bracket == 5 and 17.92 <= diff <= 20.82: return True
            if bracket == 6 and 15.00 <= diff <= 17.91: return True
            if bracket == 7 and 12.08 <= diff <= 14.99: return True
            if bracket == 8 and 9.17 <= diff <= 12.07: return True
            if bracket == 9 and 7.80 <= diff <= 9.16: return True
            
        # Level 3 Requirements
        elif level == 3:
            if bracket == 1 and 26.67 <= diff <= 29.57: return True
            if bracket == 2 and 23.75 <= diff <= 26.66: return True
            if bracket == 3 and 20.83 <= diff <= 23.74: return True
            if bracket == 4 and 17.92 <= diff <= 20.82: return True
            if bracket == 5 and 15.00 <= diff <= 17.91: return True
            if bracket == 6 and 12.08 <= diff <= 14.99: return True
            if bracket == 7 and 9.17 <= diff <= 12.07: return True
            if bracket == 8 and 7.80 <= diff <= 9.16: return True
            # Bracket 9 excluded for level 3
            
        # Level 4 Requirements
        elif level == 4:
            if bracket == 1 and 23.75 <= diff <= 26.66: return True
            if bracket == 2 and 20.83 <= diff <= 23.74: return True
            if bracket == 3 and 17.92 <= diff <= 20.82: return True
            if bracket == 4 and 15.00 <= diff <= 17.91: return True
            if bracket == 5 and 12.08 <= diff <= 14.99: return True
            if bracket == 6 and 9.17 <= diff <= 12.07: return True
            if bracket == 7 and 7.80 <= diff <= 9.16: return True
            # Brackets 8 and 9 excluded for level 4
            
        # Level 5 Requirements
        elif level == 5:
            if bracket == 1 and 20.83 <= diff <= 23.74: return True
            if bracket == 2 and 17.92 <= diff <= 20.82: return True
            if bracket == 3 and 15.00 <= diff <= 17.91: return True
            if bracket == 4 and 12.08 <= diff <= 14.99: return True
            if bracket == 5 and 9.17 <= diff <= 12.07: return True
            if bracket == 6 and 7.80 <= diff <= 9.16: return True
            # Brackets 7, 8, and 9 excluded for level 5
            
        # Level 6 Requirements
        elif level == 6:
            if bracket == 1 and 17.92 <= diff <= 20.82: return True
            if bracket == 2 and 15.00 <= diff <= 17.91: return True
            if bracket == 3 and 12.08 <= diff <= 14.99: return True
            if bracket == 4 and 9.17 <= diff <= 12.07: return True
            if bracket == 5 and 7.80 <= diff <= 9.16: return True
            # Brackets 6, 7, 8, and 9 excluded for level 6
            
        # Level 7 Requirements
        elif level == 7:
            if bracket == 1 and 15.00 <= diff <= 17.91: return True
            if bracket == 2 and 12.08 <= diff <= 14.99: return True
            if bracket == 3 and 9.17 <= diff <= 12.07: return True
            if bracket == 4 and 7.80 <= diff <= 9.16: return True
            # Brackets 5, 6, 7, 8, and 9 excluded for level 7
            
        # Level 8 Requirements
        elif level == 8:
            if bracket == 1 and 12.08 <= diff <= 14.99: return True
            if bracket == 2 and 9.17 <= diff <= 12.07: return True
            if bracket == 3 and 7.80 <= diff <= 9.16: return True
            # Brackets 4, 5, 6, 7, 8, and 9 excluded for level 8
            
        # Level 9 Requirements
        elif level == 9:
            if bracket == 1 and 9.17 <= diff <= 12.07: return True
            if bracket == 2 and 7.80 <= diff <= 9.16: return True
            # Brackets 3, 4, 5, 6, 7, 8, and 9 excluded for level 9
            
        # Level 10 Requirements
        elif level == 10:
            if bracket == 1 and 7.80 <= diff <= 9.16: return True
            # All other brackets excluded for level 10
            
        return False
    
    # Function to calculate player priority
    def calculate_player_priority(player):
        diff = player['Diff']
        price = player['Price']
        bye_grade = player.get('bye_round_grade', 5)  # Default to 5 (worst) if not available

        # Players with upside below 7.80 points are excluded
        if diff < 7.80:
            return None

        # Check which level the player meets requirements for (starting from most valuable)
        for level in range(1, 11):
            if meets_level_requirements(diff, price, level):
                bracket = get_price_bracket(price)
                # Return tuple for sorting: (level, bracket, -bye_grade, diff)
                # Lower level = higher priority, lower bracket = higher priority within level
                # Higher bye_grade = higher priority (better bye coverage), higher diff = higher priority
                return (level, bracket, -bye_grade, -diff)
        
        # Player doesn't meet any level requirements
        return None
    
    # Sort players based on strategy
    # If target_bye_round is enabled, players are already sorted by bye weighting, so skip re-sorting
    if not target_bye_round:
        if maximize_base:
            players.sort(key=lambda x: x['Projection'], reverse=True)
        elif hybrid_approach:
            # Calculate priority for each player and filter out players that don't meet any requirements
            players_with_priority = [(player, calculate_player_priority(player)) for player in players]
            valid_players = [p for p, priority in players_with_priority if priority is not None]
            valid_players.sort(key=lambda x: calculate_player_priority(x))
            players = valid_players
        else:  # maximize_value - use Diff
            players.sort(key=lambda x: x['Diff'], reverse=True)
    
    # Handle single player trades
    if num_players_needed == 1:
        for player in players:
            if player['Player'] in used_players:
                continue

            if player['Price'] <= salary_freed and is_valid_trade_combo([player]):
                combo = create_combination([player], player['Price'], salary_freed)
                valid_combinations.append(combo)
                used_players.add(player['Player'])
                if len(valid_combinations) >= max_options:
                    break
    # Handle 2+ player trades
    else:
        if maximize_base:
            # For 2+ player trades, find combinations with highest total Projection
            for i in range(len(players)):
                if players[i]['Player'] in used_players:
                    continue
                    
                first_player = players[i]
                
                # Find the best valid second player
                best_second_player = None
                best_j = -1
                for j in range(len(players)):
                    if j == i or players[j]['Player'] in used_players:
                        continue

                    second_player = players[j]

                    # Check if the combination meets position requirements
                    position_valid = is_valid_trade_combo([first_player, second_player])

                    if not position_valid:
                        continue

                    total_price = first_player['Price'] + second_player['Price']
                    if total_price <= salary_freed:
                        # For bye round mode, prefer players higher in the list (better bye grading)
                        if best_second_player is None or (target_bye_round and j < best_j):
                            best_second_player = second_player
                            best_j = j
                        # In normal mode, take the first valid one
                        if not target_bye_round:
                            break

                if best_second_player:
                    total_price = first_player['Price'] + best_second_player['Price']
                    combo = create_combination([first_player, best_second_player], total_price, salary_freed)
                    valid_combinations.append(combo)
                    used_players.add(first_player['Player'])
                    used_players.add(best_second_player['Player'])
                
                if len(valid_combinations) >= max_options:
                    break
                    
        elif hybrid_approach:
            # For hybrid approach, use the prioritized players in order
            for i, first_player in enumerate(players):
                if first_player['Player'] in used_players or first_player['Price'] > salary_freed:
                    continue

                remaining_salary = salary_freed - first_player['Price']

                # Use all available players
                second_player_candidates = players

                # Find the best valid second player
                best_second_player = None
                found_match = False
                for second_player in second_player_candidates:
                    if second_player['Player'] == first_player['Player'] or second_player['Player'] in used_players:
                        continue

                    # Check if the combination meets position requirements
                    position_valid = is_valid_trade_combo([first_player, second_player])

                    if not position_valid:
                        continue

                    total_price = first_player['Price'] + second_player['Price']
                    if total_price <= salary_freed:
                        # For bye round mode, prefer players higher in the list (better bye grading)
                        if best_second_player is None or (target_bye_round and second_player_candidates.index(second_player) < second_player_candidates.index(best_second_player)):
                            best_second_player = second_player
                        # In normal mode, take the first valid one
                        if not target_bye_round:
                            break

                if best_second_player:
                    total_price = first_player['Price'] + best_second_player['Price']
                    combo = create_combination([first_player, best_second_player], total_price, salary_freed)
                    valid_combinations.append(combo)
                    used_players.add(first_player['Player'])
                    used_players.add(best_second_player['Player'])
                    found_match = True
                
                if found_match and len(valid_combinations) >= max_options:
                    break
                    
        else:  # maximize_value - use Diff
            # For 2+ player trades, find combinations with highest total Diff
            for i in range(len(players)):
                if players[i]['Player'] in used_players:
                    continue

                first_player = players[i]

                # Find the best valid second player
                best_second_player = None
                best_total_diff = -1
                for j in range(len(players)):
                    if j == i or players[j]['Player'] in used_players:
                        continue

                    second_player = players[j]

                    # Check if the combination meets position requirements
                    position_valid = is_valid_trade_combo([first_player, second_player])

                    if not position_valid:
                        continue

                    total_price = first_player['Price'] + second_player['Price']
                    if total_price <= salary_freed:
                        total_diff = first_player['Diff'] + second_player['Diff']
                        # Choose the combination with highest total diff
                        if best_second_player is None or total_diff > best_total_diff:
                            best_second_player = second_player
                            best_total_diff = total_diff

                if best_second_player:
                    total_price = first_player['Price'] + best_second_player['Price']
                    combo = create_combination([first_player, best_second_player], total_price, salary_freed)
                    valid_combinations.append(combo)
                    used_players.add(first_player['Player'])
                    used_players.add(best_second_player['Player'])

                if len(valid_combinations) >= max_options:
                    break
    
    # Sort the final combinations before returning
    if maximize_base:
        valid_combinations.sort(key=lambda x: x['total_projection'], reverse=True)
    elif hybrid_approach:
        # For hybrid, combinations are already prioritized by player selection
        pass
    else:  # maximize_value
        valid_combinations.sort(key=lambda x: x['total_diff'], reverse=True)
    
    return valid_combinations[:max_options]


def calculate_trade_options(
    consolidated_data: pd.DataFrame,
    traded_out_players,
    maximize_base: bool = False,
    hybrid_approach: bool = False,
    max_options: int = 10,
    allowed_positions: List[str] = None,
    min_games: int = 2,
    team_list: List[str] = None,
    simulate_datetime: str = None,
    apply_lockout: bool = False,
    excluded_players: List[str] = None,
    cash_in_bank: int = 0,
    target_bye_round: bool = False,
    strategy: str = '1'
) -> List[Dict]:
    """
    Calculate trade options based on the selected strategy.

    Parameters:
    consolidated_data (pd.DataFrame): DataFrame containing all player data
    traded_out_players (List[str] or List[dict]): List of player names being traded out (can be abbreviated like "A. Fonua-Blake")
                                                 or list of player dicts with trade_in_positions
    maximize_base (bool): Whether to maximize base stats (Projection) instead of value (Diff)
    hybrid_approach (bool): Whether to use a hybrid approach combining value and base stats
    max_options (int): Maximum number of trade options to return
    allowed_positions (List[str]): List of positions to filter by (optional)
    min_games (int): Minimum number of games required for a player to be considered
    team_list (List[str]): Optional list of players to restrict trades to
    simulate_datetime (str): Optional datetime string for lockout simulation
    apply_lockout (bool): Whether to apply lockout restrictions
    excluded_players (List[str]): Optional list of players to exclude from trade options
    cash_in_bank (int): Additional cash to add to the salary freed up

    Returns:
    List[Dict]: List of trade option dictionaries
    """
    # Handle both string list and dict list formats
    if traded_out_players and isinstance(traded_out_players[0], dict):
        # New format: list of dicts with trade_in_positions
        full_traded_out_players = []
        for player_dict in traded_out_players:
            full_name = match_abbreviated_name_to_full(player_dict['name'], consolidated_data)
            # Create a new dict with the matched full name but preserve other fields
            full_player_dict = {**player_dict, 'name': full_name}
            full_traded_out_players.append(full_player_dict)
        print(f"Traded out players (dict format): {[p['name'] for p in full_traded_out_players]}")
    else:
        # Old format: list of strings
        full_traded_out_players = [
            match_abbreviated_name_to_full(name, consolidated_data)
            for name in traded_out_players
        ]
        print(f"Traded out players (original): {traded_out_players}")
        print(f"Traded out players (matched to full names): {full_traded_out_players}")
    
    # Get locked out players if lockout restriction is applied
    locked_out_players = set()
    if apply_lockout:
        locked_out_players = get_locked_out_players(simulate_datetime, consolidated_data)
    
    # Get positions that require coverage (only positional slots, not INT/EMG)
    traded_out_positions = get_traded_out_positions(full_traded_out_players, consolidated_data)
    positions_to_use = None
    
    latest_round = consolidated_data['Round'].max()
    
    # Get number of players needed based on traded out players
    num_players_needed = len(full_traded_out_players)
    
    # Calculate total salary freed up from traded out players
    salary_freed = cash_in_bank  # Start with cash in bank value
    traded_out_names = []

    if isinstance(full_traded_out_players[0], dict):
        # Dict format: extract names and prices
        for player_dict in full_traded_out_players:
            player_name = player_dict['name']
            traded_out_names.append(player_name)
            # Try to get price from the dict first, fallback to database
            price = player_dict.get('price')
            if price is None:
                player_data = consolidated_data[consolidated_data['Player'] == player_name].sort_values('Round', ascending=False)
                if not player_data.empty:
                    price = player_data.iloc[0]['Price']
                else:
                    print(f"Warning: Could not find price data for {player_name}")
                    price = 0
            salary_freed += price
    else:
        # String format: get prices from database
        traded_out_names = full_traded_out_players
        for player_name in traded_out_names:
            player_data = consolidated_data[consolidated_data['Player'] == player_name].sort_values('Round', ascending=False)
            if not player_data.empty:
                salary_freed += player_data.iloc[0]['Price']
            else:
                print(f"Warning: Could not find price data for {player_name}")

    print(f"Total salary freed up: ${salary_freed:,} (including ${cash_in_bank:,} cash in bank)")

    # Get all players from the latest round
    latest_round_data = consolidated_data[consolidated_data['Round'] == latest_round]
    available_players = latest_round_data[~latest_round_data['Player'].isin(traded_out_names)]

    # Filter out players with no projection value (not selected)
    # Only include players who have a valid projection (not null/zero)
    projection_mask = ~(
        pd.isna(available_players['Projection']) |
        (available_players['Projection'] == 0)
    )
    available_players = available_players[projection_mask]
    
    # Apply excluded players filter
    if excluded_players and len(excluded_players) > 0:
        available_players = available_players[~available_players['Player'].isin(excluded_players)]
        if available_players.empty:
            print("Warning: No players available after excluding selected players")
            return []
    
    # Apply team list restriction if enabled
    if team_list:
        available_players = available_players[available_players['Player'].isin(team_list)]
        if available_players.empty:
            print("Warning: No players available after applying team list restriction")
            return []
    
    # Apply lockout restriction if enabled
    if apply_lockout:
        available_players = available_players[~available_players['Player'].isin(locked_out_players)]
        if available_players.empty:
            print("Warning: No players available after applying lockout restriction")
            return []
    
    # Filter players by allowed positions if specified
    if positions_to_use:
        # Check both POS1 and POS2 for allowed positions
        mask = (
            available_players['POS1'].isin(positions_to_use) |
            available_players['POS2'].fillna('').isin(positions_to_use)
        )
        available_players = available_players[mask]
        if available_players.empty:
            print("Warning: No players available with selected positions")
            return []
    
    # Apply bye-round weighting if enabled (filtering happens inside helper)
    if target_bye_round:
        print(f"Applying bye-round weighting to {len(available_players)} candidates")
        candidates = []
        for _, row in available_players.iterrows():
            bye_grade = row.get('bye_round_grade')
            candidate_dict = row.to_dict()
            candidates.append({
                **candidate_dict,
                'name': candidate_dict.get('Player'),  # Ensure name key exists
                'diff': row.get('Diff', 0),
                'projection': row.get('Projection', 0),
                'bye_round_grade': bye_grade,
                'is_injured': row.get('is_injured', False),
                'non_playing': row.get('non_playing', False)
            })

        # For bye round mode, filter out players without valid bye_round_grade data
        if target_bye_round:
            original_count = len(candidates)
            candidates = [c for c in candidates if c.get('bye_round_grade') is not None and not pd.isna(c.get('bye_round_grade'))]
            print(f"Filtered out {original_count - len(candidates)} players without bye_round_grade data, {len(candidates)} remaining")

        weighted = apply_bye_weighting(candidates, mode="trade_in", strategy=strategy)
        print(f"After bye weighting, {len(weighted)} candidates remain, top 5: {[c.get('name') or c.get('Player') for c in weighted[:5]]}")
        # For bye round mode, use the weighted order directly instead of re-sorting in generate_trade_options
        available_players = pd.DataFrame(weighted)
        if available_players.empty:
            print("Warning: No players available after applying bye-round weighting")
            return []

    # Generate trade options based on the selected strategy
    options = generate_trade_options(
        available_players,
        salary_freed,
        maximize_base,
        hybrid_approach,
        max_options,
        traded_out_positions,
        num_players_needed,
        target_bye_round
    )
    
    return options[:max_options]


if __name__ == "__main__":
    try:
        consolidated_data = load_data()
        print(f"Successfully loaded data for {consolidated_data['Round'].nunique()} rounds")
        
        # Get user preference for optimization strategy first
        while True:
            strategy = input("\nDo you want to:\n1. Maximize value (Diff)\n2. Maximize base stats (Projection)\n3. Hybrid approach (Diff + Projection)\nEnter 1, 2, or 3: ")
            if strategy in ['1', '2', '3']:
                break
            print("Invalid input. Please enter 1, 2, or 3.")

        maximize_base = (strategy == '2')
        hybrid_approach = (strategy == '3')

        # Then get position preferences
        valid_positions = ['HOK', 'HLF', 'CTR', 'WFB', 'EDG', 'MID']
        while True:
            print("\nSelect positions to consider:")
            print("0. All positions")
            for i, pos in enumerate(valid_positions, 1):
                print(f"{i}. {pos}")
            
            try:
                pos1 = int(input("\nSelect first position (0-6): "))
                if pos1 < 0 or pos1 > 6:
                    raise ValueError
                
                if pos1 == 0:
                    allowed_positions = None
                    break
                
                pos2 = int(input("Select second position (1-6, or same as first position): "))
                if pos2 < 1 or pos2 > 6:
                    raise ValueError
                
                allowed_positions = [valid_positions[pos1-1]]
                if pos1 != pos2:
                    allowed_positions.append(valid_positions[pos2-1])
                break
            except ValueError:
                print("Invalid input. Please enter valid numbers.")
        
        # Get players to trade out
        player1 = input("\nEnter first player to trade out: ")
        player2 = input("Enter second player to trade out (leave blank for single player trade): ")
        
        traded_out_players = [player1]
        if player2:
            traded_out_players.append(player2)
        
        # Get lockout and simulation date/time preferences
        apply_lockout = input("Apply lockout restriction? (yes/no): ").strip().lower() == 'yes'
        simulate_datetime = None
        if apply_lockout:
            simulate_datetime = input("Enter simulated date/time (YYYY-MM-DDTHH:MM): ").strip()
        
        print(f"\nCalculating trade options for trading out: {', '.join(traded_out_players)}")
        print(f"Strategy: {'Maximizing base stats (Projection)' if maximize_base else 'Maximizing value (Diff)' if not hybrid_approach else 'Hybrid approach (Diff + Projection)'}")
        if allowed_positions:
            print(f"Considering only positions: {', '.join(allowed_positions)}")
        else:
            print("Considering all positions")
        
        options = calculate_trade_options(
            consolidated_data,
            traded_out_players,
            maximize_base=maximize_base,
            hybrid_approach=hybrid_approach,
            max_options=10,
            allowed_positions=allowed_positions,
            simulate_datetime=simulate_datetime,
            apply_lockout=apply_lockout
        )
        
        if options:
            print("\n=== Recommended Trade Combinations ===\n")
            for i, option in enumerate(options, 1):
                print(f"\nOption {i}")
                print("Players to trade in:")
                for player in option['players']:
                    if maximize_base:
                        print(f"- {player['name']} ({player['position']})")
                        print(f"  Team: {player['team']}")
                        print(f"  Price: ${player['price']:,}")
                        print(f"  Projected score: {player['projection']:.1f}")
                    else:
                        print(f"- {player['name']} ({player['position']})")
                        print(f"  Team: {player['team']}")
                        print(f"  Price: ${player['price']:,}")
                        print(f"  Upside: {player['diff']:.1f}")
                
                print(f"Total Price: ${option['total_price']:,}")
                if maximize_base:
                    print(f"Combined Projected score: {option['total_projection']:.1f}")
                else:
                    print(f"Combined Upside: {option['total_diff']:.1f}")
                print(f"Salary Remaining: ${option['salary_remaining']:,}")
            
    except FileNotFoundError:
        print("Error: Could not find data file in the current directory")
    except ValueError as e:
        print("Error:", str(e))
    except Exception as e:
        print("An error occurred:", str(e))