import telnetlib
import time
import threading

# Nastavení IP adresy a portu pro připojení k RFID čtečce
HOST = "192.168.0.103"
PORT = 23

# Přihlašovací údaje pro RFID čtečku
USERNAME = "alien"
PASSWORD = "password"

# Interval mezi dotazy (v sekundách)
QUERY_INTERVAL = 5

# Globální proměnná pro ukládání aktuálních tagů
visible_tags = []

def query_reader():
    global visible_tags
    while True:
        try:
            tn = telnetlib.Telnet(HOST, PORT)
            
            # Přihlášení do čtečky
            tn.read_until(b"Username> ")
            tn.write(USERNAME.encode('ascii') + b"\n")
            tn.read_until(b"Password> ")
            tn.write(PASSWORD.encode('ascii') + b"\n")
            
            # Odeslání příkazu getTaglist
            tn.write(b"getTaglist\r\n")
            response = tn.read_until(b"\r\n").decode('ascii')
            
            # Zpracování odpovědi
            tags = response.strip().split('\n')
            visible_tags = [tag for tag in tags if tag]
            
            # Zavření spojení
            tn.close()
        except Exception as e:
            print(f"Chyba při dotazování čtečky: {str(e)}")
        
        time.sleep(QUERY_INTERVAL)

# Spusťte dotazování čtečky v samostatném vlákně
thread = threading.Thread(target=query_reader)
thread.daemon = True
thread.start()
