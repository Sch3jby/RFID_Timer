from flask import Flask, render_template, request, jsonify
import telnetlib

app = Flask(__name__)

class AlienRFID:
    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port
        self.terminal = None

    def connect(self):
        try:
            self.terminal = telnetlib.Telnet(self.hostname, self.port)
            initial_header = self.terminal.read_until(b'>', timeout=5)
            print(initial_header.decode('ascii'))
            self.command('alien')
            self.command('password')

        except Exception as e:
            raise RuntimeError(f"An error occurred: {e}")

    def command(self, cmd: str):
        self.terminal.write(cmd.encode('utf-8') + b'\n')
        response = self.terminal.read_until(b'>', timeout=5)
        return response.decode('ascii')

# Instantiate the RFID object
alien = AlienRFID("192.168.0.103", 23)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/connect', methods=['POST'])
def connect():
    try:
        alien.connect()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/fetch_taglist')
def fetch_taglist():
    try:
        taglist_response = alien.command('get Taglist')
        return jsonify({"taglist": taglist_response})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(debug=True)
