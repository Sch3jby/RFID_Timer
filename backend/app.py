# app.py
import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request, current_app
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
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
from database.login import Login

from database.race_operations import setup_all_race_results_tables

# Load configuration from config.ini
config = configparser.ConfigParser()
config.read('config.ini')

# Initialize Flask application
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"], "supports_credentials": True}})

# Initialize database
app.config['SQLALCHEMY_DATABASE_URI'] = config.get('database', 'DATABASE_URL')
app.config['SECRET_KEY'] = 'secret_key_here'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Inicializace JWT
jwt = JWTManager(app)
app.config['JWT_SECRET_KEY'] = 'jwt_secret_key_here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600

# Get the RFID configuration
hostname = config.get('alien_rfid', 'hostname')
port = config.getint('alien_rfid', 'port')

# RFID reader connection state
class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False

    def connect(self):
        self.terminal = telnetlib.Telnet(self.hostname, self.port)
        self.terminal.read_until(b'Username>', timeout=3)
        self.terminal.write(b'alien\n')
        self.terminal.read_until(b'Password>', timeout=3)
        self.terminal.write(b'password\n')
        self.terminal.read_until(b'>', timeout=3)
        self.connected = True

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

    categories = Category.query.filter_by(gender=gender).all()
    
    for category in categories:
        if category.min_age <= age <= category.max_age:
            return category.category_name

    return "Unknown Category"
    
def parse_tags(data):
    """Parse tag data from RFID reader response"""
    pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
    tags_found = []
    
    for line in data.split('\n'):
        if not line.strip():
            continue
            
        match = re.match(pattern, line.strip())
        if match:
            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                number = tag_id.strip().split()[-1]
                
                result = store_tags_to_database(
                    tag_id=tag_id.strip(),
                    number=int(number),
                    last_seen_time=last_seen_time
                )
                if result:
                    tags_found.append(result)
                    print(f'Successfully processed tag: {tag_id}')
            except Exception as e:
                print(f'Error processing line "{line}": {str(e)}')
        else:
            print(f'Line did not match pattern: {line}')
    
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
        print(f'Stored new tag: {tag_id}')
        return new_tag
    
    except Exception as e:
        db.session.rollback()
        print(f'Error storing/updating tag {tag_id}: {str(e)}')
        raise

def parse_time_with_ms(time_str):
    """Parse time string with optional milliseconds"""
    if '.' in time_str:
        time_part, ms_part = time_str.split('.')
        ms_part = ms_part.ljust(3, '0')[:3]
        
    try:
        base_time = datetime.strptime(time_part, '%H:%M:%S').time()
        return time(base_time.hour, base_time.minute, base_time.second, 
                   int(ms_part) * 1000)
    except ValueError as e:
        raise ValueError(f"Invalid time format: {str(e)}")

# Routes
@app.route('/')
def index():
    return "Welcome to the RFID Reader API!", 200

