from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_caching import Cache
from flask_cors import CORS

# Handle imports for both local development and Heroku deployment
try:
    # Try relative imports first (for Heroku deployment)
    from .nrl_trade_calculator import calculate_trade_options, load_data, is_player_locked
    from .trade_recommendations import calculate_combined_trade_recommendations
except ImportError:
    # Fall back to absolute imports (for local development)
    from nrl_trade_calculator import calculate_trade_options, load_data, is_player_locked
    from trade_recommendations import calculate_combined_trade_recommendations
from typing import List, Dict, Any
import traceback
import pandas as pd
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import time
from datetime import datetime, timedelta

# Load environment variables from project root
# This allows the .env file to be at the project root instead of in the subdirectory
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Enable CORS for React frontend (local development and production)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "https://fantasytradecalc.com",
            "https://www.fantasytradecalc.com",
            "https://nrl-trade-calculator.herokuapp.com"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Add cache-busting headers for static assets to prevent serving stale JavaScript
@app.after_request
def add_header(response):
    """Add headers to prevent caching during development"""
    if 'Cache-Control' not in response.headers:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
    return response

# Configure cache
cache = Cache(config={'CACHE_TYPE': 'SimpleCache'})
cache.init_app(app)
CACHE_TIMEOUT = 300  # 5 minutes cache


_cached_data = None
_last_cache_time = 0

def prepare_trade_option(option: Dict[str, Any]) -> Dict[str, Any]:
    """
    Prepare trade option for JSON response with the new data structure.
    """
    players = []
    total_price = int(option.get('total_price', 0))
    
    # Precompute player data
    for player in option.get('players', []):
        p = {
            'name': player.get('name', ''),
            'position': player.get('position', ''),
            'team': player.get('team', ''),
            'price': int(player['price'])
        }
        
        # Add diff or projection based on what's available
        if 'diff' in player:
            p['diff'] = float(player['diff'])
        if 'projection' in player:
            p['projection'] = float(player['projection'])
            
        players.append(p)

    result = {
        'players': players,
        'total_price': total_price,
        'salary_remaining': int(option['salary_remaining'])
    }
    
    # Add total metrics based on what's available
    if 'total_diff' in option:
        result['total_diff'] = float(option['total_diff'])
    if 'total_projection' in option:
        result['total_projection'] = float(option['total_projection'])
        
    return result

@app.route('/')
def index():
    """Serve the React frontend"""
    return send_from_directory('static/react', 'index.html')

