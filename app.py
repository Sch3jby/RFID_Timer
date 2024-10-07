from flask import Flask, render_template_string
from rfid_query import visible_tags  # Importujeme seznam tagů z rfid_query.py

app = Flask(__name__)

@app.route('/')
def index():
    global visible_tags
    return render_template_string("""
    <html>
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="5">  <!-- Obnovení stránky každých 5 sekund -->
        <title>RFID Tag List</title>
    </head>
    <body>
        <h1>Aktuálně viditelné RFID tagy</h1>
        <ul>
            {% for tag in tags %}
            <li>{{ tag }}</li>
            {% endfor %}
        </ul>
    </body>
    </html>
    """, tags=visible_tags)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
