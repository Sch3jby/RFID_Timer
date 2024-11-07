# race.py
from . import db

class Race(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start = db.Column(db.String(1), nullable=False)     # M = mass start, I = interval start

    def __repr__(self):
        return f'<Race {self.id}>'