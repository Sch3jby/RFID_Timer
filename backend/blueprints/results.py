# blueprints/results.py
from flask import Blueprint, jsonify, request, current_app
from database import db
from sqlalchemy import text
from datetime import datetime, time, timedelta
import re

from database.track import Track
from database.category import Category
from database.registration import Registration
from database.user import Users

results_bp = Blueprint('results', __name__)

def parse_time_with_ms(time_str):
    """Parse time string with optional milliseconds"""
    if '.' in time_str:
        time_part, ms_part = time_str.split('.')
        ms_part = ms_part.ljust(3, '0')[:3]
        
    try:
        base_time = datetime.strptime(time_part, '%H:%M:%S').time()
        return time(base_time.hour, base_time.minute, base_time.second, 
                   int(ms_part) * 1000)
    except ValueError as e:
        raise ValueError(f"Invalid time format: {str(e)}")

@results_bp.route('/store_results', methods=['POST'])
def store_results():
    try:
        data = request.json
        tags_raw = data.get('tags', [])
        race_id = data.get('race_id')
        track_id = data.get('track_id')

        if not race_id or not track_id:
            return jsonify({"status": "error", "message": "Race ID and Track ID are required"}), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        category = Category.query.filter_by(track_id=track_id).first()
        if not category:
            return jsonify({"status": "error", "message": "Category not found for this track"}), 404

        table_name = f'race_results_{race_id}'
        
        pattern = r"Tag:([\w\s]+), Disc:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Last:(\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}), Count:(\d+), Ant:(\d+), Proto:(\d+)"
        
        stored_results = 0
        tags_found = []
        
        for line in tags_raw:
            line = line.strip()
            if not line:
                continue
                
            match = re.match(pattern, line)
            if not match:
                continue

            try:
                tag_id, discovery_time, last_seen_time, count, ant, proto = match.groups()
                
                number = tag_id.strip().split()[-1]
                tag_id = tag_id.strip()
                
                last_seen_datetime = datetime.strptime(last_seen_time, "%Y/%m/%d %H:%M:%S.%f")
                current_time = (datetime.now() + timedelta(hours=1))

                offset = last_seen_datetime - current_time
                last_seen_datetime = last_seen_datetime - offset

                registration = Registration.query.filter_by(
                    race_id=race_id, 
                    track_id=track_id, 
                    number=number
                ).first()

                if not registration:
                    continue

                if not track.actual_start_time:
                    return jsonify({"status": "error", "message": "Actual start time not set for category"}), 400
                
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour, 
                    minutes=registration.user_start_time.minute, 
                    seconds=registration.user_start_time.second
                )
                category_start_delta = timedelta(
                    hours=track.actual_start_time.hour, 
                    minutes=track.actual_start_time.minute, 
                    seconds=track.actual_start_time.second
                )

                total_seconds = user_start_delta.seconds + category_start_delta.seconds
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)

                user_start_time = time(
                    hour=hours % 24,
                    minute=minutes,
                    second=seconds
                )

                race_start_datetime = datetime.combine(
                    last_seen_datetime.date(), 
                    user_start_time
                )

                min_lap_duration = timedelta(
                    hours=track.fastest_possible_time.hour, 
                    minutes=track.fastest_possible_time.minute, 
                    seconds=track.fastest_possible_time.second
                )

                last_entry = db.session.execute(
                    text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
                    {'number': number}
                ).fetchone()

                if last_entry:
                    if last_entry.lap_number >= track.number_of_laps:
                        continue

                if not last_entry:
                    if last_seen_datetime <= race_start_datetime + min_lap_duration:
                        continue
                    lap_number = 1
                else:
                    last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
                    
                    if last_seen_datetime <= last_tag_time + min_lap_duration:
                        continue
                    
                    lap_number = last_entry.lap_number + 1

                insert_sql = text(f'''
                    INSERT INTO {table_name} (
                        number,
                        tag_id, 
                        track_id, 
                        timestamp,
                        last_seen_time,
                        lap_number
                    ) 
                    VALUES (
                        :number,
                        :tag_id, 
                        :track_id, 
                        :timestamp,
                        :last_seen_time,
                        :lap_number
                    )
                ''')
                
                db.session.execute(insert_sql, {
                    'number': number,
                    'tag_id': tag_id, 
                    'track_id': track_id,
                    'timestamp': current_time,
                    'last_seen_time': last_seen_datetime,
                    'lap_number': lap_number
                })
                
                stored_results += 1
                tags_found.append(tag_id)
                
            except Exception as e:
                print(f"Error processing tag: {e}")
        
        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": f"Stored {stored_results} results for race {race_id}, track {track_id}",
            "tags_found": tags_found
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing results: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    
@results_bp.route('/manual_result_store', methods=['POST'])
def manual_result_store():
    try:
        data = request.json
        number = data.get('number')
        race_id = data.get('race_id')
        track_id = data.get('track_id')
        timestamp_str = data.get('timestamp')
        status = data.get('status')

        if not number or not race_id or not track_id:
            return jsonify({
                "status": "error", 
                "message": "Number, Race ID, and Track ID are required"
            }), 400

        valid_statuses = ['None', 'DNF', 'DNS', 'DSQ']
        if status and status not in valid_statuses:
            return jsonify({
                "status": "error",
                "message": "Invalid status. Must be one of: None, DNF, DNS, DSQ"
            }), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        registration = Registration.query.filter_by(
            race_id=race_id, 
            track_id=track_id, 
            number=number
        ).first()
        
        if not registration:
            return jsonify({"status": "error", "message": "Registration not found"}), 404

        if timestamp_str:
            try:
                timestamp = datetime.combine(
                    datetime.now().date(), 
                    (datetime.strptime(timestamp_str, "%H:%M:%S") + timedelta(milliseconds=1)).time()
                )
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid timestamp format. Use HH:MM:SS."
                }), 400
        else:
            timestamp = datetime.now() + timedelta(hours=1)

        table_name = f'race_results_{race_id}'

        last_entry = db.session.execute(
            text(f'SELECT lap_number, timestamp, last_seen_time FROM {table_name} WHERE number = :number ORDER BY timestamp DESC LIMIT 1'),
            {'number': number}
        ).fetchone()

        min_lap_duration = timedelta(
            hours=track.fastest_possible_time.hour,
            minutes=track.fastest_possible_time.minute,
            seconds=track.fastest_possible_time.second
        )

        user_start_delta = timedelta(
            hours=registration.user_start_time.hour,
            minutes=registration.user_start_time.minute,
            seconds=registration.user_start_time.second
        )
        category_start_delta = timedelta(
            hours=track.actual_start_time.hour,
            minutes=track.actual_start_time.minute,
            seconds=track.actual_start_time.second
        )

        total_seconds = user_start_delta.seconds + category_start_delta.seconds
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        user_start_time = time(
            hour=hours % 24,
            minute=minutes,
            second=seconds
        )

        race_start_datetime = datetime.combine(timestamp.date(), user_start_time)

        if last_entry:
            if last_entry.lap_number >= track.number_of_laps:
                return jsonify({
                    "status": "error",
                    "message": "Maximum number of laps already recorded"
                }), 400

            last_tag_time = datetime.strptime(str(last_entry.last_seen_time), "%Y-%m-%d %H:%M:%S.%f")
            
            if status not in ['DNS', 'DSQ', 'DNF']:
                if timestamp <= last_tag_time + min_lap_duration:
                    return jsonify({
                        "status": "error",
                        "message": "Time between laps is less than minimum allowed"
                    }), 400
                    
            lap_number = last_entry.lap_number + 1
        else:
            if timestamp <= race_start_datetime + min_lap_duration:
                return jsonify({
                    "status": "error",
                    "message": "Time from race start is less than minimum allowed"
                }), 400
            lap_number = 1

        insert_sql = text(f'''
            INSERT INTO {table_name} (
                number,
                tag_id,
                track_id,
                timestamp,
                last_seen_time,
                lap_number,
                status
            ) 
            VALUES (
                :number,
                :tag_id,
                :track_id,
                :timestamp,
                :last_seen_time,
                :lap_number,
                :status
            )
        ''')
        
        tag_id = f"manually added Tag: {number}"
        
        db.session.execute(insert_sql, {
            'number': number,
            'tag_id': tag_id,
            'track_id': track_id,
            'timestamp': timestamp,
            'last_seen_time': timestamp,
            'lap_number': lap_number,
            'status': status if status != 'None' else None
        })

        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "message": f"Manually stored result for race {race_id}, track {track_id}, number {number}",
            "tag_id": tag_id
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing manual result: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@results_bp.route('/race/<int:race_id>/results', methods=['GET'])
def get_race_results(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS.MS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_track_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY track_name) as min_track_time,
                    ROW_NUMBER() OVER (
                        PARTITION BY track_name 
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_track
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            ),
            results_with_category_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY category_name, track_name) as min_category_time,
                    ROW_NUMBER() OVER (
                        PARTITION BY category_name, track_name
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_category
                FROM results_with_track_time
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_track::text 
                END as position_track,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_category::text 
                END as position_category,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_track_time) || ' seconds')::interval,
                        'HH24:MI:SS.MS'
                    )
                END as behind_time_track,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_category_time) || ' seconds')::interval,
                        'HH24:MI:SS.MS'
                    )
                END as behind_time_category
            FROM results_with_category_time
            ORDER BY 
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_track': row.position_track if row.race_time is not None else '-',
                'position_category': row.position_category if row.race_time is not None else '-',
                'behind_time_track': row.behind_time_track or ' ',
                'behind_time_category': row.behind_time_category or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500
    
