import pandas as pd
from typing import List, Dict, Tuple
from nrl_trade_calculator import calculate_trade_options, match_abbreviated_name_to_full
from bye_analyser import apply_bye_weighting


def identify_injured_players(team_players: List[Dict], consolidated_data: pd.DataFrame) -> List[Dict]:
    """
    Identify players from the user's team who have Injured=TRUE in the database.
    
    Parameters:
    team_players (List[Dict]): List of player dictionaries with 'name', 'positions', 'price'
    consolidated_data (pd.DataFrame): DataFrame containing player data with Injured column
    
    Returns:
    List[Dict]: List of injured players from the team
    """
    # Get the latest round data
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round]
    
    # Get team player names for lookup - match abbreviated names to full names
    team_player_names = {p['name'] for p in team_players}
    
    # Debug: print what we're working with
    print(f"Team players (original): {team_player_names}")
    print(f"Latest round: {latest_round}")
    
    # Get players marked as injured in the database
    injured_in_db = set()
    if 'Injured' in latest_data.columns:
        # Debug: check the Injured column values
        print(f"Injured column dtype: {latest_data['Injured'].dtype}")
        print(f"Injured column unique values: {latest_data['Injured'].unique()}")
        
        # Use boolean comparison that handles various formats
        # Convert to bool explicitly to handle any edge cases
        injured_mask = latest_data['Injured'].apply(lambda x: bool(x) if pd.notna(x) else False)
        injured_in_db = set(latest_data[injured_mask]['Player'].unique())
        print(f"Injured players in DB: {injured_in_db}")
    else:
        print("No 'Injured' column found in data")
    
    injured_players = []
    for player in team_players:
        player_name = player['name']
        # Match abbreviated name (e.g., "E. Clark") to full name (e.g., "Erin Clark")
        full_name = match_abbreviated_name_to_full(player_name, consolidated_data)
        print(f"Matching: '{player_name}' -> '{full_name}'")
        
        if full_name in injured_in_db:
            # Store with full name for consistency
            injured_player = player.copy()
            injured_player['matched_name'] = full_name
            injured_players.append(injured_player)
            print(f"Found injured player in team: {player_name} (matched to {full_name})")
    
    print(f"Total injured players found in team: {len(injured_players)}")
    return injured_players


def identify_low_upside_players(
    team_players: List[Dict], 
    consolidated_data: pd.DataFrame, 
    count: int = 2,
    exclude_names: List[str] = None
) -> List[Dict]:
    """
    Identify players from the user's team who have the lowest Diff (least upside/most overvalued).
    
    Parameters:
    team_players (List[Dict]): List of player dictionaries with 'name', 'positions', 'price'
    consolidated_data (pd.DataFrame): DataFrame containing player data with Diff column
    count (int): Number of low-upside players to identify
    exclude_names (List[str]): Names to exclude (e.g., already identified injured players)
    
    Returns:
    List[Dict]: List of low-upside players from the team
    """
    if not team_players:
        return []
    
    # Get the latest round data
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round].copy()
    
    # Build a mapping from abbreviated names to full names
    name_mapping = {}  # abbreviated -> full
    reverse_mapping = {}  # full -> abbreviated
    for player in team_players:
        abbrev_name = player['name']
        full_name = match_abbreviated_name_to_full(abbrev_name, consolidated_data)
        name_mapping[abbrev_name] = full_name
        reverse_mapping[full_name] = abbrev_name
    
    # Get the set of full names for DB lookups
    full_names_set = set(name_mapping.values())
    
    # Get excluded full names
    excluded_full_names = set()
    if exclude_names:
        for name in exclude_names:
            full_name = match_abbreviated_name_to_full(name, consolidated_data)
            excluded_full_names.add(full_name)
    
    # Filter to only team players and exclude specified names
    team_data = latest_data[latest_data['Player'].isin(full_names_set)]
    team_data = team_data[~team_data['Player'].isin(excluded_full_names)]
    
    # Convert Diff to numeric
    team_data = team_data.copy()
    team_data['Diff'] = pd.to_numeric(team_data['Diff'], errors='coerce').fillna(0)
    
    # Sort by Diff ascending (lowest upside = most overvalued)
    team_data_sorted = team_data.sort_values('Diff', ascending=True)
    
    # Build result list
    low_upside_players = []
    for _, row in team_data_sorted.head(count).iterrows():
        full_name = row['Player']
        abbrev_name = reverse_mapping.get(full_name, full_name)
        
        # Find the original player data to get the price
        original_player = next((p for p in team_players if p['name'] == abbrev_name), None)
        
        low_upside_players.append({
            'name': abbrev_name,  # Use abbreviated name for display
            'positions': [row['POS1']] + ([row['POS2']] if pd.notna(row.get('POS2')) else []),
            'price': original_player.get('price', 0) if original_player else int(row['Price']),
            'diff': float(row['Diff'])
        })
    
    print(f"Low-upside players identified: {[p['name'] for p in low_upside_players]}")
    return low_upside_players


