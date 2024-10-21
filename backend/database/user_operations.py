# user_operations.py
from user import db, User

def create_user(forename, surname, year, club):
    new_user = User(forename=forename, surname=surname, year=year, club=club)
    db.session.add(new_user)
    try:
        db.session.commit()
        return new_user
    except Exception as e:
        db.session.rollback()
        print("Error creating user %s", e)
        return None