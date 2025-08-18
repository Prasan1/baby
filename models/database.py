import sqlite3
from datetime import datetime
import os

DATABASE = 'baby_tracker.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                baby_name TEXT,
                due_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS feeding_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                feeding_type TEXT NOT NULL,
                amount REAL,
                duration INTEGER,
                notes TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
            
            CREATE TABLE IF NOT EXISTS sleep_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
            
            CREATE TABLE IF NOT EXISTS vaccine_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                vaccine_name TEXT NOT NULL,
                date_given TIMESTAMP NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')

class User:
    def __init__(self, id, name, email, password_hash, baby_name=None, due_date=None, created_at=None):
        self.id = id
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.baby_name = baby_name
        self.due_date = due_date
        self.created_at = created_at
    
    @classmethod
    def create(cls, name, email, password_hash, baby_name=None, due_date=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (name, email, password_hash, baby_name, due_date) VALUES (?, ?, ?, ?, ?)',
                (name, email, password_hash, baby_name, due_date)
            )
            user_id = cursor.lastrowid
            return cls(user_id, name, email, password_hash, baby_name, due_date)
    
    @classmethod
    def get_by_email(cls, email):
        with get_db() as conn:
            cursor = conn.cursor()
            row = cursor.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
            if row:
                return cls(**row)
        return None
    
    @classmethod
    def get_by_id(cls, user_id):
        with get_db() as conn:
            cursor = conn.cursor()
            row = cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
            if row:
                return cls(**row)
        return None

class FeedingRecord:
    def __init__(self, id, user_id, feeding_type, amount=None, duration=None, notes=None, timestamp=None):
        self.id = id
        self.user_id = user_id
        self.feeding_type = feeding_type
        self.amount = amount
        self.duration = duration
        self.notes = notes
        self.timestamp = timestamp
    
    @classmethod
    def create(cls, user_id, feeding_type, amount=None, duration=None, notes=None, timestamp=None):
        if timestamp is None:
            timestamp = datetime.now()
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO feeding_records (user_id, feeding_type, amount, duration, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                (user_id, feeding_type, amount, duration, notes, timestamp)
            )
            record_id = cursor.lastrowid
            return cls(record_id, user_id, feeding_type, amount, duration, notes, timestamp)
    
    @classmethod
    def get_by_user(cls, user_id, limit=50):
        with get_db() as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                'SELECT * FROM feeding_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
                (user_id, limit)
            ).fetchall()
            return [cls(r['id'], r['user_id'], r['feeding_type'], r['amount'], 
                       r['duration'], r['notes'], datetime.fromisoformat(r['timestamp'])) for r in rows]

class SleepRecord:
    def __init__(self, id, user_id, start_time, end_time=None, notes=None, created_at=None):
        self.id = id
        self.user_id = user_id
        self.start_time = start_time
        self.end_time = end_time
        self.notes = notes
        self.created_at = created_at
    
    @classmethod
    def create(cls, user_id, start_time, end_time=None, notes=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO sleep_records (user_id, start_time, end_time, notes) VALUES (?, ?, ?, ?)',
                (user_id, start_time, end_time, notes)
            )
            record_id = cursor.lastrowid
            return cls(record_id, user_id, start_time, end_time, notes)
    
    @classmethod
    def get_by_user(cls, user_id, limit=50):
        with get_db() as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                'SELECT * FROM sleep_records WHERE user_id = ? ORDER BY start_time DESC LIMIT ?',
                (user_id, limit)
            ).fetchall()
            return [cls(r['id'], r['user_id'], 
                       datetime.fromisoformat(r['start_time']),
                       datetime.fromisoformat(r['end_time']) if r['end_time'] else None,
                       r['notes'], r['created_at']) for r in rows]

class VaccineRecord:
    def __init__(self, id, user_id, vaccine_name, date_given, notes=None, created_at=None):
        self.id = id
        self.user_id = user_id
        self.vaccine_name = vaccine_name
        self.date_given = date_given
        self.notes = notes
        self.created_at = created_at
    
    @classmethod
    def create(cls, user_id, vaccine_name, date_given, notes=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO vaccine_records (user_id, vaccine_name, date_given, notes) VALUES (?, ?, ?, ?)',
                (user_id, vaccine_name, date_given, notes)
            )
            record_id = cursor.lastrowid
            return cls(record_id, user_id, vaccine_name, date_given, notes)
    
    @classmethod
    def get_by_user(cls, user_id):
        with get_db() as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                'SELECT * FROM vaccine_records WHERE user_id = ? ORDER BY date_given DESC',
                (user_id,)
            ).fetchall()
            return [cls(r['id'], r['user_id'], r['vaccine_name'],
                       datetime.fromisoformat(r['date_given']), r['notes'], r['created_at']) for r in rows]