def identify_junk_cheapies(
    team_players: List[Dict],
    consolidated_data: pd.DataFrame,
    price_threshold: int = 350000,
    upside_threshold: float = 5.0,
    exclude_names: List[str] = None
) -> List[Dict]:
    """
    Identify players from the user's team who are "junk cheapies":
    - Cost less than $350k (price_threshold)
    - Have less than 5 points of upside (Diff < upside_threshold)

    These are cheap players with little/no prospect of going up in value and who don't
    meaningfully contribute to team score.

    Parameters:
    team_players (List[Dict]): List of player dictionaries with 'name', 'positions', 'price'
    consolidated_data (pd.DataFrame): DataFrame containing player data with Diff and Price columns
    price_threshold (int): Maximum price to consider (default $350k)
    upside_threshold (float): Maximum Diff value to consider (default 5.0)
    exclude_names (List[str]): Names to exclude (e.g., already identified injured/overvalued players)

    Returns:
    List[Dict]: List of junk cheapies from the team
    """
    if not team_players:
        return []

    # Get the latest round data
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round].copy()

    # Build a mapping from abbreviated names to full names
    name_mapping = {}  # abbreviated -> full
    reverse_mapping = {}  # full -> abbreviated
    for player in team_players:
        abbrev_name = player['name']
        full_name = match_abbreviated_name_to_full(abbrev_name, consolidated_data)
        name_mapping[abbrev_name] = full_name
        reverse_mapping[full_name] = abbrev_name

    # Get the set of full names for DB lookups
    full_names_set = set(name_mapping.values())

    # Get excluded full names
    excluded_full_names = set()
    if exclude_names:
        for name in exclude_names:
            full_name = match_abbreviated_name_to_full(name, consolidated_data)
            excluded_full_names.add(full_name)

    # Filter to only team players and exclude specified names
    team_data = latest_data[latest_data['Player'].isin(full_names_set)]
    team_data = team_data[~team_data['Player'].isin(excluded_full_names)]

    # Convert Diff and Price to numeric
    team_data = team_data.copy()
    team_data['Diff'] = pd.to_numeric(team_data['Diff'], errors='coerce').fillna(0)
    team_data['Price'] = pd.to_numeric(team_data['Price'], errors='coerce').fillna(0)

    # Filter for junk cheapies criteria:
    # - Price < threshold (default $350k)
    # - Diff < upside_threshold (default 5.0 points of upside)
    junk_cheapies_data = team_data[
        (team_data['Price'] < price_threshold) &
        (team_data['Diff'] < upside_threshold)
    ]

    # Sort by price ascending (cheapest first) then by diff ascending (least upside first)
    junk_cheapies_data = junk_cheapies_data.sort_values(['Price', 'Diff'], ascending=[True, True])

    # Build result list
    junk_cheapies = []
    for _, row in junk_cheapies_data.iterrows():
        full_name = row['Player']
        abbrev_name = reverse_mapping.get(full_name, full_name)

        # Find the original player data to get the price
        original_player = next((p for p in team_players if p['name'] == abbrev_name), None)

        junk_cheapies.append({
            'name': abbrev_name,  # Use abbreviated name for display
            'positions': [row['POS1']] + ([row['POS2']] if pd.notna(row.get('POS2')) else []),
            'price': original_player.get('price', 0) if original_player else int(row['Price']),
            'diff': float(row['Diff'])
        })

    print(f"Junk cheapies identified: {[p['name'] for p in junk_cheapies]}")
    return junk_cheapies


