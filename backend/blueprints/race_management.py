# blueprints/race_management.py
from flask import Blueprint, jsonify, request
from datetime import datetime, time, timedelta
from sqlalchemy import text
from database import db
from database.race import Race
from database.track import Track
from database.category import Category
from database.registration import Registration
from database.user import Users

race_management_bp = Blueprint('race_management', __name__)

@race_management_bp.route('/races', methods=['GET'])
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

@race_management_bp.route('/race/add', methods=['POST'])
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
            for i, track_data in enumerate(data['tracks'], 1):
                track_id = int(f"{race_id}{i:02d}")
                
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

@race_management_bp.route('/race/<int:race_id>/update', methods=['PUT'])
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

        for i, track_data in enumerate(data.get('tracks', []), 1):
            track_id = int(f"{race_id}{i:02d}")

            if 'id' in track_data and track_data['id'] in existing_track_ids:
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
                updated_track_ids.add(track_id)

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
                            track_id=track.id
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

@race_management_bp.route('/race/<int:race_id>/delete', methods=['DELETE'])
def delete_race(race_id):
    try:
        race = Race.query.get(race_id)

        if not race:
            return jsonify({
                "status": "error",
                "message": "Race not found"
            }), 404

        tracks = Track.query.filter_by(race_id=race_id).all()
        track_ids = [track.id for track in tracks]

        Registration.query.filter(Registration.track_id.in_(track_ids)).delete(synchronize_session=False)

        Category.query.filter(Category.track_id.in_(track_ids)).delete(synchronize_session=False)

        Track.query.filter_by(race_id=race_id).delete(synchronize_session=False)

        if race.results_table_name:
            drop_table_query = text(f"DROP TABLE IF EXISTS {race.results_table_name}")
            db.session.execute(drop_table_query)

        db.session.delete(race)

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Race deleted successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting race: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@race_management_bp.route('/tracks', methods=['GET'])
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

@race_management_bp.route('/race/<int:race_id>', methods=['GET'])
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

@race_management_bp.route('/categories', methods=['GET'])
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

@race_management_bp.route('/set_track_start_time', methods=['POST'])
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

@race_management_bp.route('/confirm_lineup', methods=['POST'])
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
