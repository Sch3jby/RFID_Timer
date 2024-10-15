import psycopg2
import configparser

config = configparser.ConfigParser()
config.read('config.ini')

def get_connection():
    """Get a connection to the database."""
    db_config = {
        'host': config.get('database', 'host'),
        'port': config.getint('database', 'port'),
        'database': config.get('database', 'database'),
        'user': config.get('database', 'user'),
        'password': config.get('database', 'password')
    }

    connection = psycopg2.connect(
        host=db_config['host'],
        port=db_config['port'],
        database=db_config['database'],
        user=db_config['user'],
        password=db_config['password']
    )
    return connection
