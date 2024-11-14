# registration.py
from . import db

class Registration(db.Model):
    __tablename__ = 'registration'
    id = db.Column(db.Integer, primary_key=True)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_time = db.Column(db.Time)
    finish_time = db.Column(db.Time)
    race_time = db.Column(db.Interval)
    position = db.Column(db.Integer)
    category_position = db.Column(db.Integer)