@app.route('/legacy')
def legacy_index():
    """Legacy route - serves the old jQuery-based frontend"""
    hotjar_id = os.getenv('HOTJAR_ID')
    return render_template('index.html', hotjar_id=hotjar_id)

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve React static assets (JS, CSS, images)"""
    return send_from_directory('static/react/assets', filename)

@app.route('/vite.svg')
def serve_vite_icon():
    """Serve the Vite favicon"""
    return send_from_directory('static/react', 'vite.svg')

@app.route('/check_player_lockout', methods=['POST'])
def check_player_lockout():
    try:
        player_name = request.form['player_name']
        
        # Get standardized time from user's local time
        user_local_time = request.form.get('userLocalTime')
        user_timezone_offset = request.form.get('userTimezone')
        simulate_datetime = standardize_user_time(user_local_time, user_timezone_offset)
        
        # Use cached data
        consolidated_data = cached_load_data()
        
        is_locked = is_player_locked(player_name, consolidated_data, simulate_datetime)
        
        return jsonify({'is_locked': is_locked})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Added cached data loading
@cache.cached(timeout=CACHE_TIMEOUT, key_prefix='load_data')
def cached_load_data():
    """
    Load data from database with caching to improve performance.
    """
    global _cached_data
    global _last_cache_time
    
    # Check if we need to refresh the cache (every 15 minutes)
    current_time = time.time()
    cache_age = current_time - _last_cache_time if _last_cache_time else float('inf')
    print(f"Cache check: _cached_data is None: {_cached_data is None}, cache_age: {cache_age:.1f} seconds")

    # Force refresh for debugging
    print("Force refreshing cache for debugging...")
    try:
        _cached_data = load_data()
        _last_cache_time = current_time
        app.logger.info(f"Data cache refreshed with {len(_cached_data)} records")
    except Exception as e:
            app.logger.error(f"Error refreshing data cache: {str(e)}")
            # If we have cached data, use it even if it's stale
            if _cached_data is not None:
                app.logger.warning("Using stale cached data due to refresh error")
            else:
                # No cached data available, must raise the error
                raise
    
    return _cached_data

def simulate_rule_levels(consolidated_data: pd.DataFrame, rounds: List[int]) -> None:
    # Existing implementation unchanged
    player_name = consolidated_data['Player'].unique()[0]

    rule_descriptions = {
        1: "BPRE >= 14 for last 3 weeks",
        
        25: "No rules satisfied"
    }

    for round_num in rounds:
        recent_rounds = sorted(consolidated_data['Round'].unique())
        recent_rounds = [r for r in recent_rounds if r <= round_num][-4:]
        cumulative_data = consolidated_data[consolidated_data['Round'].isin(recent_rounds)]
        player_data = cumulative_data[cumulative_data['Player'] == player_name]
        
        if player_data.empty:
            print(f"Round {round_num}: No data for player {player_name}")
            continue
        
        priority_level = assign_priority_level(player_data.iloc[-1], cumulative_data)
        rule_description = rule_descriptions.get(priority_level, "Unknown rule")
        print(f"Rule levels passed as at round {round_num}: Rule Level Satisfied: {priority_level} - {rule_description}")

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        # Extract form data first before any processing
        form_data = {
            'player1': request.form['player1'],
            'player2': request.form.get('player2'),
            'strategy': request.form['strategy'],
            'tradeType': request.form['tradeType'],
            'positions': request.form.getlist('positions') if request.form['tradeType'] == 'positionalSwap' else [],
            'restrictToTeamList': 'restrictToTeamList' in request.form,
            'applyLockout': 'applyLockout' in request.form,
            'excludedPlayers': request.form.getlist('excludedPlayers'),
            'cashInBank': int(request.form.get('cashInBank', 0))
        }
        
        # Get user time information if lockout is applied
        simulate_datetime = None
        if form_data['applyLockout']:
            user_local_time = request.form.get('userLocalTime')
            user_timezone_offset = request.form.get('userTimezone')
            simulate_datetime = standardize_user_time(user_local_time, user_timezone_offset)
            
            # If valid time not found, return an error
            if not simulate_datetime:
                return jsonify({
                    'error': "Could not determine your current time. Please try again."
                }), 400
                
            app.logger.info(f"Using standardized time for lockout: {simulate_datetime}")
        
        # Use cached data load
        consolidated_data = cached_load_data()

        # Early validation for required players
        traded_out_players = [form_data['player1']]
        if form_data['player2']:
            traded_out_players.append(form_data['player2'])

        # Validate lockout status first to avoid unnecessary processing
        if form_data['applyLockout']:
            locked_players = []
            for player in traded_out_players:
                if is_player_locked(player, consolidated_data, simulate_datetime):
                    locked_players.append(player)
            
            if locked_players:
                return jsonify({
                    'error': f"{' and '.join(locked_players)}'s lockout has expired"
                }), 400

        # Load team list if needed
        team_list = None
        if form_data['restrictToTeamList']:
            team_list_path = "teamlists.csv"
            team_df = pd.read_csv(team_list_path)
            team_list = team_df['Player'].unique().tolist()

        # Strategy flags
        strategy = form_data['strategy']
        maximize_base = (strategy == '2')
        hybrid_approach = (strategy == '3')

        # Calculate trade options
        options = calculate_trade_options(
            consolidated_data,
            traded_out_players,
            maximize_base=maximize_base,
            hybrid_approach=hybrid_approach,
            max_options=10,
            allowed_positions=form_data['positions'] if form_data['positions'] else None,
            team_list=team_list,
            simulate_datetime=simulate_datetime,
            apply_lockout=form_data['applyLockout'],
            excluded_players=form_data['excludedPlayers'],
            cash_in_bank=form_data['cashInBank']  # Pass the cash in bank value
        )

        # Format options for frontend
        formatted_options = []
        for option in options:
            formatted_option = {
                'players': [],
                'totalPrice': option['total_price'],
                'salaryRemaining': option['salary_remaining']
            }
            
            if maximize_base:
                formatted_option['totalProjection'] = option['total_projection']
            else:
                formatted_option['totalDiff'] = option['total_diff']
                
            for player in option['players']:
                # Check if the player has a secondary position that isn't None or empty
                position_display = player['position']
                if player.get('secondary_position') and pd.notna(player.get('secondary_position')):
                    position_display = f"{player['position']}/{player['secondary_position']}"
                
                player_info = {
                    'name': player['name'],
                    'team': player['team'],
                    'position': position_display,
                    'price': player['price']
                }
                
                if maximize_base:
                    player_info['projection'] = player['projection']
                else:
                    player_info['diff'] = player['diff']
                    
                formatted_option['players'].append(player_info)
            
            formatted_options.append(formatted_option)
        
        # Return the array directly to match what the frontend expects
        return jsonify(formatted_options)
        
    except Exception as e:
        # Log the error for debugging
        app.logger.error(f"Error in calculate: {str(e)}")
        return jsonify({
            'error': f"An error occurred: {str(e)}"
        }), 500

@app.route('/players', methods=['GET'])
def get_players():
    try:
        # Use cached data
        consolidated_data = cached_load_data()
        player_names = consolidated_data['Player'].unique().tolist()
        return jsonify(player_names)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_player_names_with_prices', methods=['GET'])
def get_player_names_with_prices():
    try:
        # Load data
        consolidated_data = cached_load_data()
        
        # Get latest round data
        latest_round = consolidated_data['Round'].max()
        latest_data = consolidated_data[consolidated_data['Round'] == latest_round]
        
        # Create list of players with prices
        player_data = []
        for _, row in latest_data.iterrows():
            player_data.append({
                'label': row['Player'],
                'value': row['Player'],
                'price': str(int(row['Price'] / 1000))  # Convert to k format
            })
        
        return jsonify(player_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_player_validation_list', methods=['GET'])
def get_player_validation_list():
    """
    Return all player names with their abbreviated forms for OCR validation.
    This allows the frontend to filter out false positives from OCR extraction.
    
    Returns a list of objects with:
    - fullName: The full player name (e.g., "Addin Fonua-Blake")
    - abbreviatedName: The abbreviated form (e.g., "A. Fonua-Blake")
    - surname: Just the surname for fuzzy matching (e.g., "Fonua-Blake")
    - initial: The first name initial (e.g., "A")
    - positions: Array of positions the player can play (e.g., ["MID", "EDG"])
    """
    try:
        consolidated_data = cached_load_data()
        
        # Get unique player names from the latest round
        latest_round = consolidated_data['Round'].max()
        latest_data = consolidated_data[consolidated_data['Round'] == latest_round]
        
        validation_list = []
        for _, row in latest_data.iterrows():
            player_name = row['Player']
            parts = player_name.split(' ', 1)
            if len(parts) == 2:
                first_name, surname = parts
                initial = first_name[0].upper()
                abbreviated = f"{initial}. {surname}"
            else:
                # Single name (rare case)
                first_name = player_name
                surname = player_name
                initial = player_name[0].upper() if player_name else ''
                abbreviated = player_name
            
            # Get positions - primary and secondary
            positions = []
            if 'POS1' in row and pd.notna(row['POS1']):
                positions.append(row['POS1'])
            if 'POS2' in row and pd.notna(row['POS2']):
                positions.append(row['POS2'])
            
            validation_list.append({
                'fullName': player_name,
                'abbreviatedName': abbreviated,
                'surname': surname.lower(),
                'initial': initial.lower(),
                'positions': positions
            })
        
        app.logger.info(f"Returning {len(validation_list)} players for OCR validation (with positions)")
        return jsonify(validation_list)
    except Exception as e:
        app.logger.error(f"Error in get_player_validation_list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/calculate_team_trades', methods=['POST'])
def calculate_team_trades():
    """
    Calculate trade recommendations based on the user's team extracted from screenshots.
    Recommends players to trade out (injured + low upside) and players to trade in.
    """
    try:
        # Extract JSON data
        data = request.get_json()
        
        team_players = data.get('team_players', [])
        cash_in_bank = int(data.get('cash_in_bank', 0))
        strategy = data.get('strategy', '3')  # Default to hybrid
        num_trades = int(data.get('num_trades', 2))
        allowed_positions = data.get('allowed_positions', None)
        simulate_datetime = data.get('simulate_datetime', None)
        apply_lockout = data.get('apply_lockout', False)
        excluded_players = data.get('excluded_players', None)
        target_bye_round = bool(data.get('target_bye_round', False))
        preseason_mode = bool(data.get('preseason_mode', False))
        preselected_trade_outs = data.get('preselected_trade_outs', None)


        # Validate team_players
        if not team_players or len(team_players) == 0:
            return jsonify({'error': 'No team players provided'}), 400
        
        # Load data
        consolidated_data = cached_load_data()
        
        # Calculate recommendations (injury status is now determined from the Injured column in the database)
        recommendations = calculate_combined_trade_recommendations(
            team_players=team_players,
            cash_in_bank=cash_in_bank,
            consolidated_data=consolidated_data,
            strategy=strategy,
            num_trades=num_trades,
            allowed_positions=allowed_positions,
            simulate_datetime=simulate_datetime,
            apply_lockout=apply_lockout,
            excluded_players=excluded_players,
            target_bye_round=target_bye_round,
            preseason_mode=preseason_mode,
            preselected_trade_outs=preselected_trade_outs
        )
        
        # Format trade-out recommendations for frontend
        formatted_trade_out = []
        for player in recommendations['trade_out']:
            formatted_trade_out.append({
                'name': player['name'],
                'positions': player['positions'],
                'price': player['price'],
                'reason': player.get('reason', 'user_selected'),  # Default to 'user_selected' for pre-selected players
                'diff': player.get('diff')
            })
        
        # Format trade-in recommendations for frontend (same format as existing /calculate endpoint)
        formatted_trade_in = []
        for option in recommendations['trade_in']:
            formatted_option = {
                'players': [],
                'totalPrice': option['total_price'],
                'salaryRemaining': option['salary_remaining']
            }
            
            if strategy == '2':
                formatted_option['totalProjection'] = option['total_projection']
            else:
                formatted_option['totalDiff'] = option['total_diff']
            
            for player in option['players']:
                position_display = player['position']
                if player.get('secondary_position') and pd.notna(player.get('secondary_position')):
                    position_display = f"{player['position']}/{player['secondary_position']}"
                
                bye_grade = player.get('bye_round_grade')
                print(f"Player {player.get('name')}: bye_round_grade = {bye_grade}")
                player_info = {
                    'name': player['name'],
                    'team': player['team'],
                    'position': position_display,
                    'price': player['price'],
                    'bye_round_grade': bye_grade
                }

                if strategy == '2':
                    player_info['projection'] = player['projection']
                else:
                    player_info['diff'] = player['diff']
                
                formatted_option['players'].append(player_info)
            
            formatted_trade_in.append(formatted_option)
        
        return jsonify({
            'trade_out': formatted_trade_out,
            'trade_in': formatted_trade_in,
            'total_salary_freed': recommendations['total_salary_freed']
        })
        
    except Exception as e:
        app.logger.error(f"Error in calculate_team_trades: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'error': f"An error occurred: {str(e)}"
        }), 500


@app.route('/check_injured_players', methods=['POST'])
def check_injured_players():
    """
    Check which players from the user's team are injured.
    Returns a list of injured player names for display purposes.
    """
    try:
        try:
            from .trade_recommendations import identify_injured_players
        except ImportError:
            from trade_recommendations import identify_injured_players
        
        # Extract JSON data
        data = request.get_json()
        team_players = data.get('team_players', [])
        
        if not team_players:
            return jsonify({'injured_players': []})
        
        # Load data
        consolidated_data = cached_load_data()
        
        # Get injured players
        injured = identify_injured_players(team_players, consolidated_data)
        
        # Return just the names for the frontend to match against
        injured_names = [p['name'] for p in injured]
        
        return jsonify({
            'injured_players': injured_names
        })
        
    except Exception as e:
        app.logger.error(f"Error in check_injured_players: {str(e)}")
        return jsonify({'error': str(e), 'injured_players': []}), 500


@app.route('/lookup_player_prices', methods=['POST'])
def lookup_player_prices():
    """
    Look up prices for players from the database.
    Used for Format 2 screenshots where prices aren't visible in the OCR text.
    """
    try:
        try:
            from .trade_recommendations import fill_missing_prices
        except ImportError:
            from trade_recommendations import fill_missing_prices
        
        # Extract JSON data
        data = request.get_json()
        team_players = data.get('team_players', [])
        
        if not team_players:
            return jsonify({'players': []})
        
        # Load data
        consolidated_data = cached_load_data()
        
        # Fill in missing prices from database
        players_with_prices = fill_missing_prices(team_players, consolidated_data)
        
        return jsonify({
            'players': players_with_prices
        })
        
    except Exception as e:
        app.logger.error(f"Error in lookup_player_prices: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e), 'players': []}), 500


@app.route('/analyze_team_status', methods=['POST'])
def analyze_team_status():
    """
    Analyze team status - returns injured players, overvalued players (by threshold), and not selected players.
    This is used to front-load the analysis and display indicators on the My Team screen.
    
    Overvalued categories (based on Diff value):
    - urgent_overvalued: Diff <= -7 (very overvalued, losing lots of money)
    - overvalued: -7 < Diff <= -1 (moderately overvalued)
    """
    try:
        try:
            from .trade_recommendations import identify_injured_players, identify_overvalued_players_by_threshold, identify_junk_cheapies
        except ImportError:
            from trade_recommendations import identify_injured_players, identify_overvalued_players_by_threshold, identify_junk_cheapies

        # Extract JSON data
        data = request.get_json()
        team_players = data.get('team_players', [])

        app.logger.info(f"analyze_team_status called with {len(team_players)} players")

        if not team_players:
            return jsonify({
                'injured_players': [],
                'urgent_overvalued_players': [],
                'overvalued_players': [],
                'not_selected_players': []
            })

        # Load data
        app.logger.info("Loading consolidated data...")
        consolidated_data = cached_load_data()
        app.logger.info(f"Loaded {len(consolidated_data)} records")

        # Get injured players
        injured = identify_injured_players(team_players, consolidated_data)
        injured_names = [p['name'] for p in injured]

        # Get overvalued players by threshold (excluding injured ones)
        overvalued_result = identify_overvalued_players_by_threshold(
            team_players,
            consolidated_data,
            exclude_names=injured_names
        )
        urgent_overvalued_names = [p['name'] for p in overvalued_result['urgent_overvalued']]
        overvalued_names = [p['name'] for p in overvalued_result['overvalued']]

        # Get junk cheapies (excluding injured and all overvalued players)
        excluded_names = injured_names + urgent_overvalued_names + overvalued_names
        junk_cheapies = identify_junk_cheapies(
            team_players,
            consolidated_data,
            exclude_names=excluded_names
        )
        junk_cheapies_names = [p['name'] for p in junk_cheapies]

        # Get players without projection values (not selected)
        not_selected_names = []
        app.logger.info(f"Checking {len(team_players)} team players against {len(consolidated_data)} database players")

        for team_player in team_players:
            app.logger.info(f"Checking team player: '{team_player['name']}'")

            # Try to match the player name using multiple strategies
            matched_player = None

            # Strategy 1: Exact case-insensitive match
            player_matches = consolidated_data[
                consolidated_data['Player'].str.lower() == team_player['name'].lower()
            ]
            app.logger.info(f"Found {len(player_matches)} exact matches for '{team_player['name']}'")

            if not player_matches.empty:
                matched_player = player_matches.iloc[0]['Player']
            else:
                # Strategy 2: Try to expand abbreviated name using existing function
                try:
                    try:
                        from .nrl_trade_calculator import match_abbreviated_name_to_full
                    except ImportError:
                        from nrl_trade_calculator import match_abbreviated_name_to_full
                    full_name = match_abbreviated_name_to_full(team_player['name'], consolidated_data)
                    if full_name != team_player['name']:
                        app.logger.info(f"Expanded '{team_player['name']}' to '{full_name}'")
                        expanded_matches = consolidated_data[
                            consolidated_data['Player'].str.lower() == full_name.lower()
                        ]
                        if not expanded_matches.empty:
                            matched_player = expanded_matches.iloc[0]['Player']
                            app.logger.info(f"Found match using expanded name: '{matched_player}'")
                except Exception as e:
                    app.logger.error(f"Error using name expansion: {e}")

            # Strategy 3: Partial surname matching
            if not matched_player:
                name_parts = team_player['name'].replace('.', ' ').split()
                if len(name_parts) >= 2:
                    surname = name_parts[-1].strip()
                    partial_matches = consolidated_data[
                        consolidated_data['Player'].str.lower().str.contains(surname.lower())
                    ]
                    if len(partial_matches) > 0:
                        matched_player = partial_matches.iloc[0]['Player']
                        app.logger.info(f"Found partial match for surname '{surname}': '{matched_player}'")

            if matched_player:
                # Get data for the matched player
                player_data = consolidated_data[consolidated_data['Player'] == matched_player]
                latest_round = player_data['Round'].max()
                latest_data = player_data[player_data['Round'] == latest_round]

                app.logger.info(f"Latest round for matched player '{matched_player}': {latest_round}")

                if not latest_data.empty:
                    # Check if projection value exists and is not null/zero
                    projection_value = latest_data['Projection'].iloc[0]
                    app.logger.info(f"Projection value for '{matched_player}': {projection_value} (type: {type(projection_value)})")

                    # Check if projection is missing/null/zero
                    if pd.isna(projection_value) or (isinstance(projection_value, (int, float)) and projection_value == 0):
                        app.logger.info(f"Adding '{team_player['name']}' to not_selected_players (matched to '{matched_player}')")
                        not_selected_names.append(team_player['name'])
                    else:
                        app.logger.info(f"Player '{matched_player}' has valid projection: {projection_value}")
                else:
                    app.logger.info(f"No latest round data found for '{matched_player}'")
                    not_selected_names.append(team_player['name'])
            else:
                app.logger.info(f"No matches found for '{team_player['name']}' - adding to not_selected_players")
                not_selected_names.append(team_player['name'])

        return jsonify({
            'injured_players': injured_names,
            'urgent_overvalued_players': urgent_overvalued_names,
            'overvalued_players': overvalued_names,
            'not_selected_players': not_selected_names,
            'junk_cheapies': junk_cheapies_names
        })

    except Exception as e:
        app.logger.error(f"Error in analyze_team_status: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'error': str(e),
            'injured_players': [],
            'urgent_overvalued_players': [],
            'overvalued_players': [],
            'not_selected_players': []
        }), 500


@app.route('/calculate_preseason_trade_ins', methods=['POST'])
def calculate_preseason_trade_ins():
    """
    Calculate individual trade-in recommendations for pre-season mode.
    Returns a flat list of players (not pairs) filtered by positions and salary cap.
    
    When test_approach is True, recommendations are filtered by price bands:
    - Each trade-out player creates a price band of ±$75k around their price
    - Trade-in candidates must fall within one of these price bands
    """
    try:
        # Import the function
        try:
            from .trade_recommendations import calculate_preseason_trade_in_candidates
        except ImportError:
            from trade_recommendations import calculate_preseason_trade_in_candidates
        
        # Extract JSON data
        data = request.get_json()
        
        team_players = data.get('team_players', [])
        trade_out_players = data.get('trade_out_players', [])
        salary_cap = int(data.get('salary_cap', 0))
        strategy = data.get('strategy', '1')
        positions = data.get('positions', [])
        target_bye_round = bool(data.get('target_bye_round', False))
        test_approach = bool(data.get('test_approach', False))

        app.logger.info(f"Preseason trade-ins request - test_approach: {test_approach}, positions: {positions}, trade_out_players: {len(trade_out_players)}")
        
        # Validate inputs
        if not trade_out_players or len(trade_out_players) == 0:
            return jsonify({'error': 'No trade-out players provided'}), 400
        
        # Load data (injury status is now determined from the Injured column in the database)
        consolidated_data = cached_load_data()

        # Get team player names for exclusion - convert abbreviated names to full names
        # to match database format
        from nrl_trade_calculator import match_abbreviated_name_to_full
        team_player_full_names = []
        for p in team_players:
            full_name = match_abbreviated_name_to_full(p['name'], consolidated_data)
            team_player_full_names.append(full_name)

        trade_out_full_names = []
        for p in trade_out_players:
            full_name = match_abbreviated_name_to_full(p['name'], consolidated_data)
            trade_out_full_names.append(full_name)

        excluded_names = team_player_full_names + trade_out_full_names
        
        # Calculate individual trade-in candidates
        trade_ins = calculate_preseason_trade_in_candidates(
            consolidated_data=consolidated_data,
            salary_cap=salary_cap,
            positions=positions,
            strategy=strategy,
            excluded_players=excluded_names,
            target_bye_round=target_bye_round,
            max_results=100 if test_approach else 50,  # Return more candidates for test approach
            test_approach=test_approach,
            trade_out_players=trade_out_players  # Pass trade-out players for price band calculation
        )
        
        # Format for frontend
        formatted_trade_ins = []
        for player in trade_ins:
            formatted_player = {
                'name': player['name'],
                'position': player['position'],
                'positions': player.get('positions', [player['position']]),
                'team': player.get('team', ''),
                'price': player['price'],
                'diff': player.get('diff', 0),
                'projection': player.get('projection', 0)
            }
            # Include matching bands info for test approach
            if test_approach and 'matching_bands' in player:
                formatted_player['matching_bands'] = player['matching_bands']
            formatted_trade_ins.append(formatted_player)
        
        return jsonify({
            'trade_ins': formatted_trade_ins,
            'salary_cap': salary_cap,
            'test_approach': test_approach
        })
        
    except Exception as e:
        app.logger.error(f"Error in calculate_preseason_trade_ins: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'error': f"An error occurred: {str(e)}"
        }), 500


def init_app(app):
    try:
        with app.app_context():
            # Check if in development environment
            is_development = os.getenv('FLASK_ENV') == 'development'
            
            if is_development:
                db_params = {
                    'host': os.getenv('DB_HOST'),
                    'database': os.getenv('DB_DATABASE'),
                    'user': os.getenv('DB_USER'),
                    'password': os.getenv('DB_PASSWORD'),
                    'port': os.getenv('DB_PORT')
                }
                conn_str = f"postgresql://{db_params['user']}:{db_params['password']}@{db_params['host']}:{db_params['port']}/{db_params['database']}"
            else:
                database_url = os.getenv("DATABASE_URL")
                if database_url:
                    if database_url.startswith("postgres://"):
                        database_url = database_url.replace("postgres://", "postgresql://", 1)
                    conn_str = database_url
                else:
                    raise ValueError("DATABASE_URL not found in production environment")
            
            engine = create_engine(conn_str)
            
            with engine.connect() as connection:
                # Check if table exists
                result = connection.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'player_stats'
                    );
                """))
                table_exists = result.scalar()
                
                if not table_exists:
                    # Initialize database
                    init_heroku_database()
    except Exception as e:
        print(f"Error checking/initializing database: {str(e)}")
        raise

