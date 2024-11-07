# user_operations.py
from race import db, Race

def create_user(id, name, date, start):
    new_race = Race(id=id, name=name, date=date, start=start)
    db.session.add(new_race)
    try:
        db.session.commit()
        return new_race
    except Exception as e:
        db.session.rollback()
        print("Error creating race %s", e)
        return None