# app.py
from flask import Flask
from extensions import mail, jwt, cors, db
import configparser
from datetime import timedelta
from database.race_operations import setup_all_race_results_tables

def create_app():
    # Initialize Flask application
    app = Flask(__name__, static_folder="static", template_folder="templates")
    
    # Load configuration
    config = configparser.ConfigParser()
    config.read('config.ini')
    
    # Configure CORS
    cors.init_app(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://checkpoint.nti.tul.cz"], "supports_credentials": True}})
    
    # Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = config.get('database', 'DATABASE_URL')
    app.config['SECRET_KEY'] = 'secret_key_here'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    # JWT configuration
    jwt.init_app(app)
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['JWT_SECRET_KEY'] = config.get('jwt', 'SECRET_KEY')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=config.getint('jwt', 'ACCESS_TOKEN_EXPIRES'))
    
    # Mail configuration
    app.config['MAIL_SERVER'] = config.get('mail', 'MAIL_SERVER', fallback='smtp.gmail.com')
    app.config['MAIL_PORT'] = config.getint('mail', 'MAIL_PORT', fallback=587)
    app.config['MAIL_USE_TLS'] = config.getboolean('mail', 'MAIL_USE_TLS', fallback=True)
    app.config['MAIL_USERNAME'] = config.get('mail', 'MAIL_USERNAME', fallback='your-email@gmail.com')
    app.config['MAIL_PASSWORD'] = config.get('mail', 'MAIL_PASSWORD', fallback='your-app-password')
    mail.init_app(app)
    
    # Password reset configuration
    app.config['PASSWORD_RESET_SALT'] = config.get('security', 'PASSWORD_RESET_SALT', fallback='password-reset-salt')

    # Register blueprints
    from blueprints.registration import registration_bp
    from blueprints.startlist import startlist_bp
    from blueprints.results import results_bp
    from blueprints.race_management import race_management_bp
    from blueprints.auth import auth_bp
    from blueprints.rfid import rfid_bp
    
    app.register_blueprint(registration_bp, url_prefix='/api')
    app.register_blueprint(startlist_bp, url_prefix='/api')
    app.register_blueprint(results_bp, url_prefix='/api')
    app.register_blueprint(race_management_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(rfid_bp, url_prefix='/api')
    
    @app.route('/')
    def index():
        return "Welcome to the RFID Reader API!", 200
    
    @app.route('/<path:path>')
    def catch_all(path):
        return app.send_static_file('index.html'), 200
    
    return app

def init_db(app):
    with app.app_context():
        db.create_all()
        setup_all_race_results_tables()

if __name__ == '__main__':
    app = create_app()
    init_db(app)
    app.run(host='0.0.0.0', port=5001, debug=True)