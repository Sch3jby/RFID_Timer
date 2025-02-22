# blueprints/startlist.py
from flask import Blueprint, jsonify, request
from database import db
from database.registration import Registration
from database.track import Track
from database.user import Users
from datetime import datetime

startlist_bp = Blueprint('startlist', __name__)

@startlist_bp.route('/race/<int:race_id>/startlist', methods=['GET'])
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
                'year': user.year,
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

@startlist_bp.route('/race/<int:race_id>/startlist/update/user', methods=['POST'])
def update_startlist_user(race_id):
    try:
        data = request.json
        user = Users.query.get(data['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.firstname = data['firstname']
        user.surname = data['surname']
        user.club = data['club']
        user.year = data['year']
        
        db.session.commit()
        return jsonify({'message': 'User updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating user: {str(e)}'}), 500

@startlist_bp.route('/race/<int:race_id>/startlist/update/registration', methods=['POST'])
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

@startlist_bp.route('/race/<int:race_id>/startlist/delete/<int:registration_id>', methods=['DELETE'])
def delete_registration(race_id, registration_id):
    try:
        registration = Registration.query.get(registration_id)
        
        if not registration:
            return jsonify({'error': 'Registration not found'}), 404
            
        if registration.race_id != race_id:
            return jsonify({'error': 'Registration does not belong to this race'}), 403
        
        user_id = registration.user_id
        
        db.session.delete(registration)
        
        user = Users.query.get(user_id)
        if user:
            db.session.delete(user)
        
        db.session.commit()
        
        return jsonify({'message': 'Registration and user deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting registration and user: {str(e)}'}), 500