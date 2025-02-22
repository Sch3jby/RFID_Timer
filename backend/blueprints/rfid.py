# blueprints/rfid.py
from flask import Blueprint, jsonify, request
from database import db
from database.backup import BackUpTag
import telnetlib
import re
from datetime import datetime
import configparser

# Load configuration from config.ini
config = configparser.ConfigParser()
config.read('config.ini')
# Get the RFID configuration
hostname = config.get('alien_rfid', 'hostname')
port = config.getint('alien_rfid', 'port')

rfid_bp = Blueprint('rfid', __name__)

class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False

    def connect(self):
        self.terminal = telnetlib.Telnet(self.hostname, self.port)
        self.terminal.read_until(b'Username>', timeout=3)
        self.terminal.write(b'alien\n')
        self.terminal.read_until(b'Password>', timeout=3)
        self.terminal.write(b'password\n')
        self.terminal.read_until(b'>', timeout=3)
        self.connected = True

    def disconnect(self):
        if self.connected and self.terminal:
            self.terminal.close()
            self.connected = False

    def command(self, cmd: str):
        if not self.connected:
            raise RuntimeError("Not connected to the RFID reader.")
        self.terminal.write(cmd.encode('utf-8') + b'\n')
        response = self.terminal.read_until(b'>', timeout=5)
        return response.decode('ascii')

alien = AlienRFID(hostname, port)

# Methods
def parse_tags(data):
    """Parse tag data from RFID reader response"""
    pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
    tags_found = []
    
    for line in data.split('\n'):
        if not line.strip():
            continue
            
        match = re.match(pattern, line.strip())
        if match:
            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                number = tag_id.strip().split()[-1]
                
                result = store_tags_to_database(
                    tag_id=tag_id.strip(),
                    number=int(number),
                    last_seen_time=last_seen_time
                )
                if result:
                    tags_found.append(result)
                    print(f'Successfully processed tag: {tag_id}')
            except Exception as e:
                print(f'Error processing line "{line}": {str(e)}')
        else:
            print(f'Line did not match pattern: {line}')
    
    return tags_found

def store_tags_to_database(tag_id, number, last_seen_time):
    """Store tag data in the database"""
    try:
        new_tag = BackUpTag(
            tag_id=tag_id,
            number=number,
            last_seen_time=last_seen_time
        )
        
        db.session.add(new_tag)
        db.session.commit()
        print(f'Stored new tag: {tag_id}')
        return new_tag
    
    except Exception as e:
        db.session.rollback()
        print(f'Error storing/updating tag {tag_id}: {str(e)}')
        raise

# Routes
@rfid_bp.route('/connect', methods=['POST'])
def connect_reader():
    try:
        if alien.connected:
            alien.disconnect()
            alien.connected = False
            return jsonify({"status": "disconnected"})
        
        try:
            alien.connect()
            alien.connected = True
            return jsonify({"status": "connected"})
        
        except Exception as e:
            alien.connected = False
            return jsonify({
                "status": "error", 
                "message": str(e)
            }), 400
    
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": "Unexpected system error"
        }), 500

@rfid_bp.route('/fetch_taglist', methods=['GET'])
def fetch_taglist():
    try:
        if not alien.connected:
            return jsonify({"status": "error", "message": "Not connected to RFID reader"})
        
        taglist_response = alien.command('get Taglist')
        parse_tags(taglist_response)
        print(taglist_response)
        tags = taglist_response.split("\n")
        middle_tags = tags[1:-1]
                    
        return jsonify({"status": "success", "taglist": middle_tags}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@rfid_bp.route('/tags', methods=['GET'])
def get_tags():
    """Get all stored tags from database"""
    try:
        tags = BackUpTag.query.all()
        tags_list = []
        for tag in tags:
            tags_list.append({
                'tag_id': tag.tag_id,
                'number': tag.number,
                'last_seen_time': tag.last_seen_time,
                'count': tag.count,
                'antenna': tag.antenna,
                'protocol': tag.protocol
            })
        return jsonify({'tags': tags_list}), 200
    except Exception as e:
        return jsonify({'error': 'Error fetching tags'}), 500