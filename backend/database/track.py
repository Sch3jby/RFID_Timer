# track.py
from . import db
from datetime import time
    
class Track(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    distance = db.Column(db.Double, nullable=False)
    min_age = db.Column(db.Integer, nullable=False)
    max_age = db.Column(db.Integer, nullable=False)
    fastest_possible_time = db.Column(db.Time, nullable=False)
    number_of_laps = db.Column(db.Integer, nullable=False)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    expected_start_time = db.Column(db.Time, nullable=False)
    actual_start_time = db.Column(db.Time)
    
    # Relationship with Category
    categories = db.relationship('Category', backref='track')