def calculate_trade_out_recommendations(
    team_players: List[Dict],
    consolidated_data: pd.DataFrame,
    num_trades: int = 2,
    strategy: str = '3',
    target_bye_round: bool = False,
    preseason_mode: bool = False
) -> List[Dict]:
    """
    Calculate which players from the user's team should be traded out.
    Priority: 1) Injured players (Injured=TRUE in database), 2) Not selected (no projection), 3) Overvalued players (Diff < -2)
    
    In preseason mode, only includes players that meet at least one of these criteria:
    - Injured
    - Overvalued (Diff < -2)
    - Not selected (no projection value / not in teamlists)
    
    Parameters:
    team_players (List[Dict]): List of player dictionaries with 'name', 'positions', 'price'
    consolidated_data (pd.DataFrame): DataFrame containing all player data (includes Injured column)
    num_trades (int): Number of players to trade out
    preseason_mode (bool): If True, only includes players that are injured, overvalued (diff < -2), or not selected
    
    Returns:
    List[Dict]: List of recommended trade-out players with their data
    """
    print(f"\n=== calculate_trade_out_recommendations ===")
    print(f"Number of team_players: {len(team_players)}")
    print(f"num_trades requested: {num_trades}")
    print(f"preseason_mode: {preseason_mode}")
    
    # Threshold for considering a player "overvalued" in preseason mode
    OVERVALUED_THRESHOLD = -2
    
    if not team_players:
        print("WARNING: team_players is empty!")
        return []
    
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round].copy()
    print(f"Latest round: {latest_round}, players in latest data: {len(latest_data)}")

    # Build a mapping from abbreviated names to full names
    name_mapping = {}  # abbreviated -> full
    reverse_mapping = {}  # full -> abbreviated (to get back original name)
    for player in team_players:
        abbrev_name = player['name']
        full_name = match_abbreviated_name_to_full(abbrev_name, consolidated_data)
        name_mapping[abbrev_name] = full_name
        reverse_mapping[full_name] = abbrev_name
    
    print(f"Name mappings created: {len(name_mapping)}")
    
    # Get the set of full names for DB lookups
    full_names_set = set(name_mapping.values())

    # Step 1: Identify injured players (from database Injured column)
    injured = identify_injured_players(team_players, consolidated_data)
    injured_names = {p['name'] for p in injured}  # Original/abbreviated names
    injured_full_names = {name_mapping.get(p['name'], p['name']) for p in injured}  # Full names for DB lookup
    print(f"Injured players from team: {injured_names}")
    print(f"Injured players (full names): {injured_full_names}")
    
    # Step 2: Identify "not selected" players (no projection value or not in latest data)
    not_selected_names = set()
    team_data = latest_data[latest_data['Player'].isin(full_names_set)]
    players_in_data = set(team_data['Player'].unique())
    
    for player in team_players:
        full_name = name_mapping.get(player['name'], player['name'])
        # Player is "not selected" if not in latest data or has no/zero projection
        if full_name not in players_in_data:
            not_selected_names.add(player['name'])
            print(f"Player '{player['name']}' not in latest data - marking as not selected")
        else:
            # Check if projection is 0 or missing
            player_row = team_data[team_data['Player'] == full_name]
            if not player_row.empty:
                projection = pd.to_numeric(player_row.iloc[0].get('Projection', 0), errors='coerce')
                if pd.isna(projection) or projection == 0:
                    not_selected_names.add(player['name'])
                    print(f"Player '{player['name']}' has no projection - marking as not selected")
    
    print(f"Not selected players: {not_selected_names}")

    # If bye weighting is enabled, rank the whole squad with the new key
    if target_bye_round:
        # Use full names for DB lookup
        team_data = latest_data[latest_data['Player'].isin(full_names_set)]

        # Build candidate payloads
        candidates = []
        present_full_names = set()
        for _, row in team_data.iterrows():
            full_name = row['Player']
            present_full_names.add(full_name)
            # Find original player by matching full name back to abbreviated
            abbrev_name = reverse_mapping.get(full_name, full_name)
            original_player = next((p for p in team_players if p['name'] == abbrev_name), None)
            price = original_player.get('price', 0) if original_player else int(row.get('Price', 0))
            positions = [row['POS1']] + ([row['POS2']] if pd.notna(row.get('POS2')) else [])
            diff_value = float(row.get('Diff', 0))
            is_injured = full_name in injured_full_names
            is_not_selected = abbrev_name in not_selected_names
            is_overvalued = diff_value < OVERVALUED_THRESHOLD
            
            # In preseason mode, only include players that meet criteria
            if preseason_mode and not (is_injured or is_not_selected or is_overvalued):
                continue
            
            # Determine reason
            if is_injured:
                reason = 'injured'
            elif is_not_selected:
                reason = 'not_selected'
            elif is_overvalued:
                reason = 'low_upside'
            else:
                reason = 'low_upside'
            
            candidates.append({
                'name': abbrev_name,  # Use abbreviated name for display
                'positions': positions,
                'price': price,
                'reason': reason,
                'diff': diff_value,
                'projection': float(row.get('Projection', 0)),
                'bye_round_grade': row.get('bye_round_grade'),
                'is_injured': is_injured,
                'non_playing': is_not_selected
            })

        # Include any team players missing from the latest round data (defensive)
        for player in team_players:
            full_name = name_mapping.get(player['name'], player['name'])
            if full_name in present_full_names:
                continue
            is_injured = player['name'] in injured_names
            is_not_selected = player['name'] in not_selected_names
            
            # Players not in data are considered "not selected" - always include in preseason mode
            candidates.append({
                'name': player['name'],
                'positions': player.get('positions', []),
                'price': player.get('price', 0),
                'reason': 'injured' if is_injured else 'not_selected',
                'diff': 0,
                'projection': 0,
                'bye_round_grade': None,
                'is_injured': is_injured,
                'non_playing': True  # Not in data = not selected
            })

        weighted = apply_bye_weighting(candidates, mode="trade_out", strategy=strategy)
        return weighted[:num_trades]

    # Default behaviour (unchanged ordering) when bye weighting is off
    trade_out_candidates = []

    # Step 3: Add injured players first (priority)
    for player in injured:
        if len(trade_out_candidates) < num_trades:
            trade_out_candidates.append({
                'name': player['name'],
                'positions': player.get('positions', []),
                'price': player.get('price', 0),
                'reason': 'injured',
                'diff': None
            })
    
    print(f"After adding injured: {len(trade_out_candidates)} candidates")
    
    # Step 4: Add "not selected" players (players with no projection)
    already_selected_abbrev = {p['name'] for p in trade_out_candidates}
    for player in team_players:
        if len(trade_out_candidates) >= num_trades:
            break
        if player['name'] in already_selected_abbrev:
            continue
        if player['name'] in not_selected_names:
            trade_out_candidates.append({
                'name': player['name'],
                'positions': player.get('positions', []),
                'price': player.get('price', 0),
                'reason': 'not_selected',
                'diff': None
            })
            already_selected_abbrev.add(player['name'])
    
    print(f"After adding not selected: {len(trade_out_candidates)} candidates")
    
    # Step 5: If we need more players, select by lowest upside (inverse of trade-in algorithm)
    # In preseason mode, only include players with diff < -2 (overvalued)
    if len(trade_out_candidates) < num_trades:
        # Get already selected names (full names for DB lookup)
        already_selected_full = {name_mapping.get(n, n) for n in already_selected_abbrev}

        # Filter to only team players (using full names) and exclude already selected
        team_data = latest_data[latest_data['Player'].isin(full_names_set)]
        team_data = team_data[~team_data['Player'].isin(already_selected_full)]

        print(f"Team data after filtering: {len(team_data)} players")

        # Convert Diff to numeric, handling any errors
        team_data = team_data.copy()
        team_data['Diff'] = pd.to_numeric(team_data['Diff'], errors='coerce').fillna(0)

        # In preseason mode, only include overvalued players (diff < -2)
        if preseason_mode:
            team_data = team_data[team_data['Diff'] < OVERVALUED_THRESHOLD]
            print(f"Preseason mode: filtered to {len(team_data)} overvalued players (diff < {OVERVALUED_THRESHOLD})")

        # Sort by Diff ascending (lowest upside = most overvalued)
        team_data_sorted = team_data.sort_values('Diff', ascending=True)

        # Add players with lowest upside (in preseason mode, only overvalued ones)
        for _, row in team_data_sorted.iterrows():
            if len(trade_out_candidates) >= num_trades:
                break

            full_name = row['Player']
            abbrev_name = reverse_mapping.get(full_name, full_name)

            # Find the original player data to get the price
            original_player = next((p for p in team_players if p['name'] == abbrev_name), None)

            trade_out_candidates.append({
                'name': abbrev_name,  # Use abbreviated name for display
                'positions': [row['POS1']] + ([row['POS2']] if pd.notna(row.get('POS2')) else []),
                'price': original_player.get('price', 0) if original_player else int(row['Price']),
                'reason': 'low_upside',
                'diff': float(row['Diff'])
            })

    # Step 6: If we still need more players, add junk cheapies (lowest priority)
    if len(trade_out_candidates) < num_trades:
        # Get already selected names (abbreviated for exclusion)
        already_selected_abbrev_set = set(already_selected_abbrev)

        # Identify junk cheapies excluding already selected players
        junk_cheapies = identify_junk_cheapies(
            team_players,
            consolidated_data,
            exclude_names=list(already_selected_abbrev_set)
        )

        print(f"Adding junk cheapies to trade-out candidates: {[p['name'] for p in junk_cheapies[:num_trades - len(trade_out_candidates)]]}")

        # Add junk cheapies until we reach the required number
        for player in junk_cheapies:
            if len(trade_out_candidates) >= num_trades:
                break

            trade_out_candidates.append({
                'name': player['name'],
                'positions': player.get('positions', []),
                'price': player.get('price', 0),
                'reason': 'junk_cheap',
                'diff': player.get('diff', 0)
            })
    
    print(f"Final trade-out candidates: {len(trade_out_candidates)}")
    return trade_out_candidates[:num_trades]


