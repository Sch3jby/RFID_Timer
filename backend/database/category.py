# database/category.py
from . import db

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category_name = db.Column(db.String(25), nullable=False)
    min_age = db.Column(db.Integer, nullable=False)
    max_age = db.Column(db.Integer, nullable=False)
    min_number = db.Column(db.Integer, nullable=False)
    max_number = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(1), nullable=False)
    track_id = db.Column(db.Integer, db.ForeignKey('track.id'), nullable=False)