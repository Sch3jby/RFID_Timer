import psycopg2
from db import get_connection  # Adjust according to your connection method

def save_tag(tag):
    """Save an RFID tag to the database."""
    try:
        # Extract data from tag string
        tag_data = tag.split(", ")
        tag_value = tag_data[0].split(":")[1].strip()  # Get the tag value
        timestamp = tag_data[1].split(":")[1].strip()  # Get the timestamp

        conn = get_connection()
        cursor = conn.cursor()

        # Check if the tag already exists
        cursor.execute("SELECT COUNT(*) FROM rfid_tags WHERE tag = %s", (tag_value,))
        count = cursor.fetchone()[0]

        if count == 0:  # Only insert if the tag is not already in the table
            cursor.execute(
                "INSERT INTO rfid_tags (tag, first_seen) VALUES (%s, %s)",
                (tag_value, timestamp)
            )
            conn.commit()
            print(f"Tag {tag_value} saved.")
        else:
            print(f"Tag {tag_value} already exists.")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error saving tag: {e}")
