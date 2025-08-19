from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from datetime import datetime, timedelta
import json
import os
import secrets
from models.database import init_db, db, User, Baby, FeedingRecord, SleepRecord, VaccineRecord

app = Flask(__name__)

# Email configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME')  # This fixes the sender error

# Secret key for token generation
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(16)

# Initialize Flask-Mail
mail = Mail(app)

# Token serializer for email verification and password reset
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# Initialize database
init_db(app)

@app.route('/health_check')
def health_check():
    return 'OK', 200

@app.route('/')
def index():
    current_date = datetime.now().strftime('%B %d, %Y')
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', current_date=current_date)

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        # Skip email verification check if mail is not configured
        if app.config['MAIL_USERNAME'] and not user.email_verified:
            return jsonify({
                'success': False, 
                'message': 'Please verify your email address before logging in. Check your inbox for the verification link.'
            }), 403
        
        # Login successful - create session
        session['user_id'] = user.id
        session['user_name'] = user.name
        
        return jsonify({
            'success': True, 
            'message': 'Login successful!',
            'redirect': '/dashboard'
        })
        
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Login failed. Please try again.'}), 500

@app.route('/check-verification-status/<email>')
def check_verification_status(email):
    user = User.query.filter_by(email=email).first()
    if user:
        return jsonify({
            'verified': user.email_verified,
            'email': user.email
        })
    return jsonify({'verified': False}), 404

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')
        
    try:
        data = request.get_json()
        
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        baby_name = data.get('baby_name')
        due_date = data.get('due_date')
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Create new user
        password_hash = generate_password_hash(password)
        
        # Set email_verified to True if mail is not configured, False otherwise
        email_verified = not bool(app.config['MAIL_USERNAME'])
        
        new_user = User(
            name=name,
            email=email,
            password_hash=password_hash,
            email_verified=email_verified,  # Skip verification if mail not configured
            baby_name=baby_name,  # This can be None
            created_at=datetime.utcnow()
        )
        
        # Handle due_date properly
        if due_date:
            try:
                new_user.due_date = datetime.strptime(due_date, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'message': 'Invalid due date format'}), 400
        
        # Add user to database
        db.session.add(new_user)
        db.session.commit()
        
        # Create baby profile if provided
        if baby_name:
            due_date_obj = None
            if due_date:
                due_date_obj = datetime.strptime(due_date, '%Y-%m-%d').date()
            
            baby = Baby(
                name=baby_name,
                due_date=due_date_obj,
                user_id=new_user.id
            )
            db.session.add(baby)
            db.session.commit()
        
        # Send verification email only if mail is configured
        if app.config['MAIL_USERNAME']:
            try:
                send_verification_email(new_user.email, new_user.name)
                message = 'Account created successfully! Please check your email to verify your account.'
            except Exception as e:
                app.logger.error(f"Failed to send verification email: {e}")
                message = 'Account created successfully! However, we could not send the verification email. You can still log in.'
        else:
            message = 'Account created successfully! You can now log in.'
        
        return jsonify({
            'success': True, 
            'message': message
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Registration failed. Please try again.'}), 500

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        user = User.query.filter_by(email=email).first()
        if not user:
            # Don't reveal if email exists or not for security
            return jsonify({
                'success': True, 
                'message': 'If an account with this email exists, you will receive a password reset link.'
            })
        
        # Send password reset email only if mail is configured
        if app.config['MAIL_USERNAME']:
            send_password_reset_email(user.email, user.name)
        
        return jsonify({
            'success': True, 
            'message': 'Password reset instructions have been sent to your email.'
        })
        
    except Exception as e:
        app.logger.error(f"Forgot password error: {e}")
        return jsonify({'success': False, 'message': 'Failed to send reset email. Please try again.'}), 500

@app.route('/verify-email/<token>')
def verify_email(token):
    try:
        email = serializer.loads(token, salt='email-verification', max_age=86400)  # 24 hours
        
        user = User.query.filter_by(email=email).first()
        if user:
            user.email_verified = True
            db.session.commit()
            flash('Your email has been verified successfully!', 'success')
        else:
            flash('Invalid verification link.', 'error')
            
    except SignatureExpired:
        flash('The verification link has expired. Please request a new one.', 'error')
    except BadSignature:
        flash('Invalid verification link.', 'error')
    
    return redirect(url_for('login'))

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    try:
        email = serializer.loads(token, salt='password-reset', max_age=3600)  # 1 hour
    except SignatureExpired:
        flash('The password reset link has expired.', 'error')
        return redirect(url_for('login'))
    except BadSignature:
        flash('Invalid password reset link.', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        data = request.get_json()
        new_password = data.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user:
            user.password_hash = generate_password_hash(new_password)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Password updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'User not found.'}), 404
    
    return render_template('reset_password.html', token=token)

@app.route('/resend-verification', methods=['POST'])
def resend_verification():
    try:
        data = request.get_json()
        email = data.get('email')
        
        user = User.query.filter_by(email=email).first()
        if user and not user.email_verified and app.config['MAIL_USERNAME']:
            send_verification_email(user.email, user.name)
            return jsonify({
                'success': True, 
                'message': 'Verification email sent successfully!'
            })
        else:
            return jsonify({
                'success': False, 
                'message': 'Email not found or already verified.'
            }), 400
            
    except Exception as e:
        app.logger.error(f"Resend verification error: {e}")
        return jsonify({'success': False, 'message': 'Failed to send verification email.'}), 500

def send_verification_email(email, name):
    """Send email verification link to user"""
    if not app.config['MAIL_USERNAME']:
        return  # Skip if mail not configured
        
    try:
        token = serializer.dumps(email, salt='email-verification')
        verification_url = url_for('verify_email', token=token, _external=True)
        
        # Simple text email if template doesn't exist
        html_content = f"""
        <h2>Welcome to Baby Tracker, {name}!</h2>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="{verification_url}">Verify Email Address</a></p>
        <p>This link will expire in 24 hours.</p>
        """
        
        msg = Message(
            subject='Welcome to Baby Tracker - Verify Your Email',
            recipients=[email],
            html=html_content,
            sender=app.config['MAIL_DEFAULT_SENDER']
        )
        mail.send(msg)
    except Exception as e:
        app.logger.error(f"Failed to send verification email: {e}")
        raise

def send_password_reset_email(email, name):
    """Send password reset link to user"""
    if not app.config['MAIL_USERNAME']:
        return  # Skip if mail not configured
        
    try:
        token = serializer.dumps(email, salt='password-reset')
        reset_url = url_for('reset_password', token=token, _external=True)
        
        # Simple text email if template doesn't exist
        html_content = f"""
        <h2>Password Reset Request</h2>
        <p>Hi {name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="{reset_url}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        """
        
        msg = Message(
            subject='Baby Tracker - Password Reset Request',
            recipients=[email],
            html=html_content,
            sender=app.config['MAIL_DEFAULT_SENDER']
        )
        mail.send(msg)
    except Exception as e:
        app.logger.error(f"Failed to send password reset email: {e}")
        raise

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
@app.route('/api/feeding', methods=['GET', 'POST', 'DELETE'])
def feeding_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        try:
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
        except Exception as e:
            app.logger.error(f"Error creating feeding record: {e}")
            return jsonify({'error': 'Failed to create feeding record'}), 500
    
    elif request.method == 'DELETE':
        try:
            data = request.get_json()
            feeding_id = data.get('id')

            if not feeding_id:
                return jsonify({'error': 'Feeding ID is required'}), 400
            
            feeding = FeedingRecord.query.filter_by(id=feeding_id, user_id=user_id).first()

            if feeding is None:
                return jsonify({'error': 'Feeding record not found'}), 404

            db.session.delete(feeding)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Feeding record deleted successfully'})
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting feeding record: {e}")
            return jsonify({'error': 'Failed to delete feeding record'}), 500
    
    # GET request
    try:
        feedings = FeedingRecord.get_by_user(user_id)
        return jsonify([{
            'id': f.id,
            'type': f.feeding_type,
            'amount': f.amount,
            'duration': f.duration,
            'notes': f.notes,
            'timestamp': f.timestamp.isoformat()
        } for f in feedings])
    except Exception as e:
        app.logger.error(f"Error fetching feeding records: {e}")
        return jsonify({'error': 'Failed to fetch feeding records'}), 500

@app.route('/api/sleep', methods=['GET', 'POST', 'DELETE'])
def sleep_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        try:
            data = request.get_json()
            sleep = SleepRecord.create(
                user_id=user_id,
                start_time=datetime.fromisoformat(data.get('start_time')),
                end_time=datetime.fromisoformat(data.get('end_time')) if data.get('end_time') else None,
                notes=data.get('notes', '')
            )
            return jsonify({'success': True, 'id': sleep.id})
        except Exception as e:
            app.logger.error(f"Error creating sleep record: {e}")
            return jsonify({'error': 'Failed to create sleep record'}), 500
    
    elif request.method == 'DELETE':
        try:
            data = request.get_json()
            sleep_id = data.get('id')

            if not sleep_id:
                return jsonify({'error': 'Sleep ID is required'}), 400
            
            sleep = SleepRecord.query.filter_by(id=sleep_id, user_id=user_id).first()
            if sleep is None:
                return jsonify({'error': 'Sleep record not found'}), 404

            db.session.delete(sleep)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Sleep record deleted successfully'})
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting sleep record: {e}")
            return jsonify({'error': 'Failed to delete sleep record'}), 500
    
    # GET request
    try:
        sleeps = SleepRecord.get_by_user(user_id)
        return jsonify([{
            'id': s.id,
            'start_time': s.start_time.isoformat(),
            'end_time': s.end_time.isoformat() if s.end_time else None,
            'duration': str(s.end_time - s.start_time) if s.end_time else None,
            'notes': s.notes
        } for s in sleeps])
    except Exception as e:
        app.logger.error(f"Error fetching sleep records: {e}")
        return jsonify({'error': 'Failed to fetch sleep records'}), 500

@app.route('/api/vaccines', methods=['GET', 'POST', 'DELETE'])
def vaccines_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    if request.method == 'POST':
        try:
            data = request.get_json()
            vaccine = VaccineRecord.create(
                user_id=user_id,
                vaccine_name=data.get('vaccine_name'),
                date_given=datetime.fromisoformat(data.get('date_given')),
                notes=data.get('notes', '')
            )
            return jsonify({'success': True, 'id': vaccine.id})
        except Exception as e:
            app.logger.error(f"Error creating vaccine record: {e}")
            return jsonify({'error': 'Failed to create vaccine record'}), 500
    
    elif request.method == 'DELETE':
        try:
            data = request.get_json()
            vaccine_id = data.get('id')

            if not vaccine_id:
                return jsonify({'error': 'Vaccine ID is required'}), 400
            
            vaccine = VaccineRecord.query.filter_by(id=vaccine_id, user_id=user_id).first()
            if vaccine is None:
                return jsonify({'error': 'Vaccine record not found'}), 404

            db.session.delete(vaccine)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Vaccine record deleted successfully'})
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting vaccine record: {e}")
            return jsonify({'error': 'Failed to delete vaccine record'}), 500
    
    # GET request
    try:
        vaccines = VaccineRecord.get_by_user(user_id)
        return jsonify([{
            'id': v.id,
            'vaccine_name': v.vaccine_name,
            'date_given': v.date_given.isoformat(),
            'notes': v.notes
        } for v in vaccines])
    except Exception as e:
        app.logger.error(f"Error fetching vaccine records: {e}")
        return jsonify({'error': 'Failed to fetch vaccine records'}), 500

# Add these new routes to your app.py after the existing API routes

@app.route('/api/feeding/<int:feeding_id>', methods=['DELETE'])
def delete_feeding(feeding_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    try:
        feeding = FeedingRecord.query.filter_by(id=feeding_id, user_id=user_id).first()
        if feeding is None:
            return jsonify({'error': 'Feeding record not found'}), 404
        
        db.session.delete(feeding)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Feeding record deleted successfully'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting feeding record: {e}")
        return jsonify({'error': 'Failed to delete feeding record'}), 500

@app.route('/api/sleep/<int:sleep_id>', methods=['DELETE'])
def delete_sleep(sleep_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    try:
        sleep = SleepRecord.query.filter_by(id=sleep_id, user_id=user_id).first()
        
        if sleep is None:
            return jsonify({'error': 'Sleep record not found'}), 404
        
        db.session.delete(sleep)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Sleep record deleted successfully'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting sleep record: {e}")
        return jsonify({'error': 'Failed to delete sleep record'}), 500

@app.route('/api/sleep/<int:sleep_id>', methods=['PUT'])
def update_sleep(sleep_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session['user_id']
    
    try:
        data = request.get_json()
        sleep = SleepRecord.query.filter_by(id=sleep_id, user_id=user_id).first()
        
        if sleep is None:
            return jsonify({'error': 'Sleep record not found'}), 404
        
        # Update end_time if provided
        if 'end_time' in data:
            sleep.end_time = datetime.fromisoformat(data['end_time'])
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Sleep record updated successfully'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating sleep record: {e}")
        return jsonify({'error': 'Failed to update sleep record'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)