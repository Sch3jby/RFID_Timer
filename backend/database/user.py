# users.py
from . import db

class Users(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    firstname = db.Column(db.String(25), nullable=False)
    surname = db.Column(db.String(25), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    club = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(70), nullable=False)
    gender = db.Column(db.String(1), nullable=False)

    # Relationship with Registration
    registrations = db.relationship('Registration', backref='users')