@results_bp.route('/race/<int:race_id>/results/by-category', methods=['GET'])
def get_race_results_by_category(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_category_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY category_name, track_name) as min_category_time,
                    RANK() OVER (
                        PARTITION BY category_name, track_name
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_category
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_category::text 
                END as position_category,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_category_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_category
            FROM results_with_category_time
            ORDER BY 
                category_name,
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_category': row.position_category if row.race_time is not None else '-',
                'behind_time_category': row.behind_time_category or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results by category: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500

@results_bp.route('/race/<int:race_id>/results/by-track', methods=['GET'])
def get_race_results_by_track(race_id):
    try:
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            );
        """)
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM {table_name} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM {table_name} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.year,
                    u.gender,
                    t.name as track_name,
                    reg.track_id,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            TO_CHAR(
                                (EXTRACT(EPOCH FROM (
                                    ll.last_lap_timestamp - 
                                    (date_trunc('day', ll.last_lap_timestamp) + 
                                    t.actual_start_time::time + 
                                    reg.user_start_time::interval)
                                )) || ' seconds')::interval,
                                'HH24:MI:SS'
                            )
                        ELSE '--:--:--'
                    END as race_time,
                    CASE 
                        WHEN ll.status IS NULL AND ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM {table_name} r
                JOIN latest_laps ll ON r.number = ll.number
                    AND r.timestamp = ll.last_lap_timestamp
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
            ),
            results_with_track_time AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY track_name) as min_track_time,
                    RANK() OVER (
                        PARTITION BY track_name 
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_track
                FROM ranked_results
                WHERE status IS NULL OR status IN ('DNF', 'DNS', 'DSQ')
            )
            SELECT 
                number,
                firstname,
                surname,
                club,
                category_name,
                track_name,
                status,
                lap_number,
                number_of_laps,
                race_time,
                last_seen_time,
                track_id,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_track::text 
                END as position_track,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_track_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_track
            FROM results_with_track_time
            ORDER BY 
                track_name,
                CASE 
                    WHEN status IS NOT NULL THEN 2
                    WHEN race_time_seconds IS NULL THEN 1 
                    ELSE 0 
                END,
                race_time_seconds;
        """)
        
        results = db.session.execute(query, {'race_id': race_id}).fetchall()
        
        if not results:
            return jsonify({'results': []}), 204

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'name': f"{row.firstname} {row.surname}",
                'club': row.club,
                'category': row.category_name or 'N/A',
                'track': row.track_name,
                'track_id': row.track_id,
                'race_time': row.race_time or '--:--:--',
                'last_seen_time': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_track': row.position_track if row.race_time is not None else '-',
                'behind_time_track': row.behind_time_track or ' ',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results by track: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500
    