@app.route('/connect', methods=['POST'])
def connect_reader():
    try:
        if alien.connected:
            alien.disconnect()
            alien.connected = False
            return jsonify({"status": "disconnected"})
        
        try:
            alien.connect()
            alien.connected = True
            return jsonify({"status": "connected"})
        
        except Exception as e:
            alien.connected = False
            return jsonify({
                "status": "error", 
                "message": str(e)
            }), 400
    
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": "Unexpected system error"
        }), 500

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
                    
        return jsonify({"status": "success", "taglist": middle_tags}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/registration', methods=['POST'])
def registration():
    try:
        data = request.json
        firstname = data.get('firstname')
        surname = data.get('surname')
        year = data.get('year')
        club = data.get('club')
        email = data.get('email')
        gender = data.get('gender')
        race_id = data.get('race_id')
        track_id = data.get('track_id')

        if not all([firstname, surname, year, club, email, gender, race_id, track_id]):
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
            firstname=firstname,
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
        return jsonify({'tags': tags_list}), 200
    except Exception as e:
        return jsonify({'error': 'Error fetching tags'}), 500

@app.route('/store_results', methods=['POST'])
def store_results():
    try:
        data = request.json
        tags_raw = data.get('tags', [])
        race_id = data.get('race_id')
        track_id = data.get('track_id')

        if not race_id or not track_id:
            return jsonify({"status": "error", "message": "Race ID and Track ID are required"}), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        category = Category.query.filter_by(track_id=track_id).first()
        if not category:
            return jsonify({"status": "error", "message": "Category not found for this track"}), 404

        table_name = f'race_results_{race_id}'
        
        pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
        
        stored_results = 0
        tags_found = []
        
        for line in tags_raw:
            line = line.strip()
            if not line:
                continue
                
            match = re.match(pattern, line)
            if not match:
                continue

            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                number = tag_id.strip().split()[-1]
                tag_id = tag_id.strip()
                
                last_seen_datetime = datetime.strptime(last_seen_time, "%Y/%m/%d %H:%M:%S.%f")
                current_time = (datetime.now() + timedelta(hours=1))

                offset = last_seen_datetime - current_time
                last_seen_datetime = last_seen_datetime - offset

                registration = Registration.query.filter_by(
                    race_id=race_id, 
                    track_id=track_id, 
                    number=number
                ).first()

                if not registration:
                    continue

                if not track.actual_start_time:
                    return jsonify({"status": "error", "message": "Actual start time not set for category"}), 400
                
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour, 
                    minutes=registration.user_start_time.minute, 
                    seconds=registration.user_start_time.second
                )
                category_start_delta = timedelta(
                    hours=track.actual_start_time.hour, 
                    minutes=track.actual_start_time.minute, 
                    seconds=track.actual_start_time.second
                )

                total_seconds = user_start_delta.seconds + category_start_delta.seconds
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)

                user_start_time = time(
                    hour=hours % 24,
                    minute=minutes,
                    second=seconds
                )

                race_start_datetime = datetime.combine(
                    last_seen_datetime.date(), 
                    user_start_time
                )

                min_lap_duration = timedelta(
                    hours=track.fastest_possible_time.hour, 
                    minutes=track.fastest_possible_time.minute, 
                    seconds=track.fastest_possible_time.second
                )

                last_entry = db.session.execute(
                    text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
                    {'number': number}
                ).fetchone()

                if last_entry:
                    if last_entry.lap_number >= track.number_of_laps:
                        continue

                if not last_entry:
                    if last_seen_datetime <= race_start_datetime + min_lap_duration:
                        continue
                    lap_number = 1
                else:
                    last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
                    
                    if last_seen_datetime <= last_tag_time + min_lap_duration:
                        continue
                    
                    lap_number = last_entry.lap_number + 1

                insert_sql = text(f'''
                    INSERT INTO {table_name} (
                        number,
                        tag_id, 
                        track_id, 
                        timestamp,
                        last_seen_time,
                        lap_number
                    ) 
                    VALUES (
                        :number,
                        :tag_id, 
                        :track_id, 
                        :timestamp,
                        :last_seen_time,
                        :lap_number
                    )
                ''')
                
                db.session.execute(insert_sql, {
                    'number': number,
                    'tag_id': tag_id, 
                    'track_id': track_id,
                    'timestamp': current_time,
                    'last_seen_time': last_seen_datetime,
                    'lap_number': lap_number
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
    
@app.route('/manual_result_store', methods=['POST'])
def manual_result_store():
    try:
        data = request.json
        number = data.get('number')
        race_id = data.get('race_id')
        track_id = data.get('track_id')
        timestamp_str = data.get('timestamp')
        status = data.get('status')

        if not number or not race_id or not track_id:
            return jsonify({
                "status": "error", 
                "message": "Number, Race ID, and Track ID are required"
            }), 400

        valid_statuses = ['None', 'DNF', 'DNS', 'DSQ']
        if status and status not in valid_statuses:
            return jsonify({
                "status": "error",
                "message": "Invalid status. Must be one of: None, DNF, DNS, DSQ"
            }), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        registration = Registration.query.filter_by(
            race_id=race_id, 
            track_id=track_id, 
            number=number
        ).first()
        
        if not registration:
            return jsonify({"status": "error", "message": "Registration not found"}), 404

        if timestamp_str:
            try:
                timestamp = datetime.combine(
                    datetime.now().date(), 
                    (datetime.strptime(timestamp_str, "%H:%M:%S") + timedelta(milliseconds=1)).time()
                )
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid timestamp format. Use HH:MM:SS."
                }), 400
        else:
            timestamp = datetime.now() + timedelta(hours=1)

        table_name = f'race_results_{race_id}'

        last_entry = db.session.execute(
            text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
            {'number': number}
        ).fetchone()

        min_lap_duration = timedelta(
            hours=track.fastest_possible_time.hour,
            minutes=track.fastest_possible_time.minute,
            seconds=track.fastest_possible_time.second
        )

        user_start_delta = timedelta(
            hours=registration.user_start_time.hour,
            minutes=registration.user_start_time.minute,
            seconds=registration.user_start_time.second
        )
        category_start_delta = timedelta(
            hours=track.actual_start_time.hour,
            minutes=track.actual_start_time.minute,
            seconds=track.actual_start_time.second
        )

        total_seconds = user_start_delta.seconds + category_start_delta.seconds
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        user_start_time = time(
            hour=hours % 24,
            minute=minutes,
            second=seconds
        )

        race_start_datetime = datetime.combine(timestamp.date(), user_start_time)

        if last_entry:
            if last_entry.lap_number >= track.number_of_laps:
                return jsonify({
                    "status": "error",
                    "message": "Maximum number of laps already recorded"
                }), 400

            last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
            
            if status not in ['DNS', 'DSQ', 'DNF']:
                if timestamp <= last_tag_time + min_lap_duration:
                    return jsonify({
                        "status": "error",
                        "message": "Time between laps is less than minimum allowed"
                    }), 400
                    
            lap_number = last_entry.lap_number + 1
        else:
            if timestamp <= race_start_datetime + min_lap_duration:
                return jsonify({
                    "status": "error",
                    "message": "Time from race start is less than minimum allowed"
                }), 400
            lap_number = 1

        insert_sql = text(f'''
            INSERT INTO {table_name} (
                number,
                tag_id,
                track_id,
                timestamp,
                last_seen_time,
                lap_number,
                status
            ) 
            VALUES (
                :number,
                :tag_id,
                :track_id,
                :timestamp,
                :last_seen_time,
                :lap_number,
                :status
            )
        ''')
        
        tag_id = f"manually added Tag: {number}"
        
        db.session.execute(insert_sql, {
            'number': number,
            'tag_id': tag_id,
            'track_id': track_id,
            'timestamp': timestamp,
            'last_seen_time': timestamp,
            'lap_number': lap_number,
            'status': status if status != 'None' else None
        })

        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "message": f"Manually stored result for race {race_id}, track {track_id}, number {number}",
            "tag_id": tag_id
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing manual result: {e}")
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
                'max_age': category.max_age,
                'track_id': category.track_id
            })
        return jsonify({'categories': categories_list}), 200
    except Exception as e:
        return jsonify({'error': f'Error fetching categories: {str(e)}'}), 500

