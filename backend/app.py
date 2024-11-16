# app.py
import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request
from flask_cors import CORS
import telnetlib
import configparser
import time
from datetime import datetime
from enum import Enum
import re

# Import models
from database import db
from database.user import Users
from database.tag import BackUpTag
from database.race import Race
from database.registration import Registration

from database.race_operations import setup_all_race_results_tables

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

# Log directory setup
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)

# Log configuration
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

# Enum for male categories
class MaleCategory(Enum):
    CHILDRENA = "Men 5-9"
    CHILDRENB = "Men 10-15"
    JUNIOR = "Men 16-20"
    ADULTA = "Men 21-39"
    ADULTB = "Men 40-49"
    ADULTC = "Men 50-59"
    ADULTD = "Men 60-69"
    SENIOR = "Men 70+"

# Enum for female categories
class FemaleCategory(Enum):
    CHILDRENA = "Women 5-9"
    CHILDRENB = "Women 10-15"
    JUNIOR = "Women 16-20"
    ADULTA = "Women 21-39"
    ADULTB = "Women 40-49"
    ADULTC = "Women 50-59"
    ADULTD = "Women 60-69"
    SENIOR = "Women 70+"

# RFID reader connection state
class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False

    def connect(self):
        try:
            self.terminal = telnetlib.Telnet(self.hostname, self.port)
            self.terminal.read_until(b'Username>', timeout=5)
            self.terminal.write(b'alien\n')
            self.terminal.read_until(b'Password>', timeout=5)
            self.terminal.write(b'password\n')
            self.terminal.read_until(b'>', timeout=5)
            self.connected = True
            return
        except Exception as e:
            print(f"Attempt failed: {e}")

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

# Methods
def get_category(gender, birth_year):
    current_year = datetime.now().year
    age = current_year - birth_year

    if gender == "M":
        if 5 <= age <= 9:
            return MaleCategory.CHILDRENA.value
        elif 10 <= age <= 15:
            return MaleCategory.CHILDRENB.value
        elif 16 <= age <= 20:
            return MaleCategory.JUNIOR.value
        elif 21 <= age <= 39:
            return MaleCategory.ADULTA.value
        elif 40 <= age <= 49:
            return MaleCategory.ADULTB.value
        elif 50 <= age <= 59:
            return MaleCategory.ADULTC.value
        elif 60 <= age <= 69:
            return MaleCategory.ADULTD.value
        elif age >= 70:
            return MaleCategory.SENIOR.value

    elif gender == "F":
        if 5 <= age <= 9:
            return FemaleCategory.CHILDRENA.value
        elif 10 <= age <= 15:
            return FemaleCategory.CHILDRENB.value
        elif 16 <= age <= 20:
            return FemaleCategory.JUNIOR.value
        elif 21 <= age <= 39:
            return FemaleCategory.ADULTA.value
        elif 40 <= age <= 49:
            return FemaleCategory.ADULTB.value
        elif 50 <= age <= 59:
            return FemaleCategory.ADULTC.value
        elif 60 <= age <= 69:
            return FemaleCategory.ADULTD.value
        elif age >= 70:
            return FemaleCategory.SENIOR.value
    else:
        return "Unknown Category"
    
def parse_tags(data):
    """Parse tag data from RFID reader response"""
    # Upravený pattern pro přesnou shodu s formátem dat
    pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
    tags_found = []
    
    for line in data.split('\n'):
        if not line.strip():
            continue
            
        match = re.match(pattern, line.strip())
        if match:
            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                # Získat poslední 4 číslice z tag_id
                number = tag_id.strip().split()[-1]
                
                result = store_tags_to_database(
                    tag_id=tag_id.strip(),
                    number=int(number),
                    discovery_time=discovery_time,
                    last_seen_time=last_seen_time
                )
                if result:
                    tags_found.append(result)
                    info_logger.info(f'Successfully processed tag: {tag_id}')
            except Exception as e:
                error_logger.error(f'Error processing line "{line}": {str(e)}')
        else:
            error_logger.warning(f'Line did not match pattern: {line}')
    
    return tags_found

