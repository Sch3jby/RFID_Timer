# app.py
import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request
from flask_cors import CORS
import telnetlib
import configparser
from datetime import datetime, time, timedelta
import re
from sqlalchemy import text

# Import models
from database import db
from database.user import Users
from database.backup import BackUpTag
from database.race import Race
from database.registration import Registration
from database.category import Category
from database.track import Track

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
    """
    Get appropriate category based on gender and birth year from database
    """
    current_year = datetime.now().year
    age = current_year - birth_year

    # Získáme všechny kategorie pro dané pohlaví
    categories = Category.query.filter_by(gender=gender).all()
    
    # Najdeme odpovídající kategorii podle věku
    for category in categories:
        if category.min_age <= age <= category.max_age:
            return category.category_name

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

def store_tags_to_database(tag_id, number, last_seen_time):
    """Store tag data in the database"""
    try:
        new_tag = BackUpTag(
            tag_id=tag_id,
            number=number,
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

def combine_times(time1: time, time2: time) -> time:
    """
    Combine two time objects by adding their hours, minutes, and seconds.
    
    Args:
        time1: First time object
        time2: Second time object
        
    Returns:
        Combined time object
    """
    # Convert times to timedelta for arithmetic
    delta1 = timedelta(hours=time1.hour, minutes=time1.minute, seconds=time1.second)
    delta2 = timedelta(hours=time2.hour, minutes=time2.minute, seconds=time2.second)
    
    # Add the timedeltas
    combined = delta1 + delta2
    
    # Convert back to time object
    total_seconds = int(combined.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    
    return time(hour=hours, minute=minutes, second=seconds)

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
        track_id = data.get('track_id')

        if not all([forename, surname, year, club, email, gender, race_id, track_id]):
            return jsonify({'error': 'All fields are required'}), 400

        try:
            year = int(year)
            race_id = int(race_id)
            track_id = int(track_id)
        except ValueError:
            return jsonify({'error': 'Year, race_id, and track_id must be numbers'}), 400

        race = Race.query.get(race_id)
        track = Track.query.get(track_id)
        
        if not race or not track or track.race_id != race_id:
            return jsonify({'error': 'Invalid race or track selection'}), 404

        current_year = datetime.now().year
        user_age = current_year - year

        if user_age < track.min_age or user_age > track.max_age:
            return jsonify({
                'error': f'Age not eligible for this track. Must be between {track.min_age} and {track.max_age} years old.'
            }), 400
        
        category = Category.query.filter(
            Category.track_id == track_id,
            Category.min_age <= user_age,
            Category.max_age >= user_age,
            Category.gender == gender
        ).first()
        
        if not category:
            return jsonify({
                'error': 'No suitable category found for this user'
            }), 400

        user = Users(
            forename=forename,
            surname=surname,
            year=year,
            club=club,
            email=email,
            gender=gender
        )
        db.session.add(user)
        db.session.commit()

        registration = Registration(
            user_id=user.id,
            track_id=track_id,
            race_id=race_id,
            registration_time=datetime.now() + timedelta(hours=1)
        )
        db.session.add(registration)
        db.session.commit()

        return jsonify({
            'message': 'User successfully registered', 
            'registration_id': registration.id,
            'category_name': category.category_name
        }), 201

    except Exception as e:
        db.session.rollback()
        error_logger.error(f'Error registering user: {str(e)}')
        return jsonify({'error': f'Error registering user: {str(e)}'}), 500
    
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
                'last_seen_time': tag.last_seen_time,
                'count': tag.count,
                'antenna': tag.antenna,
                'protocol': tag.protocol
            })
        return jsonify({'tags': tags_list})
    except Exception as e:
        error_logger.error(f'Error fetching tags: {str(e)}')
        return jsonify({'error': 'Error fetching tags'}), 500

@app.route('/store_results', methods=['POST'])
def store_results():
    try:
        data = request.json
        tags_raw = data.get('tags', [])  # Nyní očekáváme list
        race_id = data.get('race_id')
        track_id = data.get('track_id')

        if not race_id or not track_id:
            return jsonify({"status": "error", "message": "Race ID and Track ID are required"}), 400

        table_name = f'race_results_{race_id}'
        
        # Pattern pro extrakci dat
        pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
        
        stored_results = 0
        tags_found = []
        
        for line in tags_raw:  # Procházíme přímo list
            line = line.strip()
            if not line:
                continue
                
            match = re.match(pattern, line)
            if not match:
                continue

            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                # Extrakce čísla tagu
                number = tag_id.strip().split()[-1]
                tag_id = tag_id.strip()
                
                # Parsování časových údajů
                # discovery_datetime = datetime.strptime(discovery_time, "%Y/%m/%d %H:%M:%S.%f")
                last_seen_datetime = datetime.strptime(last_seen_time, "%Y/%m/%d %H:%M:%S.%f")
                
                # Vložení dat do databáze
                insert_sql = text(f'''
                    INSERT INTO {table_name} (
                        number,
                        tag_id, 
                        track_id, 
                        timestamp,
                        last_seen_time 
                    ) 
                    VALUES (
                        :number,
                        :tag_id, 
                        :track_id, 
                        :timestamp,
                        :last_seen_time
                    )
                ''')
                
                db.session.execute(insert_sql, {
                    'number': number,
                    'tag_id': tag_id, 
                    'track_id': track_id,
                    'timestamp': datetime.now() + timedelta(hours=1),
                    'last_seen_time': last_seen_datetime,
                })
                
                stored_results += 1
                tags_found.append(tag_id)
                
            except Exception as e:
                print(f"Error processing tag: {e}")
        
        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": f"Stored {stored_results} results for race {race_id}, track {track_id}",
            "tags_found": tags_found
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing results: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/categories', methods=['GET'])
def get_categories():
    """Get all categories from database"""
    try:
        categories = Category.query.all()
        categories_list = []
        for category in categories:
            categories_list.append({
                'id': category.id,
                'name': category.category_name,
                'gender': category.gender,
                'min_age': category.min_age,
                'max_age': category.max_age
            })
        return jsonify({'categories': categories_list})
    except Exception as e:
        return jsonify({'error': f'Error fetching categories: {str(e)}'}), 500

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

