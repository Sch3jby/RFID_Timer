# race_operations.py
from flask import current_app
from sqlalchemy import text
from database.race import db, Race

def create_race_results_table(race_id, table_name):
    """Create a results table for a specific race if it doesn't exist"""
    create_table_sql = text(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            start_time TIMESTAMP,
            finish_time TIMESTAMP,
            race_time INTERVAL,
            position INTEGER,
            category_position INTEGER
        )
    """)
    
    try:
        db.session.execute(create_table_sql)
        db.session.commit()
        
        # Update the race record with the table name
        race = Race.query.get(race_id)
        if race:
            race.results_table_name = table_name
            db.session.commit()
            
        current_app.logger.info(f'Created results table {table_name} for race {race_id}')
        return True
    except Exception as e:
        current_app.logger.error(f'Error creating results table for race {race_id}: {str(e)}')
        db.session.rollback()
        return False

def setup_all_race_results_tables():
    """Create results tables for all races that don't have them"""
    with current_app.app_context():
        races = Race.query.all()
        for race in races:
            table_name = f'race_results_{race.id}'
            if not race.results_table_name:
                create_race_results_table(race.id, table_name)