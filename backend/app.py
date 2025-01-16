# app.py
import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request, current_app
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

# Routes
@app.route('/')
def index():
    return "Welcome to the RFID Reader API!", 200

@app.route('/connect', methods=['POST'])
def connect_reader():
    try:
        if alien.connected:
            # Explicitní odpojení 
            alien.disconnect()
            alien.connected = False
            return jsonify({"status": "disconnected"})
        
        try:
            # Explicitní připojení
            alien.connect()
            alien.connected = True
            return jsonify({"status": "connected"})
        
        except Exception as e:
            # Konzistentní error handling
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

        # Fetch the track to get fastest_possible_time
        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        # Fetch the category associated with this track
        category = Category.query.filter_by(track_id=track_id).first()
        if not category:
            return jsonify({"status": "error", "message": "Category not found for this track"}), 404

        table_name = f'race_results_{race_id}'
        
        # Pattern for extracting data
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
                
                # Extract tag number
                number = tag_id.strip().split()[-1]
                tag_id = tag_id.strip()
                
                # Parse time data
                last_seen_datetime = datetime.strptime(last_seen_time, "%Y/%m/%d %H:%M:%S.%f")
                current_time = (datetime.now() + timedelta(hours=1))

                # Reader time offset
                offset = last_seen_datetime - current_time
                last_seen_datetime = last_seen_datetime - offset

                # Find the corresponding registration for this tag/race/track
                registration = Registration.query.filter_by(
                    race_id=race_id, 
                    track_id=track_id, 
                    number=number
                ).first()

                if not registration:
                    continue

                # Validate actual start time
                if not track.actual_start_time:
                    return jsonify({"status": "error", "message": "Actual start time not set for category"}), 400
                
                # Convert time objects to timedeltas
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

                # Add the timedeltas and handle overflow
                total_seconds = user_start_delta.seconds + category_start_delta.seconds
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)

                user_start_time = time(
                    hour=hours % 24,  # Ensure we don't exceed 24 hours
                    minute=minutes,
                    second=seconds
                )

                # Combine date of last_seen_time with category's actual start time
                race_start_datetime = datetime.combine(
                    last_seen_datetime.date(), 
                    user_start_time
                )

                # Convert fastest_possible_time to timedelta
                min_lap_duration = timedelta(
                    hours=track.fastest_possible_time.hour, 
                    minutes=track.fastest_possible_time.minute, 
                    seconds=track.fastest_possible_time.second
                )

                # Check if this is the first entry for this tag
                last_entry = db.session.execute(
                    text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
                    {'number': number}
                ).fetchone()

                if last_entry:
                    if last_entry.lap_number >= track.number_of_laps:
                        continue

                # For first entry, check if tag time is after race start + min lap duration
                if not last_entry:
                    if last_seen_datetime <= race_start_datetime + min_lap_duration:
                        continue
                    lap_number = 1
                else:
                    # For subsequent entries, check if tag time is after last tag time + min lap duration
                    last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
                    
                    if last_seen_datetime <= last_tag_time + min_lap_duration:
                        continue
                    
                    lap_number = last_entry.lap_number + 1

                # Insert data into database
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

        # Validate status if provided
        valid_statuses = ['None', 'DNF', 'DNS', 'DSQ']
        if status and status not in valid_statuses:
            return jsonify({
                "status": "error",
                "message": "Invalid status. Must be one of: None, DNF, DNS, DSQ"
            }), 400

        # Fetch the track to get number_of_laps and fastest_possible_time
        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        # Fetch the registration to get user_start_time
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
                    datetime.strptime(timestamp_str, "%H:%M:%S").time()
                )
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid timestamp format. Use HH:MM:SS."
                }), 400
        else:
            timestamp = datetime.now() + timedelta(hours=1)

        table_name = f'race_results_{race_id}'

        # Check if this is the first entry for this tag
        last_entry = db.session.execute(
            text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
            {'number': number}
        ).fetchone()

        # Convert fastest_possible_time to timedelta
        min_lap_duration = timedelta(
            hours=track.fastest_possible_time.hour,
            minutes=track.fastest_possible_time.minute,
            seconds=track.fastest_possible_time.second
        )

        # Calculate race start time
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

        # Add the timedeltas and handle overflow
        total_seconds = user_start_delta.seconds + category_start_delta.seconds
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        user_start_time = time(
            hour=hours % 24,
            minute=minutes,
            second=seconds
        )

        race_start_datetime = datetime.combine(timestamp.date(), user_start_time)

        # Skip time validation for DNS and DSQ statuses
        if status not in ['DNS', 'DSQ', 'DNF']:
            # Determine lap number and validate timing
            if last_entry:
                if last_entry.lap_number >= track.number_of_laps:
                    return jsonify({
                        "status": "error",
                        "message": "Maximum number of laps already recorded"
                    }), 400

                last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
                
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
        else:
            lap_number = 1  # Default to 1 for DNS and DSQ and DNF

        # Insert data into database
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
        races_list = []
        for race in races:
            races_list.append({
                'id': race.id,
                'name': race.name,
                'date': race.date.strftime('%Y-%m-%d'),
                'start': race.start,
                'description': race.description
            })
        return jsonify({'races': races_list}), 200
    except Exception as e:
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
        
        # Fetch all registrations
        registrations = Registration.query.filter(Registration.track_id.in_(track_ids)).all()
        
        # Prepare a list to store participant details
        participant_details = []

        # Dictionary to track number counters for each category and gender
        category_number_counters = {}
        
        plus_start_time = race.interval_time
        
        # First pass: Assign numbers within categories
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            track = Track.query.get(registration.track_id)
            
            category = Category.query.filter_by(gender=user.gender, track_id=registration.track_id).\
                                    filter(Category.min_age <= (datetime.now().year - user.year), 
                                        Category.max_age >= (datetime.now().year - user.year)).\
                                    first()
            
            if not (user and category and track):
                continue

            # Use a composite key combining category ID, gender, and min_number for sorting
            category_gender_key = (category.id, user.gender)

            # Initialize counter for category and gender if not exists
            if category_gender_key not in category_number_counters:
                category_number_counters[category_gender_key] = 0

            # Increment counter for the category and gender
            category_number_counters[category_gender_key] += 1
            
            # Calculate user's number within their category
            user_number = category.min_number + category_number_counters[category_gender_key] - 1

            participant_details.append({
                'registration_id': registration.id,
                'category_id': category.id,
                'gender': user.gender,
                'number': user_number,
                'user_id': user.id,
                'track_id': track.id
            })
        
        # Sort participants by category and number
        sorted_participants = sorted(
            participant_details, 
            key=lambda x: (x['category_id'], x['number'])
        )
        
        # Second pass: Assign start times based on sorted order
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
            
            # Calculate start time based on sorted order
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
        
        # Fetch the race
        race = Race.query.get(race_id)
        if not race:
            return jsonify({'error': 'Race not found'}), 404
        
        # Fetch tracks for this race
        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]
        
        # Fetch all registrations for these tracks
        registrations = Registration.query.filter(Registration.track_id.in_(track_ids)).all()
        
        # Prepare a list to store participant details
        participant_details = []

        # Dictionary to track number counters for each category and gender
        category_number_counters = {}
        
        # First pass: Assign numbers within categories
        for registration in registrations:
            user = Users.query.get(registration.user_id)
            track = Track.query.get(registration.track_id)
            
            # Find the matching category for the user
            category = Category.query.filter_by(gender=user.gender, track_id=registration.track_id).\
                                    filter(Category.min_age <= (datetime.now().year - user.year), 
                                        Category.max_age >= (datetime.now().year - user.year)).\
                                    first()
            
            if not (user and category and track):
                continue

            # Use a composite key combining category ID, gender, and min_number for sorting
            category_gender_key = (category.id, user.gender)

            # Initialize counter for category and gender if not exists
            if category_gender_key not in category_number_counters:
                category_number_counters[category_gender_key] = 0

            # Increment counter for the category and gender
            category_number_counters[category_gender_key] += 1
            
            # Calculate user's number within their category
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
        
        # Sort participants by category and number
        sorted_participants = sorted(
            participant_details, 
            key=lambda x: (x['category_id'], x['number'])
        )
        
        # Second pass: Assign start times based on sorted order
        for idx, participant in enumerate(sorted_participants):
            registration = Registration.query.get(participant['registration_id'])
            
            # Calculate start time based on sorted order
            if race.start == 'I':  # Intervalový start
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

            # Update the existing registration
            registration.number = participant['number']
            registration.user_start_time = actual_start
        
        # Commit the changes
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
        # First verify the race exists and the results table exists
        table_name = f'race_results_{race_id}'
        
        # Check if table exists
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

        # Query to get latest results with race time and time behind leader
        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status
                FROM race_results_{race_id} r
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
                    sl.status
                FROM race_results_{race_id} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status
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
                    u.forename,
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
                        WHEN ll.status IS NOT NULL THEN ll.status  -- Použít status jako race_time
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
                FROM race_results_{race_id} r
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
                forename,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
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
                'name': f"{row.forename} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'race_time': row.race_time or '--:--:--',
                'position_track': row.position_track if row.race_time is not None else '-',
                'position_category': row.position_category if row.race_time is not None else '-',
                'behind_time_track': row.behind_time_track or ' ',
                'behind_time_category': row.behind_time_category or ' '
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results: {str(e)}')
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
            'lap_time': row.lap_time,
            'total_time': row.total_time
        } for row in results]
        
        return jsonify({'laps': laps}), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching runner laps: {str(e)}')
        return jsonify({'error': 'Failed to fetch runner laps'}), 500

# Catch-all route to serve React frontend
@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('index.html'), 200

# Create tables before first request
def init_db():
    """Initialize database tables and create race results tables"""
    with app.app_context():
        db.create_all()
        setup_all_race_results_tables()

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