@results_bp.route('/race/<int:race_id>/racer/<int:number>/laps', methods=['GET'])
def get_runner_laps(race_id, number):
    try:
        table_name = f'race_results_{race_id}'
        
        query = text(f"""
            WITH runner_laps AS (
                SELECT 
                    r.lap_number,
                    r.timestamp,
                    reg.user_start_time,
                    t.actual_start_time
                FROM {table_name} r
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN track t ON t.id = reg.track_id
                WHERE r.number = :number
                ORDER BY r.lap_number
            ),
            lap_times AS (
                SELECT 
                    lap_number,
                    timestamp,
                    CASE 
                        WHEN lap_number = 1 THEN
                            timestamp - (date_trunc('day', timestamp) + 
                                actual_start_time::time + 
                                user_start_time::interval)
                        ELSE
                            timestamp - LAG(timestamp) OVER (ORDER BY lap_number)
                    END as lap_time,
                    timestamp - (date_trunc('day', timestamp) + 
                        actual_start_time::time + 
                        user_start_time::interval) as total_time
                FROM runner_laps
            )
            SELECT 
                lap_number,
                TO_CHAR(timestamp, 'HH24:MI:SS') as timestamp,
                TO_CHAR(lap_time, 'HH24:MI:SS.MS') as lap_time,
                TO_CHAR(total_time, 'HH24:MI:SS.MS') as total_time
            FROM lap_times
            ORDER BY lap_number;
        """)
        
        results = db.session.execute(query, {
            'race_id': race_id,
            'number': number
        }).fetchall()

        if not results:
            return jsonify({'error': 'No lap data found'}), 404

        laps = [{
            'lap_number': row.lap_number,
            'timestamp': row.timestamp,
            'lap_time': row.lap_time,
            'total_time': row.total_time
        } for row in results]
        
        return jsonify({'laps': laps}), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching runner laps: {str(e)}')
        return jsonify({'error': 'Failed to fetch runner laps'}), 500