def calculate_combined_trade_recommendations(
    team_players: List[Dict],
    cash_in_bank: int,
    consolidated_data: pd.DataFrame,
    strategy: str = '3',  # '1' = value, '2' = base, '3' = hybrid
    num_trades: int = 2,
    allowed_positions: List[str] = None,
    simulate_datetime: str = None,
    apply_lockout: bool = False,
    excluded_players: List[str] = None,
    target_bye_round: bool = False,
    preseason_mode: bool = False,
    preselected_trade_outs: List[Dict] = None
) -> Dict:
    """
    Calculate both trade-out and trade-in recommendations for the user's team.
    
    Parameters:
    team_players (List[Dict]): List of player dictionaries with 'name', 'positions', 'price'
    cash_in_bank (int): Additional cash available
    consolidated_data (pd.DataFrame): DataFrame containing all player data (includes Injured column)
    strategy (str): Strategy for trade-in ('1' = value, '2' = base, '3' = hybrid)
    num_trades (int): Number of players to trade
    allowed_positions (List[str]): Allowed positions (optional filtering)
    simulate_datetime (str): Optional datetime for lockout simulation
    apply_lockout (bool): Whether to apply lockout restrictions
    excluded_players (List[str]): Players to exclude from recommendations
    preseason_mode (bool): If True, only trade-out players that are injured, overvalued (diff < -2), or not selected
    
    Returns:
    Dict: Dictionary with 'trade_out' and 'trade_in' recommendations
    """
    # Step 1: Use pre-selected trade-outs if provided, otherwise calculate recommendations
    if preselected_trade_outs:
        trade_out_players = preselected_trade_outs
        print(f"Using pre-selected trade-out players: {[p['name'] for p in trade_out_players]}")
    else:
        trade_out_players = calculate_trade_out_recommendations(
            team_players,
            consolidated_data,
            num_trades,
            strategy,
            target_bye_round,
            preseason_mode
        )

    # Step 2: Calculate total salary freed up
    total_salary_freed = cash_in_bank
    traded_out_names = []

    for player in trade_out_players:
        total_salary_freed += player['price']
        traded_out_names.append(player['name'])

    print(f"Trade out players: {traded_out_names}")
    print(f"Total salary freed: ${total_salary_freed:,} (including ${cash_in_bank:,} cash in bank)")
    
    # Step 3: Calculate trade-in recommendations using existing algorithm
    maximize_base = (strategy == '2')
    hybrid_approach = (strategy == '3')
    
    # Get list of non-injured players for trade-in restriction
    # Filter to only players who are not injured (Injured=FALSE or NULL)
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round]
    if 'Injured' in latest_data.columns:
        # Use apply to ensure proper boolean handling
        not_injured_mask = latest_data['Injured'].apply(lambda x: not bool(x) if pd.notna(x) else True)
        non_injured_players = latest_data[not_injured_mask]['Player'].unique().tolist()
        print(f"Non-injured players count: {len(non_injured_players)}")
    else:
        non_injured_players = latest_data['Player'].unique().tolist()
    team_list = non_injured_players
    
    # Calculate trade-in options
    trade_in_options = calculate_trade_options(
        consolidated_data,
        trade_out_players,  # Pass full player dicts instead of just names to include trade_in_positions
        maximize_base=maximize_base,
        hybrid_approach=hybrid_approach,
        max_options=10,
        allowed_positions=allowed_positions,
        team_list=team_list,
        simulate_datetime=simulate_datetime,
        apply_lockout=apply_lockout,
        excluded_players=excluded_players,
        cash_in_bank=cash_in_bank,
        target_bye_round=target_bye_round,
        strategy=strategy
    )
    
    return {
        'trade_out': trade_out_players,
        'trade_in': trade_in_options,
        'total_salary_freed': total_salary_freed
    }


