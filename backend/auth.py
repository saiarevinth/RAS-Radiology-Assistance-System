from __future__ import annotations

import os
import hashlib
import secrets
from dataclasses import dataclass
from typing import Optional, Dict, List, Union
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, make_response, request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import check_password_hash, generate_password_hash


SESSION_COOKIE_NAME = "ras_session"
SESSION_SALT = "ras_session_salt"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 hours


def _get_serializer() -> URLSafeTimedSerializer:
    secret = current_app.config.get("SECRET_KEY") or os.environ.get("SECRET_KEY") or "dev-secret-change-me"
    return URLSafeTimedSerializer(secret_key=secret, salt=SESSION_SALT)


@dataclass
class Doctor:
    id: int
    email: str
    full_name: str
    specialty: str
    department: str
    password_hash: str
    is_active: bool = True


@dataclass
class Receptionist:
    email: str
    full_name: str
    department: str
    password_hash: str
    is_active: bool = True


# Predefined list of authorized doctors with secure password hashes
AUTHORIZED_DOCTORS = [
    Doctor(
        id=1,
        email="dr.smith@hospital.com",
        full_name="Dr. John Smith",
        specialty="Radiology",
        department="Radiology Department",
        password_hash=generate_password_hash("123")
    ),
    Doctor(
        id=2,
        email="dr.johnson@hospital.com",
        full_name="Dr. Sarah Johnson", 
        specialty="Neurology",
        department="Neurology Department",
        password_hash=generate_password_hash("Johnson2024!")
    ),
    Doctor(
        id=3,
        email="dr.williams@hospital.com",
        full_name="Dr. Michael Williams",
        specialty="Oncology", 
        department="Oncology Department",
        password_hash=generate_password_hash("Williams2024!")
    ),
    Doctor(
        id=4,
        email="dr.brown@hospital.com",
        full_name="Dr. Emily Brown",
        specialty="Cardiology",
        department="Cardiology Department", 
        password_hash=generate_password_hash("Brown2024!")
    ),
    Doctor(
        id=5,
        email="dr.davis@hospital.com",
        full_name="Dr. Robert Davis",
        specialty="Emergency Medicine",
        department="Emergency Department",
        password_hash=generate_password_hash("Davis2024!")
    ),
    Doctor(
        id=6,
        email="dr.wilson@hospital.com",
        full_name="Dr. Lisa Wilson",
        specialty="Pediatrics",
        department="Pediatrics Department",
        password_hash=generate_password_hash("Wilson2024!")
    ),
    Doctor(
        id=7,
        email="dr.martinez@hospital.com",
        full_name="Dr. Carlos Martinez",
        specialty="Orthopedics",
        department="Orthopedics Department",
        password_hash=generate_password_hash("Martinez2024!")
    )
]

# Create lookup dictionaries for efficient authentication
DOCTOR_LOOKUP: Dict[str, Doctor] = {doctor.email.lower(): doctor for doctor in AUTHORIZED_DOCTORS}
ACTIVE_DOCTORS: Dict[str, Doctor] = {email: doctor for email, doctor in DOCTOR_LOOKUP.items() if doctor.is_active}

AUTHORIZED_RECEPTIONISTS: List[Receptionist] = [
    Receptionist(
        email="reception@hospital.com",
        full_name="Alex Parker",
        department="Front Desk",
        password_hash=generate_password_hash("1234")
    )
]

RECEPTIONIST_LOOKUP: Dict[str, Receptionist] = {rec.email.lower(): rec for rec in AUTHORIZED_RECEPTIONISTS}
ACTIVE_RECEPTIONISTS: Dict[str, Receptionist] = {email: rec for email, rec in RECEPTIONIST_LOOKUP.items() if rec.is_active}


def _create_session(email: str, role: str = "doctor") -> str:
    s = _get_serializer()
    payload = {
        "sub": email,
        "role": role,
        "iat": datetime.utcnow().isoformat(),
        "exp": (datetime.utcnow() + timedelta(seconds=SESSION_MAX_AGE_SECONDS)).isoformat()
    }
    return s.dumps(payload)


def _verify_session(token: str) -> Optional[Union[Doctor, Receptionist]]:
    s = _get_serializer()
    try:
        data = s.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
        email = str(data.get("sub", "")).lower()
        role = str(data.get("role", "doctor"))
        if role == "doctor":
            if email in ACTIVE_DOCTORS:
                return ACTIVE_DOCTORS[email]
        elif role == "receptionist":
            if email in ACTIVE_RECEPTIONISTS:
                return ACTIVE_RECEPTIONISTS[email]
        return None
    except (BadSignature, SignatureExpired):
        return None


