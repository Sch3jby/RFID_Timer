# race_operations.py
from flask import current_app
from sqlalchemy import text
from database.race import db, Race

def create_race_results_table(race_id):
    """
    Dynamically create a results table for a specific race
    """
    table_name = f'race_results_{race_id}'
    
    # SQL to create dynamic results table
    create_table_sql = text(f'''
    CREATE TABLE IF NOT EXISTS {table_name} (
        id SERIAL PRIMARY KEY,
        number INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lap_number INTEGER DEFAULT 1,
        track_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    ''')
    
    # Execute the table creation
    db.session.execute(create_table_sql)
    db.session.commit()

def setup_all_race_results_tables():
    """
    Create results tables for all existing races
    """
    races = Race.query.all()
    for race in races:
        create_race_results_table(race.id)