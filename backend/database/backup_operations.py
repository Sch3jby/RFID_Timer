# database/tag_operations.py
from backend.database.backup import db, BackUpTag

def add_tag(tag, number, lastSeenTime):
    """
    Add a new tag to the database.
    
    Args:
        tag (str): RFID tag identifier
        number (int): Runner's bib number
        lastSeenTime (str): Timestamp of last tag reading
        
    Returns:
        BackUpTag: Created database entry or None if error
    """

    detected_tag = BackUpTag(number=number, tag=tag, lastSeenTime=lastSeenTime)
    db.session.add(detected_tag)
    try:
        db.session.commit()
        return detected_tag
    except Exception as e:
        db.session.rollback()
        print("Error adding tag %s", e)
        return None