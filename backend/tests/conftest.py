import os
import sys
import pytest
import tempfile
from flask import Flask
from datetime import datetime, timedelta
import configparser

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from extensions import db
from database.user import Users
from database.login import Login
from database.race import Race
from database.track import Track
from database.category import Category
from database.registration import Registration
from database.backup import BackUpTag
from werkzeug.security import generate_password_hash

@pytest.fixture(scope='function')
def app():
    """Create and configure a Flask app for testing."""
    fd, temp_config_path = tempfile.mkstemp(suffix='.ini')
    test_config = configparser.ConfigParser()

    test_config['database'] = {
        'DATABASE_URL': 'sqlite:///:memory:'
    }

    test_config['jwt'] = {
        'SECRET_KEY': 'test-jwt-secret-key',
        'ACCESS_TOKEN_EXPIRES': '3600'
    }

    test_config['mail'] = {
        'MAIL_SERVER': 'localhost',
        'MAIL_PORT': '1025',
        'MAIL_USE_TLS': 'False',
        'MAIL_USERNAME': 'test@example.com',
        'MAIL_PASSWORD': 'test-password'
    }

    test_config['security'] = {
        'PASSWORD_RESET_SALT': 'test-salt'
    }

    test_config['alien_rfid'] = {
        'hostname': 'localhost',
        'port': '8000'
    }

    with os.fdopen(fd, 'w') as f:
        test_config.write(f)

    def mock_read(self, *args, **kwargs):
        self.read_dict(test_config)
        return self

    original_read = configparser.ConfigParser.read
    configparser.ConfigParser.read = mock_read

    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'WTF_CSRF_ENABLED': False
    })

    with app.app_context():
        db.create_all()
        _init_test_data(db)
        yield app

        db.session.remove()
        db.drop_all()

    configparser.ConfigParser.read = original_read
    os.unlink(temp_config_path)

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def auth_headers(client):
    """Get authentication headers."""
    response = client.post('/api/login', json={
        'email': 'test@example.com',
        'password': 'Password123'
    })
    token = response.json.get('access_token')
    return {'Authorization': f'Bearer {token}'}

def _init_test_data(db):
    """Initialize test data for the database."""
    test_user = Login(
        nickname='testuser',
        email='test@example.com',
        password_hash=generate_password_hash('Password123'),
        role=1  # Admin role
    )
    db.session.add(test_user)

    race_date = datetime.now().date()
    test_race = Race(
        id=240401,
        name='Test Race',
        date=race_date,
        start='M',
        description='Test race description'
    )
    db.session.add(test_race)
    db.session.flush()

    from sqlalchemy import text
    db.session.execute(text(f'''
        CREATE TABLE race_results_{test_race.id} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL,
            tag_id VARCHAR(255) NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            lap_number INTEGER DEFAULT 1,
            track_id INTEGER NOT NULL,
            last_seen_time TIMESTAMP,
            status VARCHAR(5)
        )
    '''))

    test_track = Track(
        id=24040101,
        name='Test Track',
        distance=5.0,
        min_age=18,
        max_age=45,
        fastest_possible_time=datetime.strptime('00:15:00', '%H:%M:%S').time(),
        number_of_laps=1,
        expected_start_time=datetime.strptime('10:00:00', '%H:%M:%S').time(),
        actual_start_time=datetime.strptime('10:00:00', '%H:%M:%S').time(),
        race_id=test_race.id
    )
    db.session.add(test_track)
    db.session.flush()

    test_category_m = Category(
        category_name='M18-45',
        min_age=18,
        max_age=45,
        min_number=1,
        max_number=50,
        gender='M',
        track_id=test_track.id
    )

    test_category_f = Category(
        category_name='F18-45',
        min_age=18,
        max_age=45,
        min_number=51,
        max_number=100,
        gender='F',
        track_id=test_track.id
    )

    db.session.add(test_category_m)
    db.session.add(test_category_f)

    test_participant = Users(
        firstname='John',
        surname='Pork',
        year=1990,
        club='Test Club',
        email='participant@example.com',
        gender='M'
    )
    db.session.add(test_participant)
    db.session.flush()

    test_registration = Registration(
        user_id=test_participant.id,
        track_id=test_track.id,
        race_id=test_race.id,
        registration_time=datetime.now().time(),
        user_start_time=datetime.strptime('00:00:00', '%H:%M:%S').time(),
        number=1
    )
    db.session.add(test_registration)

    test_tag = BackUpTag(
        tag_id='Tag 1',
        number=1,
        last_seen_time=datetime.now().strftime('%Y/%m/%d %H:%M:%S.%f')[:-3]
    )
    db.session.add(test_tag)

    db.session.commit()
