# category.py
from . import db

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    category_name = db.Column(db.String(30), nullable=False)
    min_age = db.Column(db.Integer, nullable=False)
    max_age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(1), nullable=False)

    # Relationship with Registration
    race = db.relationship('Race', backref='categories')
    registrations = db.relationship('Registration', backref='category')