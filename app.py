# Main app file

# app.py

from flask import Flask, render_template, redirect, url_for
import sqlite3
from rfid_reader import RFIDReader

app = Flask(__name__)

# Inicializace RFID readeru s IP adresou a portem
rfid_reader = RFIDReader("192.168.0.1")

# Funkce pro připojení k databázi
def get_db_connection():
    conn = sqlite3.connect('rfid_data.db')
    conn.row_factory = sqlite3.Row
    return conn

# Inicializace databáze
def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS rfid_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag_id TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Inicializace databáze při spuštění aplikace
init_db()

@app.route('/')
def index():
    conn = get_db_connection()
    tags = conn.execute('SELECT * FROM rfid_tags ORDER BY timestamp DESC').fetchall()
    conn.close()
    return render_template('index.html', tags=tags)

@app.route('/read')
def read_tag():
    if rfid_reader.connect():
        tag_id = rfid_reader.read_tag()
        if tag_id:
            conn = get_db_connection()
            conn.execute('INSERT INTO rfid_tags (tag_id) VALUES (?)', (tag_id,))
            conn.commit()
            conn.close()
        rfid_reader.disconnect()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