# Initialize the database when the app starts
init_app(app)

def standardize_user_time(user_local_time, user_timezone_offset):
    """
    Convert user's local time to a standardized time (AEDT/AEST) for fixture comparisons.
    
    Parameters:
    user_local_time (str): ISO format timestamp from client
    user_timezone_offset (int): Minutes offset from UTC
    
    Returns:
    str: Standardized datetime string in format 'YYYY-MM-DDTHH:MM'
    """
    if not user_local_time or user_timezone_offset is None:
        return None
        
    try:
        # Parse the user's local time
        user_dt = datetime.fromisoformat(user_local_time.replace('Z', '+00:00'))
        
        # Calculate the user's UTC time by applying their timezone offset
        # Timezone offset from JavaScript is in minutes (negative for east of UTC)
        user_utc = user_dt + timedelta(minutes=int(user_timezone_offset))
        
        # AEDT is UTC+11, AEST is UTC+10
        # For simplicity, we're using AEDT (UTC+11) as our standard
        # In a production app, you'd want to handle DST switches
        aest_offset = timedelta(hours=11)  # Using AEDT (UTC+11)
        standardized_time = user_utc + aest_offset
        
        # Return in the format expected by the lockout functions
        return standardized_time.strftime('%Y-%m-%dT%H:%M')
        
    except Exception as e:
        app.logger.error(f"Error standardizing user time: {str(e)}")
        return None

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5002, debug=True)
    try:
        while True:
            choice = input("\nDo you want to:\n1. Run the ordinary trade calculator\n2. Run rule set simulation for 1 player\nEnter 1 or 2: ")
            if choice in ['1', '2']:
                break
            print("Invalid input. Please enter 1 or 2.")

        # Use cached data load
        consolidated_data = cached_load_data()
        
        if consolidated_data.empty:
            raise ValueError("No data loaded from database")
            
        print(f"Successfully loaded data for {consolidated_data['Round'].nunique()} rounds")

        if choice == '2':
            player_name = input("Enter player name for simulation: ")
            if player_name not in consolidated_data['Player'].unique():
                raise ValueError(f"Player {player_name} not found in database")
            
            player_data = consolidated_data[consolidated_data['Player'] == player_name]
            rounds = list(range(1, int(consolidated_data['Round'].max()) + 1))
            simulate_rule_levels(player_data, rounds)
        else:
            app.run(debug=True)

    except ValueError as e:
        print("Error:", str(e))
    except Exception as e:
        print("An error occurred:", str(e))
        raise