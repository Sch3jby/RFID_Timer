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
    # Vytvoření dočasného config souboru pro testy
    fd, temp_config_path = tempfile.mkstemp(suffix='.ini')
    test_config = configparser.ConfigParser()
    
    # Test database connection
    test_config['database'] = {
        'DATABASE_URL': 'sqlite:///:memory:'
    }
    
    # Test JWT config
    test_config['jwt'] = {
        'SECRET_KEY': 'test-jwt-secret-key',
        'ACCESS_TOKEN_EXPIRES': '3600'
    }
    
    # Test mail config
    test_config['mail'] = {
        'MAIL_SERVER': 'localhost',
        'MAIL_PORT': '1025',
        'MAIL_USE_TLS': 'False',
        'MAIL_USERNAME': 'test@example.com',
        'MAIL_PASSWORD': 'test-password'
    }
    
    # Test security config
    test_config['security'] = {
        'PASSWORD_RESET_SALT': 'test-salt'
    }
    
    # Test RFID config
    test_config['alien_rfid'] = {
        'hostname': 'localhost',
        'port': '8000'
    }
    
    # Uložení konfigurace do dočasného souboru
    with os.fdopen(fd, 'w') as f:
        test_config.write(f)
    
    # Monkeypatch config path
    def mock_read(self, *args, **kwargs):
        self.read_dict(test_config)
        return self
    
    # Monkey patch the configparser.ConfigParser.read method
    original_read = configparser.ConfigParser.read
    configparser.ConfigParser.read = mock_read
    
    # Create app with testing config
    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'WTF_CSRF_ENABLED': False
    })
    
    # Create context and database
    with app.app_context():
        db.create_all()
        # Setup test data
        _init_test_data(db)
        yield app
        
        # Cleanup after tests
        db.session.remove()
        db.drop_all()
    
    # Restore original read method
    configparser.ConfigParser.read = original_read
    # Remove temp config file
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
    # Create test user for authentication
    test_user = Login(
        nickname='testuser',
        email='test@example.com',
        password_hash=generate_password_hash('Password123'),
        role=1  # Admin role
    )
    db.session.add(test_user)
    
    # Create test race
    race_date = datetime.now().date()
    test_race = Race(
        id=240401,  # Test race ID format based on date (YYMMDD + sequence)
        name='Test Race',
        date=race_date,
        start='M',  # Mass start
        description='Test race description'
    )
    db.session.add(test_race)
    db.session.flush()
    
    # Create race results table
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
    
    # Create test track
    test_track = Track(
        id=24040101,  # Race ID + sequence
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
    
    # Create test categories
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
    
    # Create test participant
    test_participant = Users(
        firstname='John',
        surname='Doe',
        year=1990,
        club='Test Club',
        email='participant@example.com',
        gender='M'
    )
    db.session.add(test_participant)
    db.session.flush()
    
    # Create test registration
    test_registration = Registration(
        user_id=test_participant.id,
        track_id=test_track.id,
        race_id=test_race.id,
        registration_time=datetime.now().time(),
        user_start_time=datetime.strptime('00:00:00', '%H:%M:%S').time(),
        number=1
    )
    db.session.add(test_registration)
    
    # Add test tag
    test_tag = BackUpTag(
        tag_id='Tag 1',
        number=1,
        last_seen_time=datetime.now().strftime('%Y/%m/%d %H:%M:%S.%f')[:-3]
    )
    db.session.add(test_tag)
    
    db.session.commit()