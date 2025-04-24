# database/user_operations.py
from user import db, User

def create_user(firstname, surname, year, club, email, category, race_id):
    """
    Create a new user in the database.
    
    Args:
        firstname (str): User's first name
        surname (str): User's last name
        year (int): Birth year
        club (str): Club name
        email (str): Email address
        category (str): Category name
        race_id (int): Associated race ID
        
    Returns:
        User: Created user object or None if error
    """

    new_user = User(firstname=firstname, surname=surname, year=year, club=club, email=email, category=category, race_id=race_id)
    db.session.add(new_user)
    try:
        db.session.commit()
        return new_user
    except Exception as e:
        db.session.rollback()
        print("Error creating user %s", e)
        return None