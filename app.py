from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import json
import os
from models.database import init_db, User, FeedingRecord, SleepRecord, VaccineRecord

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'

# Initialize database
init_db()

@app.route('/')
def index():
    current_date = datetime.now().strftime('%B %d, %Y')
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html',  current_date=current_date)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        user = User.get_by_email(email)
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['user_name'] = user.name
            return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Invalid credentials'})
    
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    baby_name = data.get('baby_name', '')
    due_date = data.get('due_date', '')
    
    if User.get_by_email(email):
        return jsonify({'success': False, 'message': 'Email already exists'})
    
    password_hash = generate_password_hash(password)
    user = User.create(name, email, password_hash, baby_name, due_date)
    
    if user:
        session['user_id'] = user.id
        session['user_name'] = user.name
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'message': 'Registration failed'})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/essentials')
def essentials():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('essentials.html')

@app.route('/care-guide')
def care_guide():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('care_guide.html')

@app.route('/tracking')
def tracking():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('tracking.html')

@app.route('/vaccines')
def vaccines():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('vaccines.html')

# API Routes for tracking
@app.route('/api/feeding', methods=['GET', 'POST'])
def feeding_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.get_json()
        feeding = FeedingRecord.create(
            user_id=user_id,
            feeding_type=data.get('type'),
            amount=data.get('amount'),
            duration=data.get('duration'),
            notes=data.get('notes', ''),
            timestamp=datetime.fromisoformat(data.get('timestamp'))
        )
        return jsonify({'success': True, 'id': feeding.id})
    
    # DELETE method to remove a feeding record
    elif request.method == 'DELETE':
        data = request.get_json()
        print(data)
        feeding_id = data.get('id')

        if not feeding_id:
            return jsonify({'error': 'Feeding ID is required'}), 400
        
        # Find the feeding record by ID
        feeding = FeedingRecord.query.filter_by(id=feeding_id, user_id=user_id).first()

        if feeding is None:
            return jsonify({'error': 'Feeding record not found'}), 404

        # Delete the feeding record
        FeedingRecord.delete(feeding)
        
        return jsonify({'success': True, 'message': 'Feeding record deleted successfully'})
    
    # GET request
    feedings = FeedingRecord.get_by_user(user_id)
    return jsonify([{
        'id': f.id,
        'type': f.feeding_type,
        'amount': f.amount,
        'duration': f.duration,
        'notes': f.notes,
        'timestamp': f.timestamp.isoformat()
    } for f in feedings])

@app.route('/api/sleep', methods=['GET', 'POST'])
def sleep_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.get_json()
        sleep = SleepRecord.create(
            user_id=user_id,
            start_time=datetime.fromisoformat(data.get('start_time')),
            end_time=datetime.fromisoformat(data.get('end_time')) if data.get('end_time') else None,
            notes=data.get('notes', '')
        )
        return jsonify({'success': True, 'id': sleep.id})
    
    # GET request
    sleeps = SleepRecord.get_by_user(user_id)
    return jsonify([{
        'id': s.id,
        'start_time': s.start_time.isoformat(),
        'end_time': s.end_time.isoformat() if s.end_time else None,
        'duration': str(s.end_time - s.start_time) if s.end_time else None,
        'notes': s.notes
    } for s in sleeps])

@app.route('/api/vaccines', methods=['GET', 'POST'])
def vaccines_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.get_json()
        vaccine = VaccineRecord.create(
            user_id=user_id,
            vaccine_name=data.get('vaccine_name'),
            date_given=datetime.fromisoformat(data.get('date_given')),
            notes=data.get('notes', '')
        )
        return jsonify({'success': True, 'id': vaccine.id})
    
    # GET request
    vaccines = VaccineRecord.get_by_user(user_id)
    return jsonify([{
        'id': v.id,
        'vaccine_name': v.vaccine_name,
        'date_given': v.date_given.isoformat(),
        'notes': v.notes
    } for v in vaccines])

if __name__ == '__main__':
    app.run(debug=True)