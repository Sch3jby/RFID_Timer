import pytest
import json
from database.user import Users
from database.registration import Registration

def test_registration_success(client):
    """Test úspěšné registrace účastníka na závod."""

    with client.application.app_context():
        from database.race import Race
        from database.track import Track

        race = Race.query.get(240401)
        track = Track.query.get(24040101)

        if not race:
            print("Test race (ID: 240401) does not exist in the test database")
        if not track:
            print("Test track (ID: 24040101) does not exist in the test database")


    with client.application.app_context():
        from datetime import datetime, timedelta
        from database.registration import Registration

        print(f"Registration.registration_time type: {type(Registration.registration_time.type)}")

    import time
    time.sleep(0.1)

    response = client.post('/api/registration', json={
        'firstname': 'Alice',
        'surname': 'Smith',
        'year': 1995,
        'club': 'Running Club',
        'email': 'alice@example.com',
        'gender': 'F',
        'race_id': 240401,
        'track_id': 24040101
    })

    if response.status_code != 201:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")

    assert response.status_code == 201
    data = json.loads(response.data)
    assert 'registration_id' in data
    assert data['message'] == 'User successfully registered'

    with client.application.app_context():
        from database.user import Users
        from database.registration import Registration

        user = Users.query.filter_by(email='alice@example.com').first()
        assert user is not None
        assert user.firstname == 'Alice'
        assert user.surname == 'Smith'

        registration = Registration.query.filter_by(user_id=user.id).first()
        assert registration is not None
        assert registration.race_id == 240401
        assert registration.track_id == 24040101

def test_registration_missing_fields(client):
    """Test registrace s chybějícími povinnými poli."""
    response = client.post('/api/registration', json={
        'firstname': 'Bob',
        'surname': 'Johnson',

        'club': 'Running Club',
        'email': 'bob@example.com',
        'gender': 'M',
        'race_id': 240401,
        'track_id': 24040101
    })

    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'All fields are required' in data['error']

def test_registration_invalid_track(client):
    """Test registrace s neplatným ID trati."""
    response = client.post('/api/registration', json={
        'firstname': 'Charlie',
        'surname': 'Brown',
        'year': 1992,
        'club': 'Running Club',
        'email': 'charlie@example.com',
        'gender': 'M',
        'race_id': 240401,
        'track_id': 99999
    })

    assert response.status_code == 404
    data = json.loads(response.data)
    assert 'Invalid race or track selection' in data['error']

def test_registration_age_limit(client):
    """Test registrace s věkem mimo limit trati."""
    response = client.post('/api/registration', json={
        'firstname': 'David',
        'surname': 'Miller',
        'year': 1950,
        'club': 'Running Club',
        'email': 'david@example.com',
        'gender': 'M',
        'race_id': 240401,
        'track_id': 24040101
    })

    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Age not eligible for this track' in data['error']

def test_registration_invalid_gender_category(client):
    """Test registrace s pohlavím, pro které neexistuje kategorie."""
    response = client.post('/api/registration', json={
        'firstname': 'Eve',
        'surname': 'Wilson',
        'year': 1990,
        'club': 'Running Club',
        'email': 'eve@example.com',
        'gender': 'X',
        'race_id': 240401,
        'track_id': 24040101
    })

    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'No suitable category found' in data['error']
