import pandas as pd
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

# Database connection
database_url = os.getenv('DATABASE_URL')
if database_url:
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    engine = create_engine(database_url)

    with engine.connect() as connection:
        # Query for N. Lawson
        result = connection.execute(text("""
            SELECT "Player", "Projection", "Round"
            FROM player_stats
            WHERE LOWER("Player") LIKE LOWER('%lawson%')
            ORDER BY "Round" DESC
            LIMIT 10
        """))

        print('Database results for Lawson:')
        for row in result:
            print(f'Player: {row[0]}, Projection: {row[1]}, Round: {row[2]}')

        # Also check exact match for N. Lawson
        result2 = connection.execute(text("""
            SELECT "Player", "Projection", "Round"
            FROM player_stats
            WHERE "Player" = 'N. Lawson'
            ORDER BY "Round" DESC
            LIMIT 5
        """))

        print('\nExact match for N. Lawson:')
        for row in result2:
            print(f'Player: {row[0]}, Projection: {row[1]}, Round: {row[2]}')
else:
    print('No DATABASE_URL found')