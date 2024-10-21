import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request
from flask_cors import CORS
import telnetlib
import configparser
import time

# Import models
from database import db
from database.user import User

# Load configuration from config.ini
config = configparser.ConfigParser()
config.read('config.ini')

# Initialize Flask application
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Initialize database
app.config['SQLALCHEMY_DATABASE_URI'] = config.get('database', 'DATABASE_URL')
app.config['SECRET_KEY'] = 'secret_key_here'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Get the RFID configuration
hostname = config.get('alien_rfid', 'hostname')
port = config.getint('alien_rfid', 'port')

# Zajištění existence adresáře pro logy
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)

# Konfigurace logování
info_handler = RotatingFileHandler(os.path.join(log_dir, 'info.log'), maxBytes=5102410, backupCount=5)
info_handler.setLevel(logging.INFO)
info_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

error_handler = RotatingFileHandler(os.path.join(log_dir, 'error.log'), maxBytes=5102410, backupCount=5)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

info_logger = logging.getLogger('info_logger')
info_logger.setLevel(logging.INFO)
info_logger.addHandler(info_handler)

error_logger = logging.getLogger('error_logger')
error_logger.setLevel(logging.ERROR)
error_logger.addHandler(error_handler)

# RFID reader connection state
class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False

    def connect(self, retries=5):
        for attempt in range(retries):
            try:
                self.terminal = telnetlib.Telnet(self.hostname, self.port)
                self.terminal.read_until(b'Username>', timeout=5)
                self.terminal.write(b'alien\n')  # Replace with actual username
                self.terminal.read_until(b'Password>', timeout=5)
                self.terminal.write(b'password\n')  # Replace with actual password
                self.terminal.read_until(b'>', timeout=5)
                self.connected = True
                return
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                time.sleep(2)
        raise RuntimeError(f"Failed to connect after {retries} attempts.")

    def disconnect(self):
        if self.connected and self.terminal:
            self.terminal.close()
            self.connected = False

    def command(self, cmd: str):
        if not self.connected:
            raise RuntimeError("Not connected to the RFID reader.")
        self.terminal.write(cmd.encode('utf-8') + b'\n')
        response = self.terminal.read_until(b'>', timeout=5)
        return response.decode('ascii')

alien = AlienRFID(hostname, port)

# Routes
@app.route('/')
def index():
    return "Welcome to the RFID Reader API!"

@app.route('/connect', methods=['POST'])
def connect_reader():
    try:
        if alien.connected:
            alien.disconnect()
            return jsonify({"status": "disconnected"})
        else:
            alien.connect(retries=5)
            return jsonify({"status": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/fetch_taglist', methods=['GET'])
def fetch_taglist():
    try:
        if not alien.connected:
            return jsonify({"status": "error", "message": "Not connected to RFID reader"})
        
        taglist_response = alien.command('get Taglist')
        tags = taglist_response.split("\n")  # Assuming tags are separated by new lines
                    
        info_logger.info('Reader se úspěšně připojil')
        return jsonify({"status": "success", "taglist": tags})
    except Exception as e:
        error_logger.error('Reader se nepodařilo připojit: %s', str(e))
        return jsonify({"status": "error", "message": str(e)})

@app.route('/registration', methods=['POST'])
def register():
    try:
        data = request.json
        forename = data.get('forename')
        surname = data.get('surname')
        year = data.get('year')
        club = data.get('club')

        if not all([forename, surname, year, club]):
            return jsonify({'error': 'Všechna pole jsou povinná'}), 400

        # Convert year to integer
        try:
            year = int(year)
        except ValueError:
            return jsonify({'error': 'Rok narození musí být číslo'}), 400

        new_user = User(
            forename=forename,
            surname=surname,
            year=year,
            club=club
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        info_logger.info('Nový uživatel %s %s byl registrován', forename, surname)
        return jsonify({'message': 'Uživatel úspěšně zaregistrován'}), 201

    except Exception as e:
        db.session.rollback()
        error_logger.error('Chyba při registraci uživatele: %s', str(e))
        return jsonify({'error': 'Došlo k chybě při registraci'}), 400

# Create tables before first request
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)