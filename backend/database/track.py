# track.py
from . import db
    
class Track(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    distance = db.Column(db.Double, nullable=False)
    min_age = db.Column(db.Integer, nullable=False)
    max_age = db.Column(db.Integer, nullable=False)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)

    categories = db.relationship('Category', backref='track')