def calculate_preseason_trade_in_candidates(
    consolidated_data: pd.DataFrame,
    salary_cap: int,
    positions: List[str],
    strategy: str = '1',
    excluded_players: List[str] = None,
    target_bye_round: bool = False,
    max_results: int = 50,
    test_approach: bool = False,
    trade_out_players: List[Dict] = None
) -> List[Dict]:
    """
    Calculate individual trade-in candidates for pre-season mode.
    Returns a flat list of players (not pairs) sorted by strategy preference.
    
    Parameters:
    consolidated_data (pd.DataFrame): DataFrame containing all player data (includes Injured column)
    salary_cap (int): Maximum salary to spend
    positions (List[str]): Positions to filter by (from trade-outs)
    strategy (str): '1' = value (Diff), '2' = base (Projection), '3' = hybrid
    excluded_players (List[str]): Players to exclude (team players + trade-outs)
    target_bye_round (bool): Whether to prioritize bye round coverage
    max_results (int): Maximum number of candidates to return
    test_approach (bool): If True, filter by price bands (±$75k from trade-out prices)
    trade_out_players (List[Dict]): List of trade-out players with prices (required for test_approach)
    
    Returns:
    List[Dict]: List of trade-in candidate players
    """
    PRICE_BAND_MARGIN = 75000  # ±$75k price band
    
    latest_round = consolidated_data['Round'].max()
    latest_data = consolidated_data[consolidated_data['Round'] == latest_round].copy()
    
    # Filter out injured players (only include players not marked as injured)
    if 'Injured' in latest_data.columns:
        not_injured_mask = latest_data['Injured'].apply(lambda x: not bool(x) if pd.notna(x) else True)
        latest_data = latest_data[not_injured_mask]

    # Filter out players with no projection value (not selected)
    # Only include players who have a valid projection (not null/zero)
    projection_mask = ~(
        pd.isna(latest_data['Projection']) |
        (latest_data['Projection'] == 0)
    )
    latest_data = latest_data[projection_mask]

    # Exclude specified players (team + trade-outs)
    if excluded_players:
        latest_data = latest_data[~latest_data['Player'].isin(excluded_players)]

    # Ensure numeric columns first (before price filtering)
    latest_data['Diff'] = pd.to_numeric(latest_data['Diff'], errors='coerce').fillna(0)
    latest_data['Projection'] = pd.to_numeric(latest_data['Projection'], errors='coerce').fillna(0)
    latest_data['Price'] = pd.to_numeric(latest_data['Price'], errors='coerce').fillna(0)
    
    # TEST APPROACH: Filter by cascading price bands from trade-out players
    if test_approach and trade_out_players:
        print(f"\n=== TEST APPROACH: Cascading price band filtering ===")
        print(f"Trade-out players: {[(p.get('name'), p.get('price'), p.get('originalPosition'), p.get('trade_in_positions')) for p in trade_out_players]}")

        # Build cascading price bands from trade-out players
        # For each trade-out player, find the lowest price band that contains players with diff >= 7
        # AND that match the position requirement for that slot
        final_bands = []

        for player in trade_out_players:
            player_price = player.get('price', 0)
            if player_price <= 0:
                continue

            player_name = player.get('name')
            # Frontend sends 'position', not 'originalPosition'
            original_position = player.get('position') or player.get('originalPosition')
            trade_in_positions = player.get('trade_in_positions', [])  # Position requirements set by frontend
            
            # Use trade_in_positions directly as the required positions
            # Frontend always sets this: for positional slots it's [position], for flexible slots it's user-selected
            if isinstance(trade_in_positions, list) and trade_in_positions:
                required_positions = trade_in_positions
            elif trade_in_positions:
                required_positions = [trade_in_positions]
            else:
                # Fallback: use the slot position if trade_in_positions not set
                required_positions = [original_position] if original_position else []
            
            print(f"  {player_name}: slot={original_position}, required_positions={required_positions}")

            # Start with original band and cascade downward until we find players with diff >= 7
            # that also match the position requirement
            band_offset = 0
            found_valid_band = False

            while not found_valid_band and band_offset < 10:  # Prevent infinite loops
                if band_offset == 0:
                    # Original band: ±75k
                    min_price = player_price - PRICE_BAND_MARGIN
                    max_price = player_price + PRICE_BAND_MARGIN
                else:
                    # Lower bands: center - (75k * (offset + 1)) to center - (75k * offset)
                    min_price = player_price - (PRICE_BAND_MARGIN * (band_offset + 1))
                    max_price = player_price - (PRICE_BAND_MARGIN * band_offset)

                # Check if this band contains players with diff >= 7 AND matching position
                band_players = latest_data[
                    (latest_data['Price'] >= min_price) &
                    (latest_data['Price'] <= max_price) &
                    (latest_data['Diff'] >= 7)
                ]
                
                # If we have position requirements, also filter by position
                if required_positions and len(band_players) > 0:
                    position_mask = (
                        band_players['POS1'].isin(required_positions) |
                        band_players['POS2'].fillna('').isin(required_positions)
                    )
                    band_players = band_players[position_mask]

                if len(band_players) > 0:
                    # Found a valid band with players having diff >= 7 AND matching position
                    final_bands.append({
                        'player_name': player_name,
                        'position': original_position,
                        'trade_in_positions': required_positions,
                        'min_price': min_price,
                        'max_price': max_price,
                        'center_price': player_price,
                        'band_offset': band_offset
                    })
                    print(f"  -> Price band for {player_name} ({original_position}): ${min_price:,} - ${max_price:,} (offset: {band_offset}, {len(band_players)} players)")
                    found_valid_band = True
                else:
                    print(f"  -> No valid players (diff >= 7, positions {required_positions}) in band ${min_price:,} - ${max_price:,}, trying lower band...")
                    band_offset += 1

            if not found_valid_band:
                # Fallback: use original band even if no players with diff >= 7 and matching position
                min_price = player_price - PRICE_BAND_MARGIN
                max_price = player_price + PRICE_BAND_MARGIN
                final_bands.append({
                    'player_name': player_name,
                    'position': original_position,
                    'trade_in_positions': required_positions,
                    'min_price': min_price,
                    'max_price': max_price,
                    'center_price': player_price,
                    'band_offset': band_offset
                })
                print(f"  -> Fallback: Using original band for {player_name} (${min_price:,} - ${max_price:,}) - no valid players found after {band_offset} cascades")

        # Filter players to those within any final price band AND with diff >= 7
        # (The cascading logic finds bands based on players with diff >= 7, so we should only show those players)
        if final_bands:
            # Create a mask for players within any final price band
            price_mask = pd.Series([False] * len(latest_data), index=latest_data.index)
            for band in final_bands:
                band_mask = (latest_data['Price'] >= band['min_price']) & (latest_data['Price'] <= band['max_price'])
                price_mask = price_mask | band_mask

            latest_data = latest_data[price_mask]
            print(f"Players after cascading price band filtering: {len(latest_data)}")
            
            # Also filter by diff >= 7 to ensure only valuable trade-in options are shown
            latest_data = latest_data[latest_data['Diff'] >= 7]
            print(f"Players after diff >= 7 filtering: {len(latest_data)}")

    else:
        # Normal approach: filter by salary cap
        latest_data = latest_data[latest_data['Price'] <= salary_cap]

    # Filter by position requirements from trade_out_players (per-player requirements)
    if trade_out_players:
        # Collect all unique position requirements from trade-out players
        all_required_positions = set()
        for player in trade_out_players:
            trade_in_positions = player.get('trade_in_positions')
            if trade_in_positions:
                if isinstance(trade_in_positions, list):
                    all_required_positions.update(trade_in_positions)
                else:
                    all_required_positions.add(trade_in_positions)

        # If there are position requirements, filter candidates
        if all_required_positions:
            print(f"Filtering preseason candidates by position requirements: {all_required_positions}")
            # Match if POS1 or POS2 is in the required positions
            mask = (
                latest_data['POS1'].isin(all_required_positions) |
                latest_data['POS2'].fillna('').isin(all_required_positions)
            )
            latest_data = latest_data[mask]
            print(f"Players after position requirement filtering: {len(latest_data)}")

    # Filter by positions if specified (skip for test approach - frontend handles position filtering)
    if not test_approach and positions and len(positions) > 0:
        # Match if POS1 or POS2 is in the allowed positions
        mask = (
            latest_data['POS1'].isin(positions) |
            latest_data['POS2'].fillna('').isin(positions)
        )
        latest_data = latest_data[mask]
    
    # Sort based on strategy (but return all for test approach)
    if strategy == '2':  # Maximize base (Projection)
        latest_data = latest_data.sort_values('Projection', ascending=False)
    elif strategy == '3':  # Hybrid - use a combined score
        # Normalize both metrics and combine
        max_diff = latest_data['Diff'].max() or 1
        max_proj = latest_data['Projection'].max() or 1
        latest_data['hybrid_score'] = (
            (latest_data['Diff'] / max_diff) * 0.5 +
            (latest_data['Projection'] / max_proj) * 0.5
        )
        latest_data = latest_data.sort_values('hybrid_score', ascending=False)
    else:  # Default: Maximize value (Diff)
        latest_data = latest_data.sort_values('Diff', ascending=False)

    # For test approach, return all players within price bands (no limit)
    # For normal approach, limit to max_results
    result_limit = None if test_approach else max_results

    # Build result list
    candidates = []
    for _, row in latest_data.head(result_limit).iterrows():
        positions_list = [row['POS1']]
        if pd.notna(row.get('POS2')) and row['POS2']:
            positions_list.append(row['POS2'])
        
        candidate = {
            'name': row['Player'],
            'position': row['POS1'],
            'positions': positions_list,
            'team': row.get('Team', ''),
            'price': int(row['Price']),
            'diff': float(row['Diff']),
            'projection': float(row['Projection'])
        }
        
        # If test approach, add price band info to help frontend filtering
        if test_approach and trade_out_players:
            # Find which final band(s) this player fits into (price AND position must match)
            matching_bands = []
            for i, band in enumerate(final_bands):
                # Check price is within band
                if not (band['min_price'] <= row['Price'] <= band['max_price']):
                    continue
                
                # Check position compatibility
                band_positions = band.get('trade_in_positions', [])
                if band_positions:
                    # Player must have at least one position that matches the requirement
                    player_positions = positions_list  # Already computed above
                    position_matches = any(pos in band_positions for pos in player_positions)
                    if not position_matches:
                        continue
                
                matching_bands.append({
                    'index': i,
                    'player_name': band['player_name'],
                    'position': band['position'],
                    'trade_in_positions': band_positions
                })
            candidate['matching_bands'] = matching_bands
        
        candidates.append(candidate)
    
    # Apply bye weighting if enabled
    if target_bye_round and candidates:
        # Enrich with bye_round_grade from the data
        for candidate in candidates:
            player_row = latest_data[latest_data['Player'] == candidate['name']]
            if not player_row.empty:
                candidate['bye_round_grade'] = player_row.iloc[0].get('bye_round_grade')
                candidate['is_injured'] = False
                candidate['non_playing'] = False
        
        candidates = apply_bye_weighting(candidates, mode="trade_in", strategy=strategy)

    # For test approach, return all candidates (no limit)
    # For normal approach, limit to max_results
    return candidates if test_approach else candidates[:max_results]

