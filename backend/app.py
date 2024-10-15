from flask import Flask, jsonify, request
from flask_cors import CORS
import telnetlib
import configparser
import time
from db_operations import save_tag  # Import the save_tag function

# Initialize Flask application
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Load configuration from config.ini
config = configparser.ConfigParser()
config.read('config.ini')

# Get the RFID configuration
hostname = config.get('alien_rfid', 'hostname')
port = config.getint('alien_rfid', 'port')

# RFID reader connection state
class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False

    def connect(self, retries=5):
        for attempt in range(retries):
            try:
                self.terminal = telnetlib.Telnet(self.hostname, self.port)
                self.terminal.read_until(b'Username>', timeout=5)
                self.terminal.write(b'alien\n')  # Replace with actual username
                self.terminal.read_until(b'Password>', timeout=5)
                self.terminal.write(b'password\n')  # Replace with actual password
                self.terminal.read_until(b'>', timeout=5)
                self.connected = True
                return
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                time.sleep(2)
        raise RuntimeError(f"Failed to connect after {retries} attempts.")

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

is_saving = False  # Global variable to control saving state

@app.route('/')
def index():
    return "Welcome to the RFID Reader API!"

@app.route('/connect', methods=['POST'])
def connect_reader():
    try:
        if alien.connected:
            alien.disconnect()
            return jsonify({"status": "disconnected"})
        else:
            alien.connect(retries=5)
            return jsonify({"status": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/start_saving', methods=['POST'])
def start_saving():
    global is_saving
    is_saving = True
    return jsonify({"status": "saving_started"})

@app.route('/stop_saving', methods=['POST'])
def stop_saving():
    global is_saving
    is_saving = False
    return jsonify({"status": "saving_stopped"})

@app.route('/fetch_taglist', methods=['GET'])
def fetch_taglist():
    global is_saving
    try:
        if not alien.connected:
            return jsonify({"status": "error", "message": "Not connected to RFID reader"})
        
        taglist_response = alien.command('get Taglist')
        tags = taglist_response.split("\n")  # Assuming tags are separated by new lines
        
        if is_saving:
            for tag in tags:
                if tag:  # Check if tag is not empty
                    save_tag(tag)  # Save each tag to the database

        return jsonify({"status": "success", "taglist": taglist_response})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