@app.route('/races', methods=['GET'])
def get_races():
    try:
        races = Race.query.all()
        return jsonify({
            "status": "success",
            "races": [{
                "id": race.id,
                "name": race.name,
                "date": race.date.strftime("%Y-%m-%d"),
                "start": race.start,
                "interval_time": race.interval_time.strftime("%H:%M:%S") if race.interval_time else None,
                "description": race.description,
                "tracks": [{
                    "id": track.id,
                    "name": track.name,
                    "distance": track.distance,
                    "min_age": track.min_age,
                    "max_age": track.max_age,
                    "fastest_possible_time": track.fastest_possible_time.strftime("%H:%M:%S"),
                    "number_of_laps": track.number_of_laps,
                    "expected_start_time": track.expected_start_time.strftime("%H:%M:%S"),
                    "categories": [{
                        "id": cat.id,
                        "category_name": cat.category_name,
                        "min_age": cat.min_age,
                        "max_age": cat.max_age,
                        "min_number": cat.min_number,
                        "max_number": cat.max_number,
                        "gender": cat.gender
                    } for cat in track.categories]
                } for track in race.tracks]
            } for race in races]
        })

    except Exception as e:
        print(f"Error fetching races: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/race/add', methods=['POST'])
def add_race():
    try:
        data = request.json
        
        required_fields = ['name', 'date', 'start']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "status": "error",
                    "message": f"Field '{field}' is required"
                }), 400

        try:
            date = datetime.strptime(data['date'], "%Y-%m-%d").date()
            base_race_id = int(date.strftime("%y%m%d"))
            
            existing_races = Race.query.filter(
                Race.id.between(base_race_id * 10, (base_race_id * 10) + 9)
            ).all()
            
            if not existing_races:
                sequence = 1
            else:
                sequences = [race.id % 10 for race in existing_races]
                sequence = max(sequences) + 1
                
            if sequence > 9:
                return jsonify({
                    "status": "error",
                    "message": f"Maximum number of races (9) for date {data['date']} reached"
                }), 400
                
            race_id = (base_race_id * 10) + sequence
            
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "Invalid date format. Use YYYY-MM-DD"
            }), 400

        if data['start'] not in ['M', 'I']:
            return jsonify({
                "status": "error",
                "message": "Start must be either 'M' (mass start) or 'I' (interval start)"
            }), 400

        new_race = Race(
            id=race_id,
            name=data['name'],
            date=date,
            start=data['start'],
            description=data.get('description', '')
        )

        if data['start'] == 'I' and data.get('interval_time'):
            try:
                new_race.interval_time = datetime.strptime(data['interval_time'], "%H:%M:%S").time()
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid interval_time format. Use HH:MM:SS"
                }), 400

        db.session.add(new_race)
        db.session.flush()

        new_race.results_table_name = f'race_results_{race_id}'
        create_results_table = text(f"""
            CREATE TABLE {new_race.results_table_name} (
                id SERIAL PRIMARY KEY,
                number INTEGER NOT NULL,
                tag_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                lap_number INTEGER DEFAULT 1,
                track_id INTEGER NOT NULL,
                last_seen_time TIMESTAMP,
                status VARCHAR(5)
            )
        """)
        db.session.execute(create_results_table)

        if 'tracks' in data:
            for track_data in data['tracks']:
                track_id = int(f"{race_id}{str(track_data['distance']).zfill(2)}")
                
                track = Track(
                    id=track_id,
                    name=track_data['name'],
                    distance=track_data['distance'],
                    min_age=track_data['min_age'],
                    max_age=track_data['max_age'],
                    fastest_possible_time=datetime.strptime(track_data['fastest_possible_time'], "%H:%M:%S").time(),
                    number_of_laps=track_data['number_of_laps'],
                    expected_start_time=datetime.strptime(track_data['expected_start_time'], "%H:%M:%S").time(),
                    race_id=race_id
                )
                db.session.add(track)
                db.session.flush()

                if 'categories' in track_data:
                    for cat_data in track_data['categories']:
                        category = Category(
                            category_name=cat_data['category_name'],
                            min_age=cat_data['min_age'],
                            max_age=cat_data['max_age'],
                            min_number=cat_data['min_number'],
                            max_number=cat_data['max_number'],
                            gender=cat_data['gender'],
                            track_id=track_id
                        )
                        db.session.add(category)

        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Race created successfully",
            "race_id": race_id
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error creating race: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/race/<int:race_id>/update', methods=['PUT'])
def update_race(race_id):
    try:
        data = request.json
        race = Race.query.get(race_id)
        
        if not race:
            return jsonify({
                "status": "error",
                "message": "Race not found"
            }), 404

        new_date = datetime.strptime(data['date'], "%Y-%m-%d").date()
        new_base_id = int(new_date.strftime("%y%m%d")) * 10
        if race_id // 10 != new_base_id // 10:
            return jsonify({
                "status": "error",
                "message": "Cannot change race date as it would change the race ID"
            }), 400

        race.name = data['name']
        race.date = new_date
        race.start = data['start']
        race.description = data.get('description', '')

        if data['start'] == 'I' and data.get('interval_time'):
            race.interval_time = datetime.strptime(data['interval_time'], "%H:%M:%S").time()

        existing_track_ids = {track.id for track in race.tracks}
        updated_track_ids = set()

        for track_data in data.get('tracks', []):
            track_id = int(f"{race_id}{str(track_data['distance']).zfill(2)}")
            
            if 'id' in track_data:
                track = Track.query.get(track_data['id'])
                if track and track.race_id == race_id:
                    track.name = track_data['name']
                    track.distance = track_data['distance']
                    track.min_age = track_data['min_age']
                    track.max_age = track_data['max_age']
                    track.fastest_possible_time = datetime.strptime(track_data['fastest_possible_time'], "%H:%M:%S").time()
                    track.number_of_laps = track_data['number_of_laps']
                    track.expected_start_time = datetime.strptime(track_data['expected_start_time'], "%H:%M:%S").time()
                    updated_track_ids.add(track.id)
            else:
                track = Track(
                    id=track_id,
                    name=track_data['name'],
                    distance=track_data['distance'],
                    min_age=track_data['min_age'],
                    max_age=track_data['max_age'],
                    fastest_possible_time=datetime.strptime(track_data['fastest_possible_time'], "%H:%M:%S").time(),
                    number_of_laps=track_data['number_of_laps'],
                    expected_start_time=datetime.strptime(track_data['expected_start_time'], "%H:%M:%S").time(),
                    race_id=race_id
                )
                db.session.add(track)
                db.session.flush()

            if track:
                existing_category_ids = {cat.id for cat in track.categories}
                updated_category_ids = set()

                for cat_data in track_data.get('categories', []):
                    if 'id' in cat_data:
                        category = Category.query.get(cat_data['id'])
                        if category and category.track_id == track.id:
                            category.category_name = cat_data['category_name']
                            category.min_age = cat_data['min_age']
                            category.max_age = cat_data['max_age']
                            category.min_number = cat_data['min_number']
                            category.max_number = cat_data['max_number']
                            category.gender = cat_data['gender']
                            updated_category_ids.add(category.id)
                    else:
                        category = Category(
                            category_name=cat_data['category_name'],
                            min_age=cat_data['min_age'],
                            max_age=cat_data['max_age'],
                            min_number=cat_data['min_number'],
                            max_number=cat_data['max_number'],
                            gender=cat_data['gender'],
                            track_id=track_id
                        )
                        db.session.add(category)

                categories_to_delete = existing_category_ids - updated_category_ids
                if categories_to_delete:
                    Category.query.filter(Category.id.in_(categories_to_delete)).delete(synchronize_session=False)

        tracks_to_delete = existing_track_ids - updated_track_ids
        if tracks_to_delete:
            Track.query.filter(Track.id.in_(tracks_to_delete)).delete(synchronize_session=False)

        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Race updated successfully"
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error updating race: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

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
        return jsonify({'tracks': tracks_list}), 200
    except Exception as e:
        return jsonify({'error': 'Error fetching tracks'}), 500
    