def _validate_credentials(email: str, password: str) -> Optional[Doctor]:
    """Validate doctor credentials against the authorized list"""
    email = email.strip().lower()
    
    if email not in ACTIVE_DOCTORS:
        return None
    
    doctor = ACTIVE_DOCTORS[email]
    if not doctor.is_active:
        return None
    
    if check_password_hash(doctor.password_hash, password):
        return doctor
    
    return None


def _validate_receptionist_credentials(email: str, password: str) -> Optional[Receptionist]:
    email = email.strip().lower()
    if email not in ACTIVE_RECEPTIONISTS:
        return None
    receptionist = ACTIVE_RECEPTIONISTS[email]
    if not receptionist.is_active:
        return None
    if check_password_hash(receptionist.password_hash, password):
        return receptionist
    return None


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Validate credentials
    doctor = _validate_credentials(email, password)
    if not doctor:
        # Log failed login attempt (in production, you'd want to log this)
        return jsonify({"error": "Invalid credentials"}), 401

    # Create session
    token = _create_session(doctor.email, role="doctor")
    
    resp = make_response(
        jsonify({
            "ok": True,
            "user": {
                "id": doctor.id,
                "email": doctor.email,
                "full_name": doctor.full_name,
                "specialty": doctor.specialty,
                "department": doctor.department,
                "role": "doctor"
            },
        })
    )

    # Set secure cookie
    secure_cookie = bool(os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes"))
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        secure=secure_cookie,
        samesite="Lax",
        max_age=SESSION_MAX_AGE_SECONDS,
        path="/",
    )
    return resp


@auth_bp.post("/receptionist/login")
def receptionist_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    receptionist = _validate_receptionist_credentials(email, password)
    if not receptionist:
        return jsonify({"error": "Invalid credentials"}), 401

    token = _create_session(receptionist.email, role="receptionist")

    resp = make_response(
        jsonify({
            "ok": True,
            "user": {
                "email": receptionist.email,
                "full_name": receptionist.full_name,
                "specialty": "Reception",
                "department": receptionist.department,
                "role": "receptionist"
            },
        })
    )

    secure_cookie = bool(os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes"))
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        secure=secure_cookie,
        samesite="Lax",
        max_age=SESSION_MAX_AGE_SECONDS,
        path="/",
    )
    return resp


@auth_bp.post("/logout")
def logout():
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp


@auth_bp.get("/me")
def me():
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return jsonify({"authenticated": False}), 401
    
    user_obj = _verify_session(token)
    if not user_obj:
        return jsonify({"authenticated": False}), 401

    # Determine role by checking which list contains the email
    email = getattr(user_obj, "email", "").lower()
    if email in ACTIVE_DOCTORS:
        doctor = ACTIVE_DOCTORS[email]
        user_payload = {
            "id": doctor.id,
            "email": doctor.email,
            "full_name": doctor.full_name,
            "specialty": doctor.specialty,
            "department": doctor.department,
            "role": "doctor",
        }
    else:
        receptionist = ACTIVE_RECEPTIONISTS[email]
        user_payload = {
            "email": receptionist.email,
            "full_name": receptionist.full_name,
            "specialty": "Reception",
            "department": receptionist.department,
            "role": "receptionist",
        }

    return jsonify({
        "authenticated": True,
        "user": user_payload,
    })


@auth_bp.get("/doctors")
def list_doctors():
    """List all authorized doctors (for admin purposes)"""
    doctors = []
    for doctor in AUTHORIZED_DOCTORS:
        if doctor.is_active:
            doctors.append({
                "email": doctor.email,
                "full_name": doctor.full_name,
                "specialty": doctor.specialty,
                "department": doctor.department,
                "status": "active"
            })
    return jsonify({"doctors": doctors})


@auth_bp.get("/doctors/count")
def doctor_count():
    """Get count of authorized doctors"""
    active_count = len(ACTIVE_DOCTORS)
    total_count = len(AUTHORIZED_DOCTORS)
    return jsonify({
        "active_doctors": active_count,
        "total_doctors": total_count
    })


def require_auth(request_obj) -> Optional[Union[Doctor, Receptionist]]:
    """Require authentication for protected routes"""
    token = request_obj.cookies.get(SESSION_COOKIE_NAME)
    user_obj = _verify_session(token) if token else None
    
    if user_obj:
        # Create a wrapper object with all necessary attributes for database compatibility
        class UserWrapper:
            def __init__(self, original_user, role, user_id):
                self.original_user = original_user
                self.role = role
                self.id = user_id
                # Copy all attributes from original user
                for attr in dir(original_user):
                    if not attr.startswith('_'):
                        setattr(self, attr, getattr(original_user, attr))
        
        if hasattr(user_obj, 'email'):
            email = user_obj.email.lower()
            if email in ACTIVE_DOCTORS:
                return UserWrapper(user_obj, "doctor", ACTIVE_DOCTORS[email].id)
            elif email in ACTIVE_RECEPTIONISTS:
                return UserWrapper(user_obj, "receptionist", 2)
    
    return user_obj


