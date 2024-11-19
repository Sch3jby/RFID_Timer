# race.py
from . import db
    
class Race(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start = db.Column(db.String(1), nullable=False)  # M = mass start, I = interval start
    results_table_name = db.Column(db.String(50))
    description = db.Column(db.String(5000))

    # Relationship with Track
    tracks = db.relationship('Track', backref='race')
    # Relationship with Registration
    registrations = db.relationship('Registration', backref='race')