def store_tags_to_database(tag_id, number, discovery_time, last_seen_time):
    """Store tag data in the database"""
    try:
        new_tag = BackUpTag(
            tag_id=tag_id,
            number=number,
            discovery_time=discovery_time,
            last_seen_time=last_seen_time
        )
        
        db.session.add(new_tag)
        db.session.commit()
        info_logger.info(f'Stored new tag: {tag_id}')
        return new_tag
    
    except Exception as e:
        db.session.rollback()
        error_logger.error(f'Error storing/updating tag {tag_id}: {str(e)}')
        raise

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
            alien.connect()
            return jsonify({"status": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/fetch_taglist', methods=['GET'])
def fetch_taglist():
    try:
        if not alien.connected:
            return jsonify({"status": "error", "message": "Not connected to RFID reader"})
        
        taglist_response = alien.command('get Taglist')
        parse_tags(taglist_response)
        print(taglist_response)
        tags = taglist_response.split("\n")
        middle_tags = tags[1:-1]
                    
        info_logger.info('Reader successfully connected')
        return jsonify({"status": "success", "taglist": middle_tags})
    except Exception as e:
        error_logger.error('Failed to connect to reader: %s', str(e))
        return jsonify({"status": "error", "message": str(e)})

@app.route('/registration', methods=['POST'])
def register():
    try:
        data = request.json
        forename = data.get('forename')
        surname = data.get('surname')
        year = data.get('year')
        club = data.get('club')
        email = data.get('email')
        gender = data.get('gender')
        race_id = data.get('race_id')

        if not all([forename, surname, year, club, email, gender, race_id]):
            return jsonify({'error': 'All fields are required'}), 400

        try:
            year = int(year)
            race_id = int(race_id)
        except ValueError:
            return jsonify({'error': 'Year and race_id must be numbers'}), 400

        race = Race.query.get(race_id)
        if not race:
            return jsonify({'error': 'Selected race does not exist'}), 404

        category = get_category(gender, year)

        user = Users(
            forename=forename,
            surname=surname,
            year=year,
            club=club,
            email=email,
            gender=gender,
            category=category
        )
        db.session.add(user)
        db.session.commit()

        registration = Registration(
            race_id=race_id,
            user_id=user.id,
        )
        db.session.add(registration)
        db.session.commit()

        return jsonify({'message': 'User successfully registered'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error registering user'}), 400
    
@app.route('/tags', methods=['GET'])
def get_tags():
    """Get all stored tags from database"""
    try:
        tags = BackUpTag.query.all()
        tags_list = []
        for tag in tags:
            tags_list.append({
                'tag_id': tag.tag_id,
                'number': tag.number,
                'discovery_time': tag.discovery_time,
                'last_seen_time': tag.last_seen_time,
                'count': tag.count,
                'antenna': tag.antenna,
                'protocol': tag.protocol
            })
        return jsonify({'tags': tags_list})
    except Exception as e:
        error_logger.error(f'Error fetching tags: {str(e)}')
        return jsonify({'error': 'Error fetching tags'}), 500

@app.route('/races', methods=['GET'])
def get_races():
    try:
        races = Race.query.all()
        races_list = []
        for race in races:
            races_list.append({
                'id': race.id,
                'name': race.name,
                'date': race.date.strftime('%Y-%m-%d'),
                'start': race.start,
                'description': race.description
            })
        return jsonify({'races': races_list})
    except Exception as e:
        error_logger.error('Error fetching races: %s', str(e))
        return jsonify({'error': 'Error fetching races'}), 500
    
@app.route('/race/<int:race_id>', methods=['GET'])
def get_race_detail(race_id):
    try:
        race = Race.query.get(race_id)
        if not race:
            return jsonify({'error': 'Race not found'}), 404
            
        # Get registrations for this race
        registrations = Registration.query.filter_by(race_id=race_id).all()
        participants = []
        
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            if user:
                participants.append({
                    'forename': user.forename,
                    'surname': user.surname,
                    'club': user.club,
                    'category': user.category
                })
                
        race_detail = {
            'id': race.id,
            'name': race.name,
            'date': race.date.strftime('%Y-%m-%d'),
            'start': race.start,
            'description': race.description,
            'participants': participants
        }
        return jsonify({'race': race_detail})
    except Exception as e:
        error_logger.error(f'Error fetching race details: {str(e)}')
        return jsonify({'error': 'Error fetching race details'}), 500

# Catch-all route to serve React frontend
@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('index.html')

# Create tables before first request
def init_db():
    """Initialize database tables and create race results tables"""
    with app.app_context():
        db.create_all()
        setup_all_race_results_tables()
        info_logger.info('Database tables and race results tables created successfully')

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)