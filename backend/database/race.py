# race.py
from . import db
    
class Race(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start = db.Column(db.String(1), nullable=False)  # M = mass start, I = interval start
    description = db.Column(db.String(5000))
    results_table_name = db.Column(db.String(50))
    category_table_name = db.Column(db.String(50))

    # Relationships
    registrations = db.relationship('Registration', backref='race')
    race_categories = db.relationship('RaceCategory', back_populates='race')