# blueprints/registration.py
from flask import Blueprint, jsonify, request
from database import db
from database.user import Users
from database.race import Race
from database.registration import Registration
from database.category import Category
from database.track import Track
from datetime import datetime, timedelta

registration_bp = Blueprint('registration', __name__)

@registration_bp.route('/registration', methods=['POST'])
def registration():
    """
    Handle participant registration for a race.
    Creates user and registration records after validating input.
    Checks age eligibility and category assignment.
    
    Returns:
        tuple: JSON response with registration status and HTTP status code
    """

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

        current_time = datetime.now()
        registration = Registration(
            user_id=user.id,
            track_id=track_id,
            race_id=race_id,
            registration_time=current_time.time()
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
