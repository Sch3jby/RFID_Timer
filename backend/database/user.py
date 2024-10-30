# user.py
from . import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    forename = db.Column(db.String(25), nullable=False)
    surname = db.Column(db.String(25), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    club = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(70), nullable=False)
    category = db.Column(db.String(50), nullable=False)

    def __repr__(self):
        return f'<User {self.id}>'