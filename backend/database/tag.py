# tag.py
from . import db

class BackUpTag(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    number = db.Column(db.Integer, nullable=False)
    tag_id = db.Column(db.String(50), nullable=False)
    discovery_time = db.Column(db.String(25), nullable=False)
    last_seen_time = db.Column(db.String(25), nullable=False)
    count = db.Column(db.Integer, nullable=False)
    antenna = db.Column(db.Integer, nullable=False)
    protocol = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<BackUpTag {self.tag_id}>'