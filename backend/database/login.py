# database/login.py
from . import db

class Login(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(70), nullable=False)
    email = db.Column(db.String(70), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Integer, nullable=False, default=2)
