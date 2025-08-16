#!/usr/bin/env python3
"""
Database initialization script for RAS (Radiologist Assistance System)
This script creates all necessary tables and adds sample data.
"""

import os
import sys
from datetime import datetime, date

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User, Patient, PatientIntake, MedicalReport, PatientSession
from werkzeug.security import generate_password_hash

def init_database():
    """Initialize the database with tables and sample data"""
    with app.app_context():
        print("Creating database tables...")
        db.create_all()
        print("✓ Database tables created successfully")
        
        # Check if we already have users
        if User.query.count() > 0:
            print("✓ Database already has data, skipping sample data creation")
            return
        
        print("Creating sample users...")
        
        # Create sample receptionist
        receptionist = User(
            email="receptionist@ras.com",
            full_name="Sarah Johnson",
            password_hash=generate_password_hash("password123"),
            role="receptionist",
            department="Reception",
            is_active=True
        )
        db.session.add(receptionist)
        
        # Create sample doctor
        doctor = User(
            email="doctor@ras.com",
            full_name="Dr. Michael Chen",
            password_hash=generate_password_hash("password123"),
            role="doctor",
            specialty="Radiology",
            department="Radiology",
            is_active=True
        )
        db.session.add(doctor)
        
        db.session.commit()
        print("✓ Sample users created successfully")
        
        # Create sample patient
        print("Creating sample patient...")
        patient = Patient(
            patient_id="PAT-20241201-SAMPLE01",
            first_name="John",
            last_name="Doe",
            date_of_birth=date(1985, 6, 15),
            gender="Male",
            phone="+1-555-0123",
            email="john.doe@email.com",
            address="123 Main St, Anytown, USA",
            blood_group="O+",
            known_allergies="Penicillin",
            medical_history="Hypertension, Diabetes Type 2",
            current_medications="Metformin 500mg twice daily, Lisinopril 10mg daily",
            family_history="Father had heart disease, Mother has diabetes",
            registered_by=receptionist.id
        )
        db.session.add(patient)
        db.session.flush()  # Get the patient ID
        
        # Create sample intake record
        intake = PatientIntake(
            patient_id=patient.id,
            age="38",
            sex="Male",
            dob=date(1985, 6, 15),
            contact_number="+1-555-0123",
            abha_id="ABHA123456789",
            previous_condition="Hypertension, Diabetes Type 2, Previous appendectomy (2010)",
            current_medication="Metformin 500mg twice daily, Lisinopril 10mg daily, Aspirin 81mg daily",
            family_history="Father had heart disease and passed away at 65, Mother has diabetes and is 70 years old, Sister has hypertension",
            known_allergy="Penicillin (severe reaction), Sulfa drugs (mild rash)",
            chief_complaint="Severe headache for the past 3 days, accompanied by nausea and sensitivity to light. Pain is worse in the morning and improves slightly throughout the day.",
            referring_doctor="Dr. Emily Rodriguez",
            neurological_symptom="Severe headache, nausea, photophobia, mild dizziness",
            treatment_history="Tried over-the-counter pain relievers (Tylenol, Advil) with minimal relief. No previous similar episodes.",
            symptom_progression="Headache started 3 days ago, initially mild but has become progressively worse. Associated symptoms (nausea, photophobia) developed on day 2.",
            report_content="Patient presents with severe headache of 3 days duration. Symptoms suggest possible migraine or tension headache. Neurological examination needed to rule out serious conditions.",
            created_by=receptionist.id
        )
        db.session.add(intake)
        
        # Create sample medical report
        report = MedicalReport(
            report_id="RPT-20241201-SAMPLE01",
            patient_id=patient.id,
            report_type="CT Scan - Head",
            referring_physician="Dr. Emily Rodriguez",
            chief_complaint="Severe headache, nausea, photophobia",
            status="pending",
            created_at=datetime.utcnow()
        )
        db.session.add(report)
        
        db.session.commit()
        print("✓ Sample patient and intake data created successfully")
        
        print("\n🎉 Database initialization completed successfully!")
        print("\nSample login credentials:")
        print("Receptionist: receptionist@ras.com / password123")
        print("Doctor: doctor@ras.com / password123")
        print("\nSample Patient ID: PAT-20241201-SAMPLE01")

if __name__ == "__main__":
    try:
        init_database()
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)
