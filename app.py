from flask import Flask, jsonify, render_template
import telnetlib
import configparser
import time

app = Flask(__name__)

# Load configuration from config.ini
config = configparser.ConfigParser()
config.read('config.ini')

# Get the RFID configuration
hostname = config.get('alien_rfid', 'hostname')
port = config.getint('alien_rfid', 'port')

class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None
        self.connected = False  # Track connection state

    def connect(self, retries=5, delay=2):
        """Attempt to connect with retry logic."""
        for attempt in range(retries):
            try:
                self.terminal = telnetlib.Telnet(self.hostname, self.port)

                # Reading until the username prompt
                initial_header = self.terminal.read_until(b'Username>', timeout=5)
                print(initial_header.decode('ascii'))

                # Sending the username 'alien'
                self.terminal.write(b'alien\n')

                # Waiting for the password prompt
                password_prompt = self.terminal.read_until(b'Password>', timeout=5)
                print(password_prompt.decode('ascii'))

                # Sending the password 'password'
                self.terminal.write(b'password\n')

                # Waiting for the command prompt after successful login
                login_response = self.terminal.read_until(b'>', timeout=5)
                print(login_response.decode('ascii'))

                self.connected = True
                return  # Success
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                time.sleep(delay)  # Wait before retrying
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

# Instantiate the RFID object with configuration values
alien = AlienRFID(hostname, port)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/connect', methods=['POST'])
def connect():
    try:
        if alien.connected:
            alien.disconnect()
            return jsonify({"status": "disconnected"})
        else:
            alien.connect(retries=5, delay=2)
            return jsonify({"status": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/fetch_taglist', methods=['GET'])
def fetch_taglist():
    try:
        if not alien.connected:
            return jsonify({"status": "error", "message": "Not connected to RFID reader"})
        taglist_response = alien.command('get Taglist')
        return jsonify({"status": "success", "taglist": taglist_response})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(debug=True)
