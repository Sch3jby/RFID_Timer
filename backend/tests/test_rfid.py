import pytest
from unittest.mock import patch, MagicMock
from blueprints.rfid import parse_tags, store_tags_to_database, AlienRFID
from database import db
from database.backup import BackUpTag

@pytest.fixture
def mock_db_session(monkeypatch):
    mock_session = MagicMock()
    monkeypatch.setattr(db, 'session', mock_session)
    return mock_session

def test_parse_tags(mock_db_session):
    sample_data = """
    Tag:EPC 123456 Number 1, Disc:2024/03/25 10:15:30.123, Last:2024/03/25 10:15:35.456, Count:5, Ant:1, Proto:2
    Tag:EPC 789012 Number 2, Disc:2024/03/25 10:16:30.123, Last:2024/03/25 10:16:35.456, Count:3, Ant:2, Proto:2
    """
    
    with patch('blueprints.rfid.store_tags_to_database') as mock_store:
        mock_store.return_value = MagicMock()
        tags = parse_tags(sample_data)
        assert len(tags) == 2

def test_store_tags_to_database(mock_db_session):
    tag_data = {
        'tag_id': 'EPC 123456 Number 1',
        'number': 1,
        'last_seen_time': '2024/03/25 10:15:30.123'
    }
    
    result = store_tags_to_database(**tag_data)
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_called_once()

@patch('telnetlib.Telnet')
def test_rfid_connection(mock_telnet):
    mock_instance = mock_telnet.return_value
    mock_instance.read_until.return_value = b'>'
    
    alien = AlienRFID('localhost', 23)
    alien.connect()
    assert alien.connected

def test_rfid_command():
    with patch('telnetlib.Telnet') as mock_telnet:
        mock_instance = mock_telnet.return_value
        mock_instance.read_until.return_value = b'TestResponse>'
        
        alien = AlienRFID('localhost', 23)
        alien.connect()
        
        response = alien.command('TestCommand')
        assert 'TestResponse' in response