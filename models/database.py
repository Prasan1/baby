from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

def init_db(app):
    """Initialize the database with the Flask app"""
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///baby_tracker.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    with app.app_context():
        db.create_all()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email_verified = db.Column(db.Boolean, default=False)
    baby_name = db.Column(db.String(100))
    due_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    feeding_records = db.relationship('FeedingRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    sleep_records = db.relationship('SleepRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    vaccine_records = db.relationship('VaccineRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.email}>'

class Baby(db.Model):
    __tablename__ = 'babies'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    birth_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Baby {self.name}>'

class FeedingRecord(db.Model):
    __tablename__ = 'feeding_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    feeding_type = db.Column(db.String(50), nullable=False)  # 'bottle', 'breast', 'solid'
    amount = db.Column(db.Float)  # in ml or oz
    duration = db.Column(db.Integer)  # in minutes
    notes = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<FeedingRecord {self.feeding_type} at {self.timestamp}>'
    
    @classmethod
    def get_by_user(cls, user_id, limit=50):
        return cls.query.filter_by(user_id=user_id).order_by(cls.timestamp.desc()).limit(limit).all()
    
    @classmethod
    def create(cls, user_id, feeding_type, amount=None, duration=None, notes=None, timestamp=None):
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        feeding = cls(
            user_id=user_id,
            feeding_type=feeding_type,
            amount=amount,
            duration=duration,
            notes=notes,
            timestamp=timestamp
        )
        db.session.add(feeding)
        db.session.commit()
        return feeding
    
    @classmethod
    def delete(cls, feeding):
        db.session.delete(feeding)
        db.session.commit()

class SleepRecord(db.Model):
    __tablename__ = 'sleep_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SleepRecord from {self.start_time} to {self.end_time}>'
    
    @property
    def duration(self):
        if self.end_time:
            return self.end_time - self.start_time
        return None
    
    @classmethod
    def get_by_user(cls, user_id, limit=50):
        return cls.query.filter_by(user_id=user_id).order_by(cls.start_time.desc()).limit(limit).all()
    
    @classmethod
    def create(cls, user_id, start_time, end_time=None, notes=None):
        sleep = cls(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            notes=notes
        )
        db.session.add(sleep)
        db.session.commit()
        return sleep

class VaccineRecord(db.Model):
    __tablename__ = 'vaccine_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    vaccine_name = db.Column(db.String(100), nullable=False)
    date_given = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<VaccineRecord {self.vaccine_name} on {self.date_given}>'
    
    @classmethod
    def get_by_user(cls, user_id):
        return cls.query.filter_by(user_id=user_id).order_by(cls.date_given.desc()).all()
    
    @classmethod
    def create(cls, user_id, vaccine_name, date_given, notes=None):
        vaccine = cls(
            user_id=user_id,
            vaccine_name=vaccine_name,
            date_given=date_given,
            notes=notes
        )
        db.session.add(vaccine)
        db.session.commit()
        return vaccine