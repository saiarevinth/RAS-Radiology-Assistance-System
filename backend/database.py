from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from models import db, User, Patient, MedicalReport, PatientSession, PatientIntake
from auth import require_auth
import json

database_bp = Blueprint('database', __name__, url_prefix='/api')

def generate_patient_id():
    """Generate a unique patient ID"""
    return f"PAT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

def generate_report_id():
    """Generate a unique report ID"""
    return f"RPT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

def allowed_file(filename):
    """Check if file extension is allowed"""
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Patient Intake Routes
@database_bp.route('/intake', methods=['POST'])
def create_patient_intake():
    """Create a new patient intake record (Receptionist only)"""
    user = require_auth(request)
    if not user or user.role != 'receptionist':
        return jsonify({"error": "Unauthorized - Receptionist access required"}), 401
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['patientName', 'age', 'contactNumber']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Validate and parse date of birth
        date_of_birth = None
        if data.get('dob'):
            try:
                date_of_birth = datetime.strptime(data['dob'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": f"Invalid date format: {data['dob']}. Please use YYYY-MM-DD format."}), 400
        
        # Create new patient first
        patient = Patient(
            patient_id=generate_patient_id(),
            first_name=data['patientName'].split(' ')[0] if ' ' in data['patientName'] else data['patientName'],
            last_name=data['patientName'].split(' ')[1] if ' ' in data['patientName'] else '',
            date_of_birth=date_of_birth or datetime.now().date(),
            gender=data.get('sex', 'Unknown'),
            phone=data.get('contactNumber'),
            email=data.get('email'),
            address=data.get('address'),
            known_allergies=data.get('knownAllergy'),
            medical_history=data.get('previousCondition'),
            current_medications=data.get('currentMedication'),
            family_history=data.get('familyHistory'),
            registered_by=user.id
        )
        
        db.session.add(patient)
        db.session.flush()  # Get the patient ID without committing
        
        # Create intake record
        intake = PatientIntake(
            patient_id=patient.id,
            age=data.get('age'),
            sex=data.get('sex'),
            dob=date_of_birth,  # Use the validated date
            contact_number=data.get('contactNumber'),
            abha_id=data.get('abhaId'),
            previous_condition=data.get('previousCondition'),
            current_medication=data.get('currentMedication'),
            family_history=data.get('familyHistory'),
            known_allergy=data.get('knownAllergy'),
            chief_complaint=data.get('chiefComplaint'),
            referring_doctor=data.get('referringDoctor'),
            neurological_symptom=data.get('neurologicalSymptom'),
            treatment_history=data.get('treatmentHistory'),
            symptom_progression=data.get('symptomProgression'),
            report_content=data.get('reportContent'),
            previous_report_pdf=data.get('previousReportPdf'),
            extracted_data=data.get('extractedData'),
            created_by=user.id,
            assigned_doctor_id=data.get('assignedDoctorId'),
            high_priority=data.get('highPriority', False)
        )
        
        db.session.add(intake)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Patient intake created successfully",
            "patient": patient.to_dict(),
            "intake": intake.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create patient intake: {str(e)}"}), 500

@database_bp.route('/intake/<int:patient_id>', methods=['GET'])
def get_patient_intake(patient_id):
    """Get patient intake record by patient ID"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Get patient
        patient = Patient.query.get_or_404(patient_id)
        
        # Get latest intake record
        intake = PatientIntake.query.filter_by(patient_id=patient_id).order_by(PatientIntake.created_at.desc()).first()
        
        # Get all medical reports
        reports = MedicalReport.query.filter_by(patient_id=patient_id).order_by(MedicalReport.created_at.desc()).all()
        
        patient_data = patient.to_dict()
        patient_data['intake'] = intake.to_dict() if intake else None
        patient_data['medical_reports'] = [report.to_dict() for report in reports]
        
        return jsonify({
            "success": True,
            "patient": patient_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch patient intake: {str(e)}"}), 500

@database_bp.route('/patients/search-by-id', methods=['GET'])
def search_patient_by_custom_id():
    """Search patient by custom patient ID (for doctors)"""
    user = require_auth(request)
    if not user or user.role != 'doctor':
        return jsonify({"error": "Unauthorized - Doctor access required"}), 401
    
    patient_id = request.args.get('patient_id')
    if not patient_id:
        return jsonify({"error": "Patient ID is required"}), 400
    
    try:
        patient = Patient.query.filter_by(patient_id=patient_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404
        
        # Get latest intake record
        intake = PatientIntake.query.filter_by(patient_id=patient.id).order_by(PatientIntake.created_at.desc()).first()
        
        # Get all medical reports
        reports = MedicalReport.query.filter_by(patient_id=patient.id).order_by(MedicalReport.created_at.desc()).all()
        
        patient_data = patient.to_dict()
        patient_data['intake'] = intake.to_dict() if intake else None
        patient_data['medical_reports'] = [report.to_dict() for report in reports]
        
        return jsonify({
            "success": True,
            "patient": patient_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to search patient: {str(e)}"}), 500

# Patient Management Routes
@database_bp.route('/patients', methods=['POST'])
def create_patient():
    """Create a new patient (Receptionist only)"""
    user = require_auth(request)
    if not user or user.role != 'receptionist':
        return jsonify({"error": "Unauthorized - Receptionist access required"}), 401
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'date_of_birth', 'gender']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Create new patient
        patient = Patient(
            patient_id=generate_patient_id(),
            first_name=data['first_name'],
            last_name=data['last_name'],
            date_of_birth=datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date(),
            gender=data['gender'],
            phone=data.get('phone'),
            email=data.get('email'),
            address=data.get('address'),
            blood_group=data.get('blood_group'),
            known_allergies=data.get('known_allergies'),
            medical_history=data.get('medical_history'),
            current_medications=data.get('current_medications'),
            family_history=data.get('family_history'),
            registered_by=user.id
        )
        
        db.session.add(patient)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Patient created successfully",
            "patient": patient.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create patient: {str(e)}"}), 500

@database_bp.route('/patients', methods=['GET'])
def get_patients():
    """Get all patients (with optional search)"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = Patient.query
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Patient.patient_id.ilike(search_term),
                    Patient.first_name.ilike(search_term),
                    Patient.last_name.ilike(search_term),
                    Patient.phone.ilike(search_term)
                )
            )
        
        patients = query.order_by(Patient.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            "success": True,
            "patients": [patient.to_dict() for patient in patients.items],
            "total": patients.total,
            "pages": patients.pages,
            "current_page": page
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch patients: {str(e)}"}), 500

@database_bp.route('/patients/<int:patient_id>', methods=['GET'])
def get_patient(patient_id):
    """Get patient by ID"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        patient = Patient.query.get_or_404(patient_id)
        
        # Get patient's medical reports
        reports = MedicalReport.query.filter_by(patient_id=patient_id).order_by(MedicalReport.created_at.desc()).all()
        
        patient_data = patient.to_dict()
        patient_data['medical_reports'] = [report.to_dict() for report in reports]
        
        return jsonify({
            "success": True,
            "patient": patient_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch patient: {str(e)}"}), 500

@database_bp.route('/patients/search', methods=['GET'])
def search_patient():
    """Search patient by patient ID (for doctors)"""
    user = require_auth(request)
    if not user or user.role != 'doctor':
        return jsonify({"error": "Unauthorized - Doctor access required"}), 401
    
    patient_id = request.args.get('patient_id')
    if not patient_id:
        return jsonify({"error": "Patient ID is required"}), 400
    
    try:
        patient = Patient.query.filter_by(patient_id=patient_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404
        
        # Get patient's medical reports
        reports = MedicalReport.query.filter_by(patient_id=patient.id).order_by(MedicalReport.created_at.desc()).all()
        
        patient_data = patient.to_dict()
        patient_data['medical_reports'] = [report.to_dict() for report in reports]
        
        return jsonify({
            "success": True,
            "patient": patient_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to search patient: {str(e)}"}), 500

# Medical Report Routes
@database_bp.route('/reports', methods=['POST'])
def create_medical_report():
    """Create a new medical report (Receptionist only)"""
    user = require_auth(request)
    if not user or user.role != 'receptionist':
        return jsonify({"error": "Unauthorized - Receptionist access required"}), 401
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['patient_id', 'report_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if patient exists
        patient = Patient.query.get(data['patient_id'])
        if not patient:
            return jsonify({"error": "Patient not found"}), 404
        
        # Create new report
        report = MedicalReport(
            report_id=generate_report_id(),
            patient_id=data['patient_id'],
            report_type=data['report_type'],
            referring_physician=data.get('referring_physician'),
            chief_complaint=data.get('chief_complaint'),
            extracted_data=data.get('extracted_data'),
            status='pending'
        )
        
        db.session.add(report)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Medical report created successfully",
            "report": report.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create report: {str(e)}"}), 500

@database_bp.route('/reports/<int:report_id>', methods=['PUT'])
def update_medical_report(report_id):
    """Update medical report (Doctor only)"""
    user = require_auth(request)
    if not user or user.role != 'doctor':
        return jsonify({"error": "Unauthorized - Doctor access required"}), 401
    
    try:
        report = MedicalReport.query.get_or_404(report_id)
        data = request.get_json()
        
        # Update report fields
        if 'doctor_review' in data:
            report.doctor_review = data['doctor_review']
            report.is_edited = True
            report.edited_at = datetime.utcnow()
            report.doctor_id = user.id
            report.status = 'doctor_reviewed'
        
        if 'ai_generated_report' in data:
            report.ai_generated_report = data['ai_generated_report']
        
        if 'affected_percentage' in data:
            report.affected_percentage = data['affected_percentage']
        
        if 'segmentation_image_path' in data:
            report.segmentation_image_path = data['segmentation_image_path']
        
        report.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Report updated successfully",
            "report": report.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update report: {str(e)}"}), 500

@database_bp.route('/reports/<int:report_id>', methods=['GET'])
def get_medical_report(report_id):
    """Get medical report by ID"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        report = MedicalReport.query.get_or_404(report_id)
        
        # Get patient information
        patient = Patient.query.get(report.patient_id)
        
        report_data = report.to_dict()
        report_data['patient'] = patient.to_dict() if patient else None
        
        return jsonify({
            "success": True,
            "report": report_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch report: {str(e)}"}), 500

@database_bp.route('/reports/patient/<int:patient_id>', methods=['GET'])
def get_patient_reports(patient_id):
    """Get all reports for a specific patient"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        reports = MedicalReport.query.filter_by(patient_id=patient_id).order_by(MedicalReport.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "reports": [report.to_dict() for report in reports]
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch reports: {str(e)}"}), 500

# File Upload Route
@database_bp.route('/upload', methods=['POST'])
def upload_file():
    """Upload file for medical report"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400
        
        # Create uploads directory if it doesn't exist
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(upload_folder, unique_filename)
        
        # Save file
        file.save(file_path)
        
        return jsonify({
            "success": True,
            "message": "File uploaded successfully",
            "filename": unique_filename,
            "file_path": file_path
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to upload file: {str(e)}"}), 500

# Dashboard Statistics
@database_bp.route('/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    user = require_auth(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        total_patients = Patient.query.count()
        total_reports = MedicalReport.query.count()
        pending_reports = MedicalReport.query.filter_by(status='pending').count()
        processed_reports = MedicalReport.query.filter_by(status='ai_processed').count()
        reviewed_reports = MedicalReport.query.filter_by(status='doctor_reviewed').count()
        
        # Get recent patients
        recent_patients = Patient.query.order_by(Patient.created_at.desc()).limit(5).all()
        
        # Get recent reports
        recent_reports = MedicalReport.query.order_by(MedicalReport.created_at.desc()).limit(5).all()
        
        return jsonify({
            "success": True,
            "stats": {
                "total_patients": total_patients,
                "total_reports": total_reports,
                "pending_reports": pending_reports,
                "processed_reports": processed_reports,
                "reviewed_reports": reviewed_reports
            },
            "recent_patients": [patient.to_dict() for patient in recent_patients],
            "recent_reports": [report.to_dict() for report in recent_reports]
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch dashboard stats: {str(e)}"}), 500
