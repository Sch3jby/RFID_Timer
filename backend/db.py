import psycopg2
import configparser

# Načti konfiguraci pro databázi
config = configparser.ConfigParser()
config.read('config.ini')

db_config = {
    'host': config.get('postgresql', 'host'),
    'port': config.get('postgresql', 'port'),
    'database': config.get('postgresql', 'database'),
    'user': config.get('postgresql', 'user'),
    'password': config.get('postgresql', 'password')
}

def get_db_connection():
    """Vytvoří a vrátí připojení k databázi."""
    conn = psycopg2.connect(
        host=db_config['host'],
        port=db_config['port'],
        database=db_config['database'],
        user=db_config['user'],
        password=db_config['password']
    )
    return conn

def insert_tag(tag):
    """Vloží nový RFID tag do databáze."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('INSERT INTO tags (tag_data) VALUES (%s)', (tag,))
    conn.commit()
    cur.close()
    conn.close()

def get_all_tags():
    """Načte všechny RFID tagy uložené v databázi."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT tag_data, timestamp FROM tags ORDER BY timestamp DESC')
    tags = cur.fetchall()
    cur.close()
    conn.close()
    return tags
