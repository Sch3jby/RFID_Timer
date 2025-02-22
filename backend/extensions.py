# extensions.py
from flask_mail import Mail
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from database import db

mail = Mail()
jwt = JWTManager()
cors = CORS()