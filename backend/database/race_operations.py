# race_operations.py
from flask import current_app
from sqlalchemy import text
from database.race import db, Race

def create_race_results_table(race_id):
    """
    Dynamically create a results table for a specific race with extended tracking
    """
    table_name = f'race_results_{race_id}'
    
    # SQL to create dynamic results table with additional columns
    create_table_sql = text(f'''
    CREATE TABLE IF NOT EXISTS {table_name} (
        id SERIAL PRIMARY KEY,
        number INTEGER NOT NULL,
        tag_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lap_number INTEGER DEFAULT 1,
        track_id INTEGER NOT NULL,
        last_seen_time TIMESTAMP
    )
    ''')
    
    # Create index for performance
    create_index_sql = text(f'''
    CREATE INDEX IF NOT EXISTS idx_{table_name}_number ON {table_name} (number);
    CREATE INDEX IF NOT EXISTS idx_{table_name}_timestamp ON {table_name} (timestamp);
    ''')
    
    try:
        # Execute the table creation
        db.session.execute(create_table_sql)
        db.session.execute(create_index_sql)
        db.session.commit()
        current_app.logger.info(f"Created results table for race {race_id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating results table for race {race_id}: {str(e)}")

def setup_all_race_results_tables():
    """
    Create results tables for all existing races
    """
    races = Race.query.all()
    for race in races:
        create_race_results_table(race.id)