@results_bp.route('/race/<int:race_id>/result/update', methods=['POST'])
def update_race_result(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        track_id = data.get('track_id')
        new_time = data.get('time')
        status = data.get('status')
        last_seen_time = data.get('last_seen_time')

        if not number or not track_id:
            return jsonify({'error': 'Missing required fields'}), 400

        track = Track.query.get(track_id)
        registration = Registration.query.filter_by(
            track_id=track_id, 
            number=number
        ).first()

        if not track or not registration:
            return jsonify({'error': 'Track or registration not found'}), 404

        table_name = f'race_results_{race_id}'
        updates = []
        params = {'number': number}

        if status is not None or 'status' in data:
            status_update_query = text(f"""
                UPDATE {table_name}
                SET status = :status
                WHERE number = :number
            """)
            db.session.execute(status_update_query, {
                'status': status,
                'number': number
            })

        if last_seen_time:
            try:
                time_obj = parse_time_with_ms(last_seen_time)
                full_last_seen = datetime.combine(datetime.now().date(), time_obj)
                
                updates.append("last_seen_time = :last_seen_time")
                params['last_seen_time'] = full_last_seen
                
                if not new_time:
                    updates.append("timestamp = :timestamp")
                    params['timestamp'] = full_last_seen
                    
            except ValueError as e:
                return jsonify({'error': f'Invalid time format for last_seen_time: {str(e)}'}), 400

        if new_time:
            try:
                time_obj = parse_time_with_ms(new_time)
                
                actual_start_time = track.actual_start_time
                user_start_time = registration.user_start_time
                
                if not actual_start_time or not user_start_time:
                    return jsonify({'error': 'Missing start time information'}), 400

                actual_delta = timedelta(hours=actual_start_time.hour,
                                    minutes=actual_start_time.minute,
                                    seconds=actual_start_time.second,
                                    microseconds=actual_start_time.microsecond)
                
                user_delta = timedelta(hours=user_start_time.hour,
                                    minutes=user_start_time.minute,
                                    seconds=user_start_time.second,
                                    microseconds=user_start_time.microsecond)
                
                time_delta = timedelta(hours=time_obj.hour,
                                    minutes=time_obj.minute,
                                    seconds=time_obj.second,
                                    microseconds=time_obj.microsecond)
                
                total_time = actual_delta + user_delta + time_delta
                
                current_date = datetime.now().date()
                final_timestamp = datetime.combine(current_date, datetime.min.time()) + total_time
                
                updates.append("timestamp = :new_timestamp")
                params['new_timestamp'] = final_timestamp
                
                updates.append("last_seen_time = :new_last_seen_time")
                params['new_last_seen_time'] = final_timestamp
                
            except ValueError as e:
                return jsonify({'error': f'Invalid time format for new_time: {str(e)}'}), 400

        if updates:
            update_query = text(f"""
                UPDATE {table_name}
                SET {', '.join(updates)}
                WHERE number = :number
                AND lap_number = (
                    SELECT MAX(lap_number)
                    FROM {table_name}
                    WHERE number = :number
                )
            """)
            
            db.session.execute(update_query, params)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Update successful',
            'timestamp': params.get('new_timestamp') or params.get('timestamp'),
            'last_seen_time': params.get('new_last_seen_time') or params.get('last_seen_time')
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating result: {str(e)}')
        return jsonify({'error': str(e)}), 500

@results_bp.route('/race/<int:race_id>/lap/update', methods=['POST'])
def update_lap_time(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        lap_number = data.get('lap_number')
        lap_time = data.get('lap_time')
        timestamp = data.get('timestamp')

        if not number or not lap_number:
            return jsonify({'error': 'Missing required fields'}), 400

        if not lap_time and not timestamp:
            return jsonify({'error': 'Either lap_time or timestamp must be provided'}), 400

        table_name = f'race_results_{race_id}'

        registration = Registration.query.filter_by(
            race_id=race_id,
            number=number
        ).first()

        if not registration:
            return jsonify({'error': 'Runner not found'}), 404

        track = Track.query.get(registration.track_id)
        if not track:
            return jsonify({'error': 'Track not found'}), 404

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()
        
        target_lap = None
        for lap in laps:
            if lap.lap_number == lap_number:
                target_lap = lap
                break

        if not target_lap:
            return jsonify({'error': 'Lap not found'}), 404

        if timestamp:
            try:
                time_obj = parse_time_with_ms(timestamp)
                update_query = text(f"""
                    UPDATE {table_name}
                    SET 
                        timestamp = DATE(timestamp) + time :time_obj,
                        last_seen_time = DATE(timestamp) + time :time_obj
                    WHERE number = :number
                    AND lap_number = :lap_number
                    RETURNING timestamp
                """)
                result = db.session.execute(update_query, {
                    'time_obj': time_obj,
                    'number': number,
                    'lap_number': lap_number
                }).first()
                
                if not result:
                    return jsonify({'error': 'Failed to update timestamp'}), 500
                
                new_timestamp = result[0]

            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

        else:
            try:
                time_obj = parse_time_with_ms(lap_time)
            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

            if lap_number == 1:
                actual_start = datetime.combine(target_lap.timestamp.date(), track.actual_start_time)
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour,
                    minutes=registration.user_start_time.minute,
                    seconds=registration.user_start_time.second,
                    microseconds=registration.user_start_time.microsecond
                )
                
                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                new_timestamp = actual_start + user_start_delta + time_delta
            else:
                prev_lap = None
                for lap in laps:
                    if lap.lap_number == lap_number - 1:
                        prev_lap = lap
                        break
                
                if not prev_lap:
                    return jsonify({'error': 'Previous lap not found'}), 404

                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                new_timestamp = prev_lap.timestamp + time_delta

            update_query = text(f"""
                UPDATE {table_name}
                SET 
                    timestamp = :new_timestamp,
                    last_seen_time = :new_timestamp
                WHERE number = :number
                AND lap_number = :lap_number
            """)
            
            db.session.execute(update_query, {
                'new_timestamp': new_timestamp,
                'number': number,
                'lap_number': lap_number
            })

        subsequent_laps = [lap for lap in laps if lap.lap_number > lap_number]
        for next_lap in subsequent_laps:
            query = text(f"""
                SELECT 
                    timestamp - LAG(timestamp) OVER (ORDER BY lap_number) as lap_time
                FROM {table_name}
                WHERE number = :number
                AND lap_number = :lap_number
            """)
            
            result = db.session.execute(query, {
                'number': number,
                'lap_number': next_lap.lap_number
            }).first()
            
            if result and result.lap_time:
                update_query = text(f"""
                    UPDATE {table_name}
                    SET 
                        timestamp = (
                            SELECT timestamp + :lap_time
                            FROM {table_name}
                            WHERE number = :number
                            AND lap_number = :prev_lap_number
                        ),
                        last_seen_time = (
                            SELECT timestamp + :lap_time
                            FROM {table_name}
                            WHERE number = :number
                            AND lap_number = :prev_lap_number
                        )
                    WHERE number = :number
                    AND lap_number = :lap_number
                """)
                
                db.session.execute(update_query, {
                    'lap_time': result.lap_time,
                    'number': number,
                    'prev_lap_number': next_lap.lap_number - 1,
                    'lap_number': next_lap.lap_number
                })

        final_lap_query = text(f"""
            UPDATE {table_name}
            SET 
                last_seen_time = timestamp,
                timestamp = timestamp
            WHERE number = :number
            AND lap_number = (
                SELECT MAX(lap_number)
                FROM {table_name}
                WHERE number = :number
            )
        """)
        
        db.session.execute(final_lap_query, {'number': number})
        
        db.session.commit()
        
        return jsonify({
            'message': 'Lap updated successfully',
            'new_timestamp': new_timestamp.strftime('%H:%M:%S.%f')[:-3]
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating lap: {str(e)}')
        return jsonify({'error': str(e)}), 500
    
@results_bp.route('/race/<int:race_id>/lap/delete', methods=['POST'])
def delete_lap(race_id):
    try:
        data = request.get_json()
        number = data.get('number')
        lap_number = data.get('lap_number')

        if not number or not lap_number:
            return jsonify({'error': 'Missing required fields'}), 400

        table_name = f'race_results_{race_id}'

        registration = Registration.query.filter_by(
            race_id=race_id,
            number=number
        ).first()

        if not registration:
            return jsonify({'error': 'Runner not found'}), 404

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()
        
        target_lap = None
        for lap in laps:
            if lap.lap_number == lap_number:
                target_lap = lap
                break

        if not target_lap:
            return jsonify({'error': 'Lap not found'}), 404

        delete_query = text(f"""
            DELETE FROM {table_name}
            WHERE number = :number
            AND lap_number = :lap_number
        """)
        
        db.session.execute(delete_query, {
            'number': number,
            'lap_number': lap_number
        })

        subsequent_laps = [lap for lap in laps if lap.lap_number > lap_number]
        
        if subsequent_laps:
            prev_lap_query = text(f"""
                SELECT timestamp
                FROM {table_name}
                WHERE number = :number
                AND lap_number < :deleted_lap_number
                ORDER BY lap_number DESC
                LIMIT 1
            """)
            
            prev_lap = db.session.execute(prev_lap_query, {
                'number': number,
                'deleted_lap_number': lap_number
            }).first()

            prev_timestamp = prev_lap.timestamp if prev_lap else None

            for next_lap in subsequent_laps:
                lap_time_query = text(f"""
                    SELECT 
                        timestamp - LAG(timestamp) OVER (ORDER BY lap_number) as lap_time
                    FROM {table_name}
                    WHERE number = :number
                    AND lap_number = :lap_number
                """)
                
                result = db.session.execute(lap_time_query, {
                    'number': number,
                    'lap_number': next_lap.lap_number
                }).first()

                if result and result.lap_time and prev_timestamp:
                    update_query = text(f"""
                        UPDATE {table_name}
                        SET 
                            timestamp = :new_timestamp,
                            last_seen_time = :new_timestamp
                        WHERE number = :number
                        AND lap_number = :lap_number
                    """)

                    new_timestamp = prev_timestamp + result.lap_time
                    
                    db.session.execute(update_query, {
                        'new_timestamp': new_timestamp,
                        'number': number,
                        'lap_number': next_lap.lap_number
                    })

                    prev_timestamp = new_timestamp

        final_lap_query = text(f"""
            UPDATE {table_name}
            SET last_seen_time = timestamp
            WHERE number = :number
            AND lap_number = (
                SELECT MAX(lap_number)
                FROM {table_name}
                WHERE number = :number
            )
        """)
        
        db.session.execute(final_lap_query, {'number': number})

        db.session.commit()
        
        return jsonify({'message': 'Lap deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting lap: {str(e)}')
        return jsonify({'error': str(e)}), 500
    
@results_bp.route('/race/<int:race_id>/lap/add', methods=['POST'])
def add_manual_lap(race_id):
    try:
        data = request.json
        number = data.get('number')
        track_id = data.get('track_id')
        lap_number = data.get('lap_number')
        timestamp_str = data.get('timestamp')
        time_str = data.get('time')

        if not number or not track_id or not lap_number:
            return jsonify({
                "status": "error", 
                "message": "Number, Track ID, and Lap Number are required"
            }), 400

        if not time_str and not timestamp_str:
            return jsonify({'error': 'Either time or timestamp must be provided'}), 400

        track = Track.query.get(track_id)
        if not track:
            return jsonify({"status": "error", "message": "Track not found"}), 404

        registration = Registration.query.filter_by(
            race_id=race_id, 
            track_id=track_id, 
            number=number
        ).first()
        
        if not registration:
            return jsonify({"status": "error", "message": "Registration not found"}), 404

        table_name = f'race_results_{race_id}'

        query = text(f"""
            SELECT 
                lap_number,
                timestamp
            FROM {table_name}
            WHERE number = :number
            ORDER BY lap_number
        """)
        
        laps = db.session.execute(query, {'number': number}).fetchall()

        if timestamp_str:
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    return jsonify({
                        "status": "error",
                        "message": "Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM:SS.fff"
                    }), 400
        else:
            try:
                time_obj = parse_time_with_ms(time_str)
            except ValueError as e:
                return jsonify({'error': f'Invalid time format: {str(e)}'}), 400

            if lap_number == 1:
                actual_start = datetime.combine(
                    datetime.strptime(data.get('date'), "%Y-%m-%d").date(),
                    track.actual_start_time
                )
                user_start_delta = timedelta(
                    hours=registration.user_start_time.hour,
                    minutes=registration.user_start_time.minute,
                    seconds=registration.user_start_time.second,
                    microseconds=registration.user_start_time.microsecond
                )
                
                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                timestamp = actual_start + user_start_delta + time_delta
            else:
                prev_lap = None
                for lap in laps:
                    if lap.lap_number == lap_number - 1:
                        prev_lap = lap
                        break
                
                if not prev_lap:
                    return jsonify({'error': 'Previous lap not found'}), 404

                time_delta = timedelta(
                    hours=time_obj.hour,
                    minutes=time_obj.minute,
                    seconds=time_obj.second,
                    microseconds=time_obj.microsecond
                )
                
                timestamp = prev_lap.timestamp + time_delta

        tag_id = f"manually added Tag: {number}"
        
        insert_sql = text(f'''
            INSERT INTO {table_name} (
                number,
                tag_id,
                track_id,
                timestamp,
                last_seen_time,
                lap_number
            ) 
            VALUES (
                :number,
                :tag_id,
                :track_id,
                :timestamp,
                :last_seen_time,
                :lap_number
            )
        ''')
        
        db.session.execute(insert_sql, {
            'number': number,
            'tag_id': tag_id,
            'track_id': track_id,
            'timestamp': timestamp,
            'last_seen_time': timestamp,
            'lap_number': lap_number
        })

        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "message": f"Manually stored result for race {race_id}, track {track_id}, number {number}",
            "tag_id": tag_id,
            "timestamp": timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error storing manual result: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@results_bp.route('/race/<race_id>/results/by-email/<email>', methods=['GET'])
def get_race_results_by_email(race_id, email):
    try:
        user = db.session.query(Users).filter_by(email=email).first()
        if not user:
            return jsonify({'error': f'User with email {email} not found'}), 404
            
        table_name = f'race_results_{race_id}'
        
        table_exists_query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = :table_name
            );
        """)
        
        table_exists = db.session.execute(table_exists_query, 
            {'table_name': table_name}).scalar()
            
        if not table_exists:
            return jsonify({'error': f'No results found for race {race_id}'}), 404

        query = text(f"""
            WITH status_laps AS (
                SELECT 
                    r.number,
                    r.timestamp,
                    r.lap_number,
                    r.status,
                    r.last_seen_time
                FROM race_results_{race_id} r
                WHERE r.status IN ('DNF', 'DNS', 'DSQ')
            ),
            latest_laps AS (
                SELECT 
                    r.number,
                    CASE 
                        WHEN sl.timestamp IS NOT NULL THEN sl.timestamp
                        ELSE MAX(r.timestamp)
                    END as last_lap_timestamp,
                    CASE 
                        WHEN sl.lap_number IS NOT NULL THEN sl.lap_number
                        ELSE MAX(r.lap_number)
                    END as lap_number,
                    sl.status,
                    MAX(r.last_seen_time) as last_seen_time
                FROM race_results_{race_id} r
                LEFT JOIN (
                    SELECT DISTINCT ON (number)
                        number, timestamp, lap_number, status, last_seen_time
                    FROM status_laps
                    ORDER BY number, timestamp ASC
                ) sl ON r.number = sl.number
                GROUP BY r.number, sl.timestamp, sl.lap_number, sl.status
            ),
            ranked_results AS (
                SELECT 
                    r.number,
                    ll.last_lap_timestamp,  -- Changed from ll.timestamp to ll.last_lap_timestamp
                    ll.lap_number,
                    ll.status,
                    ll.last_seen_time,
                    u.firstname,
                    u.surname,
                    u.club,
                    u.gender,
                    t.name as track_name,
                    c.category_name,
                    t.actual_start_time,
                    t.number_of_laps,
                    reg.user_start_time,
                    CASE 
                        WHEN ll.lap_number = t.number_of_laps THEN
                            EXTRACT(EPOCH FROM (
                                ll.last_lap_timestamp - 
                                (date_trunc('day', ll.last_lap_timestamp) + 
                                t.actual_start_time::time + 
                                reg.user_start_time::interval)
                            ))
                        ELSE NULL
                    END as race_time_seconds
                FROM race_results_{race_id} r
                JOIN latest_laps ll ON r.number = ll.number
                JOIN registration reg ON reg.number = r.number 
                    AND reg.race_id = :race_id
                JOIN users u ON u.id = reg.user_id
                JOIN track t ON t.id = reg.track_id
                LEFT JOIN category c ON c.track_id = reg.track_id 
                    AND c.gender = u.gender 
                    AND EXTRACT(YEAR FROM CURRENT_DATE) - u.year 
                        BETWEEN c.min_age AND c.max_age
                WHERE u.email = :email
            ),
            track_results AS (
                SELECT *,
                    MIN(race_time_seconds) OVER (PARTITION BY track_name) as min_track_time,
                    RANK() OVER (
                        PARTITION BY track_name 
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_track
                FROM ranked_results
            ),
            category_results AS (
                SELECT
                    tr.*,
                    MIN(race_time_seconds) OVER (PARTITION BY category_name, track_name) as min_category_time,
                    RANK() OVER (
                        PARTITION BY category_name, track_name
                        ORDER BY 
                            CASE 
                                WHEN status IS NOT NULL THEN 2
                                WHEN race_time_seconds IS NULL THEN 1 
                                ELSE 0 
                            END,
                            race_time_seconds
                    ) as position_category
                FROM track_results tr
            )
            SELECT 
                number,
                firstname,
                surname, 
                track_name,
                category_name,
                lap_number,
                number_of_laps,
                last_seen_time,
                status,
                CASE 
                    WHEN race_time_seconds IS NOT NULL THEN 
                        TO_CHAR((race_time_seconds || ' seconds')::interval, 'HH24:MI:SS')
                    ELSE '--:--:--'
                END as race_time,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_track::text 
                END as position_track,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_track_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_track,
                CASE 
                    WHEN status IS NOT NULL THEN status
                    ELSE position_category::text 
                END as position_category,
                CASE 
                    WHEN status IS NOT NULL THEN NULL
                    WHEN race_time_seconds IS NULL THEN NULL
                    ELSE TO_CHAR(
                        ((race_time_seconds - min_category_time) || ' seconds')::interval,
                        'HH24:MI:SS'
                    )
                END as behind_time_category
            FROM category_results
            ORDER BY track_name, number;
        """)
        
        results = db.session.execute(query, {
            'race_id': str(race_id),
            'email': email
        }).fetchall()
        
        if not results:
            return jsonify({'results': []}), 200

        formatted_results = []
        for row in results:
            formatted_results.append({
                'number': row.number,
                'firstname': row.firstname,
                'surname': row.surname,
                'track': row.track_name,
                'category': row.category_name or 'N/A',
                'lap_number': row.lap_number,
                'total_laps': row.number_of_laps,
                'race_time': row.race_time,
                'last_seen': row.last_seen_time.strftime('%H:%M:%S') if row.last_seen_time else '--:--:--',
                'position_track': row.position_track,
                'behind_time_track': row.behind_time_track or '--:--:--',
                'position_category': row.position_category,
                'behind_time_category': row.behind_time_category or '--:--:--',
                'status': row.status
            })
        
        return jsonify({
            'results': formatted_results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching race results by email: {str(e)}')
        return jsonify({'error': 'Failed to fetch race results'}), 500