@app.route('/tracks', methods=['GET'])
def get_tracks():
    race_id = request.args.get('race_id', type=int)
    if not race_id:
        return jsonify({'error': 'Race ID is required'}), 400
    
    try:
        tracks = Track.query.filter_by(race_id=race_id).all()
        tracks_list = []
        for track in tracks:
            tracks_list.append({
                'id': track.id,
                'name': track.name,
                'distance': track.distance
            })
        return jsonify({'tracks': tracks_list})
    except Exception as e:
        error_logger.error('Error fetching tracks: %s', str(e))
        return jsonify({'error': 'Error fetching tracks'}), 500
    
@app.route('/race/<int:race_id>', methods=['GET'])
def get_race_detail(race_id):
    try:
        race = Race.query.get(race_id)
        if not race:
            return jsonify({'error': 'Race not found'}), 404
            
        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]
        
        registrations = Registration.query.filter(Registration.track_id.in_(track_ids)).all()
        participants = []

        # Group registrations by track, category, and gender
        registration_groups = {}
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            track = Track.query.get(registration.track_id)
            
            category = Category.query.filter_by(gender=user.gender, track_id=registration.track_id).\
                                    filter(Category.min_age <= (datetime.now().year - user.year), 
                                        Category.max_age >= (datetime.now().year - user.year)).\
                                    first()
            
            if user and category and track:
                key = (track.id, category.id, user.gender)
                if key not in registration_groups:
                    registration_groups[key] = []
                registration_groups[key].append((registration, user, track, category))

        plus_start_time = race.interval_time

        # Process each group separately
        for (track_id, category_id, gender), group_registrations in registration_groups.items():
            for idx, (registration, user, track, category) in enumerate(group_registrations):
                if race.start == 'I':
                    # Calculate start time
                    category_seconds = (
                        category.expected_start_time.hour * 3600 +
                        category.expected_start_time.minute * 60 +
                        category.expected_start_time.second
                    )
                    
                    plus_seconds = (
                        plus_start_time.hour * 3600 +
                        plus_start_time.minute * 60 +
                        plus_start_time.second
                    )
                    
                    total_seconds = category_seconds + (plus_seconds * (idx + 1))
                    
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    seconds = total_seconds % 60
                    
                    actual_start = time(hour=hours, minute=minutes, second=seconds)
                else:
                    actual_start = category.expected_start_time
                
                participants.append({
                    'forename': user.forename,
                    'surname': user.surname,
                    'club': user.club,
                    'category': category.category_name,
                    'track': track.name,
                    'start_time': actual_start.strftime('%H:%M:%S')
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
        return jsonify({'error': f'Error fetching race details: {str(e)}'}), 500
    
@app.route('/set_track_start_time', methods=['POST'])
def set_track_start_time():
    try:
        data = request.json
        race_id = data.get('race_id')
        track_id = data.get('track_id')
        start_time = data.get('start_time')

        if not all([race_id, track_id]):
            return jsonify({'error': 'Missing required parameters'}), 400

        # If 'auto' is passed, generate current time
        if start_time == 'auto':
            start_time = (timedelta(hours=1)+datetime.now()).strftime('%H:%M:%S')

        else:
            start_time = f"{start_time}:00"

        # Find all categories associated with this track
        categories = Category.query.filter_by(track_id=track_id).all()

        if not categories:
            return jsonify({'error': 'No categories found for this track'}), 404

        # Update the actual_start_time for all categories
        for category in categories:
            category.actual_start_time = datetime.strptime(start_time, '%H:%M:%S').time()
        
        db.session.commit()

        return jsonify({
            'message': 'Start time set successfully for all categories', 
            'start_time': start_time,
            'categories': [
                {
                    'id': cat.id, 
                    'name': cat.category_name, 
                    'gender': cat.gender
                } for cat in categories
            ]
        }), 200

    except Exception as e:
        db.session.rollback()
        error_logger.error(f'Error setting start time: {str(e)}')
        return jsonify({'error': str(e)}), 500

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