# blueprints/auth.py
from flask import Blueprint, jsonify, request, current_app
from extensions import mail, db
from database.user import Users
from database.login import Login
from database.registration import Registration
from database.race import Race
from database.track import Track
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta
import re

reset_requests = {}

auth_bp = Blueprint('auth', __name__)

def check_rate_limit(email):
    """Check if email has exceeded rate limit for password reset requests."""
    now = datetime.utcnow()
    if email in reset_requests:
        requests = [t for t in reset_requests[email] 
                   if now - t < timedelta(hours=1)]
        reset_requests[email] = requests
        if len(requests) >= 3:
            return False
    else:
        reset_requests[email] = []
    reset_requests[email].append(now)
    return True

def validate_password(password):
    """
    Validate password strength.
    Returns (bool, str) tuple - (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, ""

def generate_reset_token(user_id):
    """Generate a timed token for password reset."""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(user_id, salt='password-reset-salt')

def send_password_reset_email(email, reset_token):
    """
    Send password reset email with the reset token.
    Includes HTML styling and company branding.
    """
    reset_url = f"http://localhost:3000/reset-password?token={reset_token}"

    msg = Message(
        'Password Reset Request - NTI TUL',
        sender=current_app.config['MAIL_USERNAME'],
        recipients=[email]
    )

    msg.body = f'''To reset your password, visit the following link:
{reset_url}

If you did not make this request, please ignore this email.
The link will expire in 30 minutes.
'''


    msg.html = f'''
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

        <h2 style="color: #1a237e; margin-bottom: 20px;">Password Reset Request</h2>

        <p>Hello,</p>

        <p>We received a request to reset your password. To proceed with the password reset, please click the button below:</p>

        <!-- Reset Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" 
               style="background-color: #1a237e; 
                      color: white; 
                      padding: 12px 25px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      display: inline-block;">
                Reset Password
            </a>
        </div>

        <p style="color: #666; font-size: 14px;">
            If you did not request a password reset, please ignore this email or contact support if you have concerns.
        </p>

        <p style="color: #666; font-size: 14px;">
            This link will expire in 30 minutes for security purposes.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <footer style="text-align: center; color: #666; font-size: 12px;">
            <p>This email was sent by CheckPoint</p>
        </footer>
    </body>
    </html>
    '''

    mail.send(msg)

def verify_reset_token(token, expiration=1800):
    """Verify the reset token and return the user_id if valid."""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        user_id = serializer.loads(
            token,
            salt='password-reset-salt',
            max_age=expiration
        )
        return user_id
    except:
        return None

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    password = data.get('password')

    if not data.get('nickname') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Chybí povinné údaje'}), 400

    existing_user = Login.query.filter_by(email=data['email']).first()
    if existing_user:
        return jsonify({'message': 'Uživatel s tímto emailem již existuje'}), 409

    is_valid, error_message = validate_password(password)
    if not is_valid:
        return jsonify({'message': error_message}), 400

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

@auth_bp.route('/login', methods=['POST'])
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

@auth_bp.route('/me', methods=['GET'])
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

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Handle forgot password request."""
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'message': 'Email is required'}), 400

    if not check_rate_limit(email):
        return jsonify({'message': 'Too many reset requests. Please try again later'}), 429

    user = Login.query.filter_by(email=email).first()

    if not user:
        return jsonify({'message': 'If an account exists with this email, you will receive a password reset link'}), 200

    reset_token = generate_reset_token(str(user.id))

    try:
        send_password_reset_email(email, reset_token)
        return jsonify({'message': 'Password reset email sent'}), 200
    except Exception as e:
        current_app.logger.error(f"Error sending email: {e}")
        return jsonify({'message': 'Error sending password reset email'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Handle password reset."""
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')

    if not token or not new_password:
        return jsonify({'message': 'Token and new password are required'}), 400

    is_valid, error_message = validate_password(new_password)
    if not is_valid:
        return jsonify({'message': error_message}), 400

    user_id = verify_reset_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid or expired reset token'}), 400

    user = Login.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    user.password_hash = generate_password_hash(new_password)

    try:
        db.session.commit()
        return jsonify({'message': 'Password successfully reset'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error resetting password: {e}")
        return jsonify({'message': 'Error resetting password'}), 500

@auth_bp.route('/me/registrations', methods=['GET'])
@jwt_required()
def get_user_registrations():
    user_id = get_jwt_identity()

    try:
        login_user = Login.query.get(user_id)
        if not login_user:
            return jsonify({'message': 'Uživatel nenalezen v Login tabulce'}), 404

        user_email = login_user.email

        users_with_same_email = Users.query.filter_by(email=user_email).all()
        user_ids = [user.id for user in users_with_same_email]

        if not user_ids:
            return jsonify({'message': 'Uživatel nenalezen v Users tabulce'}), 404

        main_user = users_with_same_email[0]

        registrations = (
            db.session.query(Registration, Race, Track, Users)
            .join(Race, Registration.race_id == Race.id)
            .join(Track, Registration.track_id == Track.id)
            .join(Users, Registration.user_id == Users.id)
            .filter(Users.email == user_email)
            .all()
        )

        result = []
        for reg, race, track, user in registrations:
            result.append({
                'registration_id': reg.id,
                'race': {
                    'id': race.id,
                    'name': race.name,
                    'date': race.date.strftime('%Y-%m-%d'),
                    'start_type': 'Hromadný' if race.start == 'M' else 'Intervalový',
                    'description': race.description
                },
                'track': {
                    'id': track.id,
                    'name': track.name,
                    'distance': track.distance,
                    'number_of_laps': track.number_of_laps
                },
                'user': {
                    'id': user.id,
                    'firstname': user.firstname,
                    'surname': user.surname,
                    'club': user.club,
                    'year': user.year,
                    'email': user.email,
                    'gender': 'M' if user.gender == 'M' else 'F'
                }
            })

        return jsonify({
            'user': {
                'id': main_user.id,
                'firstname': main_user.firstname,
                'surname': main_user.surname,
                'nickname': login_user.nickname,
                'email': main_user.email
            },
            'registrations': result
        }), 200

    except Exception as e:
        return jsonify({'error': f'Chyba při získávání registrací: {str(e)}'}), 500
