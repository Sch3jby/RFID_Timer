import pytest
import json
from datetime import datetime, time
from database.user import Users
from database.registration import Registration

def test_get_race_startlist(client):
    """Test získání startovní listiny závodu."""
    response = client.get('/api/race/240401/startlist')

    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")

    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'startList' in data

    if data['startList']:
        entry = data['startList'][0]
        assert 'registration_id' in entry
        assert 'user_id' in entry
        assert 'firstname' in entry
        assert 'surname' in entry
        assert 'year' in entry
        assert 'club' in entry
        assert 'number' in entry
        assert 'track_id' in entry
        assert 'track_name' in entry
        assert 'user_start_time' in entry

def test_update_startlist_user(client, auth_headers):
    """Test aktualizace údajů uživatele ve startovní listině."""
    response = client.get('/api/race/240401/startlist')
    startlist = json.loads(response.data)['startList']

    if not startlist:
        pytest.skip("No existing users in the startlist")

    user_id = startlist[0]['user_id']

    response = client.post('/api/race/240401/startlist/update/user', json={
        'user_id': user_id,
        'firstname': 'Updated',
        'surname': 'User',
        'club': 'Updated Club',
        'year': 1988
    }, headers=auth_headers)

    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")

    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data
    assert 'updated successfully' in data['message']

    with client.application.app_context():
        user = Users.query.get(user_id)
        assert user.firstname == 'Updated'
        assert user.surname == 'User'
        assert user.club == 'Updated Club'
        assert user.year == 1988

def test_update_startlist_registration(client, auth_headers):
    """Test aktualizace registrace ve startovní listině."""
    response = client.get('/api/race/240401/startlist')
    startlist = json.loads(response.data)['startList']

    if not startlist:
        pytest.skip("No existing registrations in the startlist")

    registration_id = startlist[0]['registration_id']

    response = client.post('/api/race/240401/startlist/update/registration', json={
        'registration_id': registration_id,
        'number': 42,
        'user_start_time': '00:05:00'
    }, headers=auth_headers)

    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")

    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data
    assert 'updated successfully' in data['message']

    with client.application.app_context():
        registration = Registration.query.get(registration_id)
        assert registration.number == 42
        assert registration.user_start_time.strftime('%H:%M:%S') == '00:05:00'

def test_delete_registration(client, auth_headers):
    """Test smazání registrace ze startovní listiny."""
    with client.application.app_context():
        from database import db
        from datetime import datetime
    
        test_user = Users(
            firstname='ToDelete',
            surname='User',
            year=1990,
            club='Delete Club',
            email='todelete@example.com',
            gender='M'
        )
        db.session.add(test_user)
        db.session.flush()

        test_registration = Registration(
            user_id=test_user.id,
            track_id=24040101,
            race_id=240401,
            registration_time=datetime.now().time(),
            user_start_time=None,
            number=999
        )
        db.session.add(test_registration)
        db.session.commit()

        registration_id = test_registration.id

    response = client.delete(f'/api/race/240401/startlist/delete/{registration_id}', headers=auth_headers)

    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")

    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data
    assert 'deleted successfully' in data['message']

    with client.application.app_context():
        registration = Registration.query.get(registration_id)
        assert registration is None

        user = Users.query.filter_by(email='todelete@example.com').first()
        assert user is None