@app.route('/race/<int:race_id>', methods=['GET'])
def get_race_detail(race_id):
    try:
        with db.session() as session:
            race = session.get(Race, race_id)
        if not race:
            return jsonify({'error': 'Race not found'}), 404
            
        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]
        
        registrations = Registration.query.filter(Registration.track_id.in_(track_ids)).all()
        
        participant_details = []

        category_number_counters = {}
        
        plus_start_time = race.interval_time
        
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            track = Track.query.get(registration.track_id)
            
            category = Category.query.filter_by(gender=user.gender, track_id=registration.track_id).\
                                    filter(Category.min_age <= (datetime.now().year - user.year), 
                                        Category.max_age >= (datetime.now().year - user.year)).\
                                    first()
            
            if not (user and category and track):
                continue

            category_gender_key = (category.id, user.gender)

            if category_gender_key not in category_number_counters:
                category_number_counters[category_gender_key] = 0

            category_number_counters[category_gender_key] += 1
            
            user_number = category.min_number + category_number_counters[category_gender_key] - 1

            participant_details.append({
                'registration_id': registration.id,
                'category_id': category.id,
                'gender': user.gender,
                'number': user_number,
                'user_id': user.id,
                'track_id': track.id
            })
        
        sorted_participants = sorted(
            participant_details, 
            key=lambda x: (x['category_id'], x['number'])
        )
        
        final_participant_details = []
        for idx, participant in enumerate(sorted_participants):
            user = Users.query.get(participant['user_id'])
            track = Track.query.get(participant['track_id'])
            
            category = Category.query.filter_by(
                gender=participant['gender'], 
                track_id=participant['track_id']
            ).filter(
                Category.min_age <= (datetime.now().year - user.year), 
                Category.max_age >= (datetime.now().year - user.year)
            ).first()
            
            if race.start == 'I':
                plus_seconds = (
                    plus_start_time.hour * 3600 +
                    plus_start_time.minute * 60 +
                    plus_start_time.second
                )
                
                total_seconds = (
                    track.expected_start_time.hour * 3600 +
                    track.expected_start_time.minute * 60 +
                    track.expected_start_time.second +
                    (plus_seconds * (idx+1))
                )
                
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                
                actual_start = time(hour=hours, minute=minutes, second=seconds)
            else:
                actual_start = track.expected_start_time

            final_participant_details.append({
                'number': participant['number'],
                'firstname': user.firstname,
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
            'participants': final_participant_details
        }
        return jsonify({'race': race_detail}), 200
        
    except Exception as e:
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
        
        track = Track.query.filter_by(id=track_id).first()

        if not track:
            return jsonify({
                'success': False,
                'error': 'No track found'
            }), 404

        if start_time == 'auto':
            start_time = (timedelta(hours=1)+datetime.now()).strftime('%H:%M:%S')
        else:
            start_time = f"{start_time}:00"

        track.actual_start_time = datetime.strptime(start_time, '%H:%M:%S').time()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Start time set successfully', 
            'start_time': start_time
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/confirm_lineup', methods=['POST'])
def confirm_lineup():
    try:
        data = request.json
        race_id = data.get('race_id')
        
        race = Race.query.get(race_id)
        if not race:
            return jsonify({'error': 'Race not found'}), 404
        
        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]
        
        registrations = Registration.query.filter(Registration.track_id.in_(track_ids)).all()
        
        participant_details = []

        category_number_counters = {}
        
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            track = Track.query.get(registration.track_id)
            
            category = Category.query.filter_by(gender=user.gender, track_id=registration.track_id).\
                                    filter(Category.min_age <= (datetime.now().year - user.year), 
                                        Category.max_age >= (datetime.now().year - user.year)).\
                                    first()
            
            if not (user and category and track):
                continue

            category_gender_key = (category.id, user.gender)

            if category_gender_key not in category_number_counters:
                category_number_counters[category_gender_key] = 0

            category_number_counters[category_gender_key] += 1
            
            user_number = category.min_number + category_number_counters[category_gender_key] - 1

            participant_details.append({
                'registration_id': registration.id,
                'category_id': category.id,
                'gender': user.gender,
                'number': user_number,
                'user_id': user.id,
                'track_id': track.id,
                'category': category,
                'user': user,
                'track': track
            })
        
        sorted_participants = sorted(
            participant_details, 
            key=lambda x: (x['category_id'], x['number'])
        )
        
        for idx, participant in enumerate(sorted_participants):
            registration = Registration.query.get(participant['registration_id'])
            
            if race.start == 'I':
                plus_start_time = race.interval_time
                
                plus_seconds = (
                    plus_start_time.hour * 3600 +
                    plus_start_time.minute * 60 +
                    plus_start_time.second
                )
                
                total_seconds = (
                    plus_seconds * (idx+1)
                )
                
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                
                actual_start = time(hour=hours, minute=minutes, second=seconds)
            else:
                actual_start = time(hour=0, minute=0, second=0)

            registration.number = participant['number']
            registration.user_start_time = actual_start
        
        db.session.commit()
        
        return jsonify({
            'message': 'Lineup confirmed successfully', 
            'tracks': [{'id': track.id, 'name': track.name} for track in tracks]
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error confirming lineup: {str(e)}'}), 500
    
@app.route('/race/<int:race_id>/results', methods=['GET'])
def get_race_results(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS.MS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_track_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY track_name) as min_track_time,
                    ROW_NUMBER() OVER (
                        PARTITION BY track_name 
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_track
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            ),
            results_with_category_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY category_name, track_name) as min_category_time,
                    ROW_NUMBER() OVER (
                        PARTITION BY category_name, track_name
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_category
                FROM results_with_track_time
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_track::text 
                END as position_track,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_category::text 
                END as position_category,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_track_time) || ' seconds')::interval,
                        'HH24:MI:SS.MS'
                    )
                END as behind_time_track,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_category_time) || ' seconds')::interval,
                        'HH24:MI:SS.MS'
                    )
                END as behind_time_category
            FROM results_with_category_time
            ORDER BY 
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_track': row.position_track if row.race_time is not None else '-',
                'position_category': row.position_category if row.race_time is not None else '-',
                'behind_time_track': row.behind_time_track or ' ',
                'behind_time_category': row.behind_time_category or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500
    
