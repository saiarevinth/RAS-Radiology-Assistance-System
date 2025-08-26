from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(200), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'doctor' or 'receptionist'
    specialty = db.Column(db.String(100), nullable=True)  # For doctors
    department = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'specialty': self.specialty,
            'department': self.department,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(50), unique=True, nullable=False)  # Custom patient ID
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    gender = db.Column(db.String(10), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    
    # Medical Information
    blood_group = db.Column(db.String(10), nullable=True)
    known_allergies = db.Column(db.Text, nullable=True)
    medical_history = db.Column(db.Text, nullable=True)
    current_medications = db.Column(db.Text, nullable=True)
    family_history = db.Column(db.Text, nullable=True)
    
    # Registration Details
    registered_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    registered_by_user = db.relationship('User', backref='registered_patients')
    medical_reports = db.relationship('MedicalReport', backref='patient', lazy=True)
    intake_records = db.relationship('PatientIntake', backref='patient', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}",
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'gender': self.gender,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'blood_group': self.blood_group,
            'known_allergies': self.known_allergies,
            'medical_history': self.medical_history,
            'current_medications': self.current_medications,
            'family_history': self.family_history,
            'registered_by': self.registered_by,
            'registration_date': self.registration_date.isoformat() if self.registration_date else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class PatientIntake(db.Model):
    __tablename__ = 'patient_intakes'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    
    # Basic Information
    age = db.Column(db.String(10), nullable=True)
    sex = db.Column(db.String(10), nullable=True)
    dob = db.Column(db.Date, nullable=True)
    contact_number = db.Column(db.String(20), nullable=True)
    abha_id = db.Column(db.String(100), nullable=True)
    
    # Medical Information
    previous_condition = db.Column(db.Text, nullable=True)
    current_medication = db.Column(db.Text, nullable=True)
    family_history = db.Column(db.Text, nullable=True)
    known_allergy = db.Column(db.Text, nullable=True)
    chief_complaint = db.Column(db.Text, nullable=True)
    referring_doctor = db.Column(db.String(200), nullable=True)
    neurological_symptom = db.Column(db.Text, nullable=True)
    treatment_history = db.Column(db.Text, nullable=True)
    symptom_progression = db.Column(db.Text, nullable=True)
    report_content = db.Column(db.Text, nullable=True)
    
    # File Information
    previous_report_pdf = db.Column(db.String(500), nullable=True)  # Path to uploaded PDF
    extracted_data = db.Column(db.JSON, nullable=True)  # Store extracted PDF data
    
    # Assignment
    assigned_doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # High Priority Flag
    high_priority = db.Column(db.Boolean, nullable=True)
    # Session Information
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by_user = db.relationship('User', backref='created_intakes', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'age': self.age,
            'assigned_doctor_id': self.assigned_doctor_id,
            'sex': self.sex,
            'dob': self.dob.isoformat() if self.dob else None,
            'contact_number': self.contact_number,
            'abha_id': self.abha_id,
            'previous_condition': self.previous_condition,
            'current_medication': self.current_medication,
            'family_history': self.family_history,
            'known_allergy': self.known_allergy,
            'chief_complaint': self.chief_complaint,
            'referring_doctor': self.referring_doctor,
            'neurological_symptom': self.neurological_symptom,
            'treatment_history': self.treatment_history,
            'symptom_progression': self.symptom_progression,
            'report_content': self.report_content,
            'previous_report_pdf': self.previous_report_pdf,
            'extracted_data': self.extracted_data,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'high_priority': self.high_priority
        }

class MedicalReport(db.Model):
    __tablename__ = 'medical_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.String(50), unique=True, nullable=False)  # Custom report ID
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    
    # Report Details
    report_type = db.Column(db.String(100), nullable=False)  # e.g., 'X-Ray', 'MRI', 'CT Scan'
    report_date = db.Column(db.DateTime, default=datetime.utcnow)
    referring_physician = db.Column(db.String(200), nullable=True)
    chief_complaint = db.Column(db.Text, nullable=True)
    
    # AI Analysis Results
    ai_generated_report = db.Column(db.Text, nullable=True)
    affected_percentage = db.Column(db.Float, nullable=True)
    segmentation_image_path = db.Column(db.String(500), nullable=True)
    
    # Doctor's Review
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    doctor_review = db.Column(db.Text, nullable=True)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)
    
    # File Information
    original_pdf_path = db.Column(db.String(500), nullable=True)
    extracted_data = db.Column(db.JSON, nullable=True)  # Store extracted PDF data
    
    # Status
    status = db.Column(db.String(20), default='pending')  # 'pending', 'ai_processed', 'doctor_reviewed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    doctor = db.relationship('User', backref='reviewed_reports')
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'patient_id': self.patient_id,
            'report_type': self.report_type,
            'report_date': self.report_date.isoformat() if self.report_date else None,
            'referring_physician': self.referring_physician,
            'chief_complaint': self.chief_complaint,
            'ai_generated_report': self.ai_generated_report,
            'affected_percentage': self.affected_percentage,
            'segmentation_image_path': self.segmentation_image_path,
            'doctor_id': self.doctor_id,
            'doctor_review': self.doctor_review,
            'is_edited': self.is_edited,
            'edited_at': self.edited_at.isoformat() if self.edited_at else None,
            'original_pdf_path': self.original_pdf_path,
            'extracted_data': self.extracted_data,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class PatientSession(db.Model):
    __tablename__ = 'patient_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    session_date = db.Column(db.DateTime, default=datetime.utcnow)
    session_type = db.Column(db.String(100), nullable=False)  # 'intake', 'consultation', 'follow_up'
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    patient = db.relationship('Patient', backref='sessions')
    created_by_user = db.relationship('User', backref='created_sessions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'session_date': self.session_date.isoformat() if self.session_date else None,
            'session_type': self.session_type,
            'notes': self.notes,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
