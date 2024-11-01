# tag_operations.py
from tag import db, BackUpTag

def add_tag(tag, number, discoveryTime, lastSeenTime, count, antenna, protocol):
    detected_tag = BackUpTag(number=number, tag=tag, discoveryTime=discoveryTime, lastSeenTime=lastSeenTime, count=count, antenna=antenna, protocol=protocol)
    db.session.add(detected_tag)
    try:
        db.session.commit()
        return detected_tag
    except Exception as e:
        db.session.rollback()
        print("Error adding tag %s", e)
        return None