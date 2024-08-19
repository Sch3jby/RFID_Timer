# file for rfid reader

# rfid_reader.py

import socket
import time

class RFIDReader:
    def __init__(self, ip_address, port=20000):
        self.ip_address = ip_address
        self.port = port

    def connect(self):
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.ip_address, self.port))
            return True
        except socket.error as e:
            print(f"Error connecting to RFID reader: {e}")
            return False

    def disconnect(self):
        if self.socket:
            self.socket.close()

    def send_command(self, command):
        try:
            self.socket.sendall(command.encode())
            time.sleep(0.5)
            response = self.socket.recv(4096).decode()
            return response
        except socket.error as e:
            print(f"Error sending command: {e}")
            return None

    def read_tag(self):
        # Příkaz pro inventuru tagů, který může být specifický dle dokumentace
        command = "CAENRFID_InventoryTag\n"
        response = self.send_command(command)
        if response:
            # Předpokládáme, že odpověď obsahuje tag ID
            return self.parse_tag_response(response)
        return None

    def parse_tag_response(self, response):
        # Předpokládáme jednoduchý formát odpovědi
        lines = response.splitlines()
        for line in lines:
            if "EPC" in line:  # "EPC" označuje ID tagu
                return line#.split(":")[1].strip()
        return None