@app.route('/race/<int:race_id>/results/by-category', methods=['GET'])
def get_race_results_by_category(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_category_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY category_name, track_name) as min_category_time,
                    RANK() OVER (
                        PARTITION BY category_name, track_name
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_category
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_category::text 
                END as position_category,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_category_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_category
            FROM results_with_category_time
            ORDER BY 
                category_name,
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_category': row.position_category if row.race_time is not None else '-',
                'behind_time_category': row.behind_time_category or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results by category: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500

@app.route('/race/<int:race_id>/results/by-track', methods=['GET'])
def get_race_results_by_track(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_track_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY track_name) as min_track_time,
                    RANK() OVER (
                        PARTITION BY track_name 
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_track
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_track::text 
                END as position_track,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_track_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_track
            FROM results_with_track_time
            ORDER BY 
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_track': row.position_track if row.race_time is not None else '-',
                'behind_time_track': row.behind_time_track or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results by track: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500
    
@app.route('/race/<int:race_id>/racer/<int:number>/laps', methods=['GET'])
def get_runner_laps(race_id, number):
    try:
        table_name = f'race_results_{race_id}'
        
        query = text(f"""
            WITH runner_laps AS (
                SELECT 
                    r.lap_number,
                    r.timestamp,
                    reg.user_start_time,
                    t.actual_start_time
                FROM {table_name} r
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN track t ON t.id = reg.track_id
                WHERE r.number = :number
                ORDER BY r.lap_number
            ),
            lap_times AS (
                SELECT 
                    lap_number,
                    timestamp,
                    CASE 
                        WHEN lap_number = 1 THEN
                            timestamp - (date_trunc('day', timestamp) + 
                                actual_start_time::time + 
                                user_start_time::interval)
                        ELSE
                            timestamp - LAG(timestamp) OVER (ORDER BY lap_number)
                    END as lap_time,
                    timestamp - (date_trunc('day', timestamp) + 
                        actual_start_time::time + 
                        user_start_time::interval) as total_time
                FROM runner_laps
            )
            SELECT 
                lap_number,
                TO_CHAR(timestamp, 'HH24:MI:SS') as timestamp,
                TO_CHAR(lap_time, 'HH24:MI:SS.MS') as lap_time,
                TO_CHAR(total_time, 'HH24:MI:SS.MS') as total_time
            FROM lap_times
            ORDER BY lap_number;
        """)
        
        results = db.session.execute(query, {
            'race_id': race_id,
            'number': number
        }).fetchall()

        if not results:
            return jsonify({'error': 'No lap data found'}), 404

        laps = [{
            'lap_number': row.lap_number,
            'timestamp': row.timestamp,
            'lap_time': row.lap_time,
            'total_time': row.total_time
        } for row in results]
        
        return jsonify({'laps': laps}), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching runner laps: {str(e)}')
        return jsonify({'error': 'Failed to fetch runner laps'}), 500

@app.route('/race/<int:race_id>/result/update', methods=['POST'])
def update_race_result(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        track_id = data.get('track_id')
        new_time = data.get('time')
        status = data.get('status')
        last_seen_time = data.get('last_seen_time')

        if not number or not track_id:
            return jsonify({'error': 'Missing required fields'}), 400

        track = Track.query.get(track_id)
        registration = Registration.query.filter_by(
            track_id=track_id, 
            number=number
        ).first()

        if not track or not registration:
            return jsonify({'error': 'Track or registration not found'}), 404

        table_name = f'race_results_{race_id}'
        updates = []
        params = {'number': number}

        if status is not None or 'status' in data:
            status_update_query = text(f"""
                UPDATE {table_name}
                SET status = :status
                WHERE number = :number
            """)
            db.session.execute(status_update_query, {
                'status': status,
                'number': number
            })

        if last_seen_time:
            try:
                time_obj = parse_time_with_ms(last_seen_time)
                full_last_seen = datetime.combine(datetime.now().date(), time_obj)
                
                updates.append("last_seen_time = :last_seen_time")
                params['last_seen_time'] = full_last_seen
                
                if not new_time:
                    updates.append("timestamp = :timestamp")
                    params['timestamp'] = full_last_seen
                    
            except ValueError as e:
                return jsonify({'error': f'Invalid time format for last_seen_time: {str(e)}'}), 400

        if new_time:
            try:
                time_obj = parse_time_with_ms(new_time)
                
                actual_start_time = track.actual_start_time
                user_start_time = registration.user_start_time
                
                if not actual_start_time or not user_start_time:
                    return jsonify({'error': 'Missing start time information'}), 400

                actual_delta = timedelta(hours=actual_start_time.hour,
                                    minutes=actual_start_time.minute,
                                    seconds=actual_start_time.second,
                                    microseconds=actual_start_time.microsecond)
                
                user_delta = timedelta(hours=user_start_time.hour,
                                    minutes=user_start_time.minute,
                                    seconds=user_start_time.second,
                                    microseconds=user_start_time.microsecond)
                
                time_delta = timedelta(hours=time_obj.hour,
                                    minutes=time_obj.minute,
                                    seconds=time_obj.second,
                                    microseconds=time_obj.microsecond)
                
                total_time = actual_delta + user_delta + time_delta
                
                current_date = datetime.now().date()
                final_timestamp = datetime.combine(current_date, datetime.min.time()) + total_time
                
                updates.append("timestamp = :new_timestamp")
                params['new_timestamp'] = final_timestamp
                
                updates.append("last_seen_time = :new_last_seen_time")
                params['new_last_seen_time'] = final_timestamp
                
            except ValueError as e:
                return jsonify({'error': f'Invalid time format for new_time: {str(e)}'}), 400

        if updates:
            update_query = text(f"""
                UPDATE {table_name}
                SET {', '.join(updates)}
                WHERE number = :number
                AND lap_number = (
                    SELECT MAX(lap_number)
                    FROM {table_name}
                    WHERE number = :number
                )
            """)
            
            db.session.execute(update_query, params)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Update successful',
            'timestamp': params.get('new_timestamp') or params.get('timestamp'),
            'last_seen_time': params.get('new_last_seen_time') or params.get('last_seen_time')
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating result: {str(e)}')
        return jsonify({'error': str(e)}), 500
    
@app.route('/race/<int:race_id>/lap/update', methods=['POST'])
def update_lap_time(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        lap_number = data.get('lap_number')
        lap_time = data.get('lap_time')
        timestamp = data.get('timestamp')

        if not number or not lap_number:
            return jsonify({'error': 'Missing required fields'}), 400

        if not lap_time and not timestamp:
            return jsonify({'error': 'Either lap_time or timestamp must be provided'}), 400

        table_name = f'race_results_{race_id}'

        registration = Registration.query.filter_by(
            race_id=race_id,
            number=number
        ).first()

        if not registration:
            return jsonify({'error': 'Runner not found'}), 404

        track = Track.query.get(registration.track_id)
        if not track:
            return jsonify({'error': 'Track not found'}), 404

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()
        
        target_lap = None
        for lap in laps:
            if lap.lap_number == lap_number:
                target_lap = lap
                break

        if not target_lap:
            return jsonify({'error': 'Lap not found'}), 404

        if timestamp:
            try:
                time_obj = parse_time_with_ms(timestamp)
                update_query = text(f"""
                    UPDATE {table_name}
                    SET 
                        timestamp = DATE(timestamp) + time :time_obj,
                        last_seen_time = DATE(timestamp) + time :time_obj
                    WHERE number = :number
                    AND lap_number = :lap_number
                    RETURNING timestamp
                """)
                result = db.session.execute(update_query, {
                    'time_obj': time_obj,
                    'number': number,
                    'lap_number': lap_number
                }).first()
                
                if not result:
                    return jsonify({'error': 'Failed to update timestamp'}), 500
                
                new_timestamp = result[0]

            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

        else:
            try:
                time_obj = parse_time_with_ms(lap_time)
            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

            if lap_number == 1:
                actual_start = datetime.combine(target_lap.timestamp.date(), track.actual_start_time)
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour,
                    minutes=registration.user_start_time.minute,
                    seconds=registration.user_start_time.second,
                    microseconds=registration.user_start_time.microsecond
                )
                
                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                new_timestamp = actual_start + user_start_delta + time_delta
            else:
                prev_lap = None
                for lap in laps:
                    if lap.lap_number == lap_number - 1:
                        prev_lap = lap
                        break
                
                if not prev_lap:
                    return jsonify({'error': 'Previous lap not found'}), 404

                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                new_timestamp = prev_lap.timestamp + time_delta

            update_query = text(f"""
                UPDATE {table_name}
                SET 
                    timestamp = :new_timestamp,
                    last_seen_time = :new_timestamp
                WHERE number = :number
                AND lap_number = :lap_number
            """)
            
            db.session.execute(update_query, {
                'new_timestamp': new_timestamp,
                'number': number,
                'lap_number': lap_number
            })

        subsequent_laps = [lap for lap in laps if lap.lap_number > lap_number]
        for next_lap in subsequent_laps:
            query = text(f"""
                SELECT 
                    timestamp - LAG(timestamp) OVER (ORDER BY lap_number) as lap_time
                FROM {table_name}
                WHERE number = :number
                AND lap_number = :lap_number
            """)
            
            result = db.session.execute(query, {
                'number': number,
                'lap_number': next_lap.lap_number
            }).first()
            
            if result and result.lap_time:
                update_query = text(f"""
                    UPDATE {table_name}
                    SET 
                        timestamp = (
                            SELECT timestamp + :lap_time
                            FROM {table_name}
                            WHERE number = :number
                            AND lap_number = :prev_lap_number
                        ),
                        last_seen_time = (
                            SELECT timestamp + :lap_time
                            FROM {table_name}
                            WHERE number = :number
                            AND lap_number = :prev_lap_number
                        )
                    WHERE number = :number
                    AND lap_number = :lap_number
                """)
                
                db.session.execute(update_query, {
                    'lap_time': result.lap_time,
                    'number': number,
                    'prev_lap_number': next_lap.lap_number - 1,
                    'lap_number': next_lap.lap_number
                })

        final_lap_query = text(f"""
            UPDATE {table_name}
            SET 
                last_seen_time = timestamp,
                timestamp = timestamp
            WHERE number = :number
            AND lap_number = (
                SELECT MAX(lap_number)
                FROM {table_name}
                WHERE number = :number
            )
        """)
        
        db.session.execute(final_lap_query, {'number': number})
        
        db.session.commit()
        
        return jsonify({
            'message': 'Lap updated successfully',
            'new_timestamp': new_timestamp.strftime('%H:%M:%S.%f')[:-3]
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating lap: {str(e)}')
        return jsonify({'error': str(e)}), 500
    
@app.route('/race/<int:race_id>/lap/delete', methods=['POST'])
def delete_lap(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        lap_number = data.get('lap_number')

        if not number or not lap_number:
            return jsonify({'error': 'Missing required fields'}), 400

        table_name = f'race_results_{race_id}'

        registration = Registration.query.filter_by(
            race_id=race_id,
            number=number
        ).first()

        if not registration:
            return jsonify({'error': 'Runner not found'}), 404

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()
        
        target_lap = None
        for lap in laps:
            if lap.lap_number == lap_number:
                target_lap = lap
                break

        if not target_lap:
            return jsonify({'error': 'Lap not found'}), 404

        delete_query = text(f"""
            DELETE FROM {table_name}
            WHERE number = :number
            AND lap_number = :lap_number
        """)
        
        db.session.execute(delete_query, {
            'number': number,
            'lap_number': lap_number
        })

        subsequent_laps = [lap for lap in laps if lap.lap_number > lap_number]
        
        if subsequent_laps:
            prev_lap_query = text(f"""
                SELECT timestamp
                FROM {table_name}
                WHERE number = :number
                AND lap_number < :deleted_lap_number
                ORDER BY lap_number DESC
                LIMIT 1
            """)
            
            prev_lap = db.session.execute(prev_lap_query, {
                'number': number,
                'deleted_lap_number': lap_number
            }).first()

            prev_timestamp = prev_lap.timestamp if prev_lap else None

            for next_lap in subsequent_laps:
                lap_time_query = text(f"""
                    SELECT 
                        timestamp - LAG(timestamp) OVER (ORDER BY lap_number) as lap_time
                    FROM {table_name}
                    WHERE number = :number
                    AND lap_number = :lap_number
                """)
                
                result = db.session.execute(lap_time_query, {
                    'number': number,
                    'lap_number': next_lap.lap_number
                }).first()

                if result and result.lap_time and prev_timestamp:
                    update_query = text(f"""
                        UPDATE {table_name}
                        SET 
                            timestamp = :new_timestamp,
                            last_seen_time = :new_timestamp
                        WHERE number = :number
                        AND lap_number = :lap_number
                    """)

                    new_timestamp = prev_timestamp + result.lap_time
                    
                    db.session.execute(update_query, {
                        'new_timestamp': new_timestamp,
                        'number': number,
                        'lap_number': next_lap.lap_number
                    })

                    prev_timestamp = new_timestamp

        final_lap_query = text(f"""
            UPDATE {table_name}
            SET last_seen_time = timestamp
            WHERE number = :number
            AND lap_number = (
                SELECT MAX(lap_number)
                FROM {table_name}
                WHERE number = :number
            )
        """)
        
        db.session.execute(final_lap_query, {'number': number})

        db.session.commit()
        
        return jsonify({'message': 'Lap deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting lap: {str(e)}')
        return jsonify({'error': str(e)}), 500
    
@app.route('/race/<int:race_id>/lap/add', methods=['POST'])
def add_manual_lap(race_id):
    try:
        data = request.json
        number = data.get('number')
        track_id = data.get('track_id')
        lap_number = data.get('lap_number')
        timestamp_str = data.get('timestamp')
        time_str = data.get('time')

        if not number or not track_id or not lap_number:
            return jsonify({
                "status": "error", 
                "message": "Number, Track ID, and Lap Number are required"
            }), 400

        if not time_str and not timestamp_str:
            return jsonify({'error': 'Either time or timestamp must be provided'}), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        registration = Registration.query.filter_by(
            race_id=race_id, 
            track_id=track_id, 
            number=number
        ).first()
        
        if not registration:
            return jsonify({"status": "error", "message": "Registration not found"}), 404

        table_name = f'race_results_{race_id}'

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()

        if timestamp_str:
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    return jsonify({
                        "status": "error",
                        "message": "Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM:SS.fff"
                    }), 400
        else:
            try:
                time_obj = parse_time_with_ms(time_str)
            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

            if lap_number == 1:
                actual_start = datetime.combine(
                    datetime.strptime(data.get('date'), "%Y-%m-%d").date(),
                    track.actual_start_time
                )
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour,
                    minutes=registration.user_start_time.minute,
                    seconds=registration.user_start_time.second,
                    microseconds=registration.user_start_time.microsecond
                )
                
                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                timestamp = actual_start + user_start_delta + time_delta
            else:
                prev_lap = None
                for lap in laps:
                    if lap.lap_number == lap_number - 1:
                        prev_lap = lap
                        break
                
                if not prev_lap:
                    return jsonify({'error': 'Previous lap not found'}), 404

                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                timestamp = prev_lap.timestamp + time_delta

        tag_id = f"manually added Tag: {number}"
        
        insert_sql = text(f'''
            INSERT INTO {table_name} (
                number,
                tag_id,
                track_id,
                timestamp,
                last_seen_time,
                lap_number
            ) 
            VALUES (
                :number,
                :tag_id,
                :track_id,
                :timestamp,
                :last_seen_time,
                :lap_number
            )
        ''')
        
        db.session.execute(insert_sql, {
            'number': number,
            'tag_id': tag_id,
            'track_id': track_id,
            'timestamp': timestamp,
            'last_seen_time': timestamp,
            'lap_number': lap_number
        })

        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "message": f"Manually stored result for race {race_id}, track {track_id}, number {number}",
            "tag_id": tag_id,
            "timestamp": timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing manual result: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route('/race/<int:race_id>/startlist', methods=['GET'])
def get_race_startlist(race_id):
    try:
        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]
        
        registrations = (
            db.session.query(Registration, Users, Track)
            .join(Users, Registration.user_id == Users.id)
            .join(Track, Registration.track_id == Track.id)
            .filter(Registration.race_id == race_id)
            .all()
        )
        
        start_list = []
        for reg, user, track in registrations:
            start_list.append({
                'registration_id': reg.id,
                'user_id': user.id,
                'firstname': user.firstname,
                'surname': user.surname,
                'club': user.club,
                'number': '---' if reg.number is None else reg.number,
                'track_id': track.id,
                'track_name': track.name,
                'user_start_time': '--:--:--' if reg.user_start_time is None else reg.user_start_time.strftime('%H:%M:%S')
            })
        
        start_list.sort(key=lambda x: x['number'] if x['number'] != '---' else float('inf'))
        
        return jsonify({'startList': start_list}), 200
    except Exception as e:
        return jsonify({'error': f'Error fetching start list: {str(e)}'}), 500

@app.route('/race/<int:race_id>/startlist/update/user', methods=['POST'])
def update_startlist_user(race_id):
    try:
        data = request.json
        user = Users.query.get(data['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.firstname = data['firstname']
        user.surname = data['surname']
        user.club = data['club']
        
        db.session.commit()
        return jsonify({'message': 'User updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating user: {str(e)}'}), 500

@app.route('/race/<int:race_id>/startlist/update/registration', methods=['POST'])
def update_startlist_registration(race_id):
    try:
        data = request.json
        registration = Registration.query.get(data['registration_id'])
        
        if not registration:
            return jsonify({'error': 'Registration not found'}), 404
        
        if 'number' in data:
            registration.number = data['number']
        
        if 'track_id' in data:
            registration.track_id = data['track_id']
        
        if 'user_start_time' in data:
            registration.user_start_time = datetime.strptime(data['user_start_time'], '%H:%M:%S').time()
        
        db.session.commit()
        return jsonify({'message': 'Registration updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating registration: {str(e)}'}), 500

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data.get('nickname') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Chybí povinné údaje'}), 400
    
    existing_user = Login.query.filter_by(email=data['email']).first()
    if existing_user:
        return jsonify({'message': 'Uživatel s tímto emailem již existuje'}), 409
    
    new_user = Login(
        nickname=data['nickname'],
        email=data['email'],
        password_hash=generate_password_hash(data['password'])
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'Registrace úspěšná'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Chyba při registraci: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Chybí email nebo heslo'}), 400
    
    user = Login.query.filter_by(email=data['email']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Nesprávný email nebo heslo'}), 401
    
    access_token = create_access_token(identity=str(user.id))
    
    return jsonify({
        'message': 'Přihlášení úspěšné',
        'access_token': access_token,
        'user': {
            'id': user.id,
            'nickname': user.nickname,
            'email': user.email
        }
    }), 200

@app.route('/api/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = Login.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'Uživatel nenalezen'}), 404
    
    return jsonify({
        'id': user.id,
        'nickname': user.nickname,
        'email': user.email,
        'role': user.role
    }), 200

@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('index.html'), 200

def init_db():
    """Initialize database tables and create race results tables"""
    with app.app_context():
        db.create_all()
        setup_all_race_results_tables()

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
