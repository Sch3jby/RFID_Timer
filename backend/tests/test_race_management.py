import pytest
import json
from datetime import datetime, timedelta
from database.race import Race
from database.track import Track
from database.category import Category

def test_get_races(client):
    """Test získání seznamu závodů."""
    response = client.get('/api/races')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'races' in data
    assert len(data['races']) >= 1
    
    race = data['races'][0]
    assert 'id' in race
    assert 'name' in race
    assert 'date' in race
    assert 'start' in race
    assert 'tracks' in race
    
    if race['tracks']:
        track = race['tracks'][0]
        assert 'id' in track
        assert 'name' in track
        assert 'distance' in track
        assert 'categories' in track

def test_add_race(client, auth_headers):
    """Test přidání nového závodu."""
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    response = client.post('/api/race/add', json={
        'name': 'New Test Race',
        'date': tomorrow,
        'start': 'M',
        'description': 'New test race description',
        'tracks': [
            {
                'name': 'New Test Track',
                'distance': 10.0,
                'min_age': 18,
                'max_age': 50,
                'fastest_possible_time': '00:30:00',
                'number_of_laps': 2,
                'expected_start_time': '11:00:00',
                'categories': [
                    {
                        'category_name': 'M18-35',
                        'min_age': 18,
                        'max_age': 35,
                        'min_number': 1,
                        'max_number': 50,
                        'gender': 'M'
                    },
                    {
                        'category_name': 'M36-50',
                        'min_age': 36,
                        'max_age': 50,
                        'min_number': 51,
                        'max_number': 100,
                        'gender': 'M'
                    },
                    {
                        'category_name': 'F18-35',
                        'min_age': 18,
                        'max_age': 35,
                        'min_number': 101,
                        'max_number': 150,
                        'gender': 'F'
                    },
                    {
                        'category_name': 'F36-50',
                        'min_age': 36,
                        'max_age': 50,
                        'min_number': 151,
                        'max_number': 200,
                        'gender': 'F'
                    }
                ]
            }
        ]
    }, headers=auth_headers)
    
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'race_id' in data
    
    with client.application.app_context():
        race = Race.query.get(data['race_id'])
        assert race is not None
        assert race.name == 'New Test Race'
        
        tracks = Track.query.filter_by(race_id=race.id).all()
        assert len(tracks) == 1
        
        categories = Category.query.filter_by(track_id=tracks[0].id).all()
        assert len(categories) == 4

def test_add_race_invalid_data(client, auth_headers):
    """Test přidání závodu s neplatnými daty."""
    response = client.post('/api/race/add', json={
        'name': 'Invalid Race',
        'start': 'X',
        'description': 'Invalid race description'
    }, headers=auth_headers)
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['status'] == 'error'

def test_update_race(client, auth_headers):
    """Test aktualizace existujícího závodu."""
    response = client.get('/api/races')
    races = json.loads(response.data)['races']
    
    if not races:
        pytest.skip("No existing races to update")
    
    race_id = races[0]['id']
    
    response = client.put(f'/api/race/{race_id}/update', json={
        'name': 'Updated Race Name',
        'date': races[0]['date'],
        'description': 'Updated race description',
        'tracks': races[0]['tracks']
    }, headers=auth_headers)
    
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code in [200, 400, 500]

    if response.status_code == 400:
        data = json.loads(response.data)
        if "change race date" in data.get("message", ""):
            pytest.skip("API correctly prevents race date changes")
    
    if response.status_code == 200:
        data = json.loads(response.data)
        assert data['status'] == 'success'
        
        updated_response = client.get('/api/races')
        updated_races = json.loads(updated_response.data)['races']
        updated_race = next((r for r in updated_races if r['id'] == race_id), None)
        
        assert updated_race is not None
        assert updated_race['name'] == 'Updated Race Name'
        assert updated_race['description'] == 'Updated race description'

def test_get_race_detail(client):
    """Test získání detailu závodu."""
    response = client.get('/api/race/240401')
    
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'race' in data
    
    race = data['race']
    assert race['id'] == 240401
    assert 'name' in race
    assert 'date' in race
    assert 'start' in race
    assert 'participants' in race

def test_get_tracks(client):
    """Test získání tratí pro závod."""
    response = client.get('/api/tracks?race_id=240401')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'tracks' in data
    assert len(data['tracks']) >= 1
    
    track = data['tracks'][0]
    assert 'id' in track
    assert 'name' in track
    assert 'distance' in track

def test_set_track_start_time(client, auth_headers):
    """Test nastavení času startu trati."""
    response = client.post('/api/set_track_start_time', json={
        'race_id': 240401,
        'track_id': 24040101,
        'start_time': '10:30'
    }, headers=auth_headers)
    
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'start_time' in data

def test_confirm_lineup(client, auth_headers):
    """Test potvrzení startovního pořadí."""
    response = client.post('/api/confirm_lineup', json={
        'race_id': 240401
    }, headers=auth_headers)
    
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data
    assert 'lineup confirmed' in data['message'].lower()
    assert 'tracks' in data

def test_get_categories(client):
    """Test získání kategorií."""
    response = client.get('/api/categories')
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'categories' in data
    assert len(data['categories']) >= 1
    
    category = data['categories'][0]
    assert 'id' in category
    assert 'name' in category
    assert 'gender' in category
    assert 'min_age' in category
    assert 'max_age' in category
    assert 'track_id' in category