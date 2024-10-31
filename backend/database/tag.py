# tag.py
from . import db

class Tag(db.Model):
    number = db.Column(db.Integer, nullable=False, primary_key=True)
    tag_id = db.Column(db.String(50), nullable=False)
    discovery_time = db.Column(db.String(25), nullable=False)
    last_seen_time = db.Column(db.String(25), nullable=False)
    count = db.Column(db.Integer, nullable=False)
    antenna = db.Column(db.Integer, nullable=False)
    protocol = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<Tag {self.tag_id}>'