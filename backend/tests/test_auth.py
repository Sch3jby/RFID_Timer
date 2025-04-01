import pytest
import json
from flask import url_for
from database.login import Login

def test_register(client):
    """Test registrace nového uživatele."""
    response = client.post('/api/register', json={
        'nickname': 'newuser',
        'email': 'new@example.com',
        'password': 'Password123'
    })
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['message'] == 'Registrace úspěšná'
    
    # Ověřit, že uživatel byl vytvořen
    with client.application.app_context():
        user = Login.query.filter_by(email='new@example.com').first()
        assert user is not None
        assert user.nickname == 'newuser'

def test_register_existing_email(client):
    """Test registrace s již existujícím emailem."""
    # Nejprve vytvořit uživatele
    client.post('/api/register', json={
        'nickname': 'existing',
        'email': 'existing@example.com',
        'password': 'Password123'
    })
    
    # Pokus o registraci se stejným emailem
    response = client.post('/api/register', json={
        'nickname': 'another',
        'email': 'existing@example.com',
        'password': 'AnotherPassword123'
    })
    
    assert response.status_code == 409
    data = json.loads(response.data)
    assert 'již existuje' in data['message']

def test_register_missing_fields(client):
    """Test registrace s chybějícími povinnými poli."""
    response = client.post('/api/register', json={
        'nickname': 'incomplete',
        'email': 'incomplete@example.com'
        # Chybí password
    })
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Chybí povinné údaje' in data['message']

def test_register_weak_password(client):
    """Test registrace se slabým heslem."""
    response = client.post('/api/register', json={
        'nickname': 'weakpass',
        'email': 'weak@example.com',
        'password': 'weak'  # Slabé heslo
    })
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Password must be' in data['message']

def test_login_success(client):
    """Test úspěšného přihlášení."""
    response = client.post('/api/login', json={
        'email': 'test@example.com',
        'password': 'Password123'
    })
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'access_token' in data
    assert data['message'] == 'Přihlášení úspěšné'
    assert data['user']['nickname'] == 'testuser'

def test_login_invalid_credentials(client):
    """Test přihlášení s neplatnými přihlašovacími údaji."""
    response = client.post('/api/login', json={
        'email': 'test@example.com',
        'password': 'WrongPassword'
    })
    
    assert response.status_code == 401
    data = json.loads(response.data)
    assert 'Nesprávný email nebo heslo' in data['message']

def test_login_missing_fields(client):
    """Test přihlášení s chybějícími údaji."""
    response = client.post('/api/login', json={
        'email': 'test@example.com'
        # Chybí password
    })
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Chybí email nebo heslo' in data['message']

def test_get_current_user(client, auth_headers):
    """Test získání informací o přihlášeném uživateli."""
    response = client.get('/api/me', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['nickname'] == 'testuser'
    assert data['email'] == 'test@example.com'

def test_forgot_password(client, monkeypatch):
    """Test žádosti o reset hesla."""
    # Mock funkce pro odesílání emailů
    emails_sent = []
    
    def mock_send_email(self, msg):
        emails_sent.append(msg)
    
    # Aplikovat mock na metodu mail.send
    monkeypatch.setattr('flask_mail.Mail.send', mock_send_email)
    
    response = client.post('/api/forgot-password', json={
        'email': 'test@example.com'
    })
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['message'] == 'Password reset email sent'
    
    # Ověřit, že email byl odeslán
    assert len(emails_sent) == 1
    assert emails_sent[0].recipients == ['test@example.com']
    assert 'Password Reset Request' in emails_sent[0].subject

def test_reset_password(client, monkeypatch):
    """Test resetování hesla."""
    # Mock funkce verifikace tokenu pro reset hesla
    def mock_verify_token(token, expiration=1800):
        # Vrátit ID testovacího uživatele
        return "1"
    
    # Aplikovat mock na funkci verify_reset_token
    monkeypatch.setattr('blueprints.auth.verify_reset_token', mock_verify_token)
    
    response = client.post('/api/reset-password', json={
        'token': 'fake-reset-token',
        'password': 'NewPassword123'
    })
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['message'] == 'Password successfully reset'
    
    # Ověřit, že se heslo změnilo
    login_response = client.post('/api/login', json={
        'email': 'test@example.com',
        'password': 'NewPassword123'
    })
    
    assert login_response.status_code == 200

def test_get_user_registrations(client, auth_headers):
    """Test získání registrací přihlášeného uživatele."""
    # Nejprve musíme vytvořit uživatele a registraci se stejným emailem jako přihlášený uživatel
    with client.application.app_context():
        from database.user import Users
        from database.registration import Registration
        from database.login import Login
        from database import db
        from datetime import datetime
        
        login_user = Login.query.filter_by(email='test@example.com').first()
        
        # Vytvořit uživatele se stejným emailem jako přihlášený uživatel
        user = Users(
            firstname='Test',
            surname='User',
            year=1985,
            club='Test Club',
            email='test@example.com',
            gender='M'
        )
        db.session.add(user)
        db.session.flush()
        
        # Přidat registraci pro tohoto uživatele - použijeme konkrétní datetime.now().time()
        # místo db.func.now(), což bylo pravděpodobně příčinou problému
        registration = Registration(
            user_id=user.id,
            track_id=24040101,
            race_id=240401,
            registration_time=datetime.now().time(),
            user_start_time=None,
            number=10
        )
        db.session.add(registration)
        db.session.commit()
    
    response = client.get('/api/me/registrations', headers=auth_headers)
    
    # Pro účely debugování - vypsat detaily odpovědi v případě chyby
    if response.status_code != 200:
        print(f"Error response: {response.status_code}")
        print(f"Response data: {response.data}")
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'user' in data
    assert data['user']['email'] == 'test@example.com'
    assert 'registrations' in data
    assert len(data['registrations']) >= 1