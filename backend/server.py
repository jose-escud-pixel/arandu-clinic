from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import base64
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Serve uploaded photos
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
(uploads_dir / "photos").mkdir(exist_ok=True)
(uploads_dir / "logos").mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'traumacare-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "doctor"
    status: str = "pending"
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    photo_url: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class DoctorLogin(BaseModel):
    email: EmailStr
    password: str

class DoctorProfileUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class AdminChangePassword(BaseModel):
    new_password: str

class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    name: str
    age: int
    cedula: str
    nationality: Optional[str] = None
    address: str
    occupation: str
    phone: str
    insurance_name: Optional[str] = None
    insurance_number: Optional[str] = None
    medical_history: str
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PatientCreate(BaseModel):
    name: str
    age: int
    cedula: str
    nationality: Optional[str] = None
    address: str
    occupation: str
    phone: str
    insurance_name: Optional[str] = None
    insurance_number: Optional[str] = None
    medical_history: str
    status: Optional[str] = "active"

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    cedula: Optional[str] = None
    nationality: Optional[str] = None
    address: Optional[str] = None
    occupation: Optional[str] = None
    phone: Optional[str] = None
    insurance_name: Optional[str] = None
    insurance_number: Optional[str] = None
    medical_history: Optional[str] = None
    status: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    date: datetime
    reason: str
    status: str = "scheduled"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(BaseModel):
    patient_id: str
    date: str
    reason: str
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Consultation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    date: datetime
    diagnosis: str
    treatment: str
    notes: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConsultationCreate(BaseModel):
    patient_id: str
    diagnosis: str
    treatment: str
    notes: str

class ConsultationUpdate(BaseModel):
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None

class FileUpload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    file_name: str
    file_url: str
    file_type: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FileUploadCreate(BaseModel):
    patient_id: str
    file_name: str
    file_url: str
    file_type: str

class DashboardStats(BaseModel):
    total_patients: int
    appointments_today: int
    active_treatments: int
    pending_appointments: int


class Prescription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    date: datetime
    medications: str
    instructions: str
    diagnosis: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PrescriptionCreate(BaseModel):
    patient_id: str
    medications: str
    instructions: str
    diagnosis: str

class PrescriptionUpdate(BaseModel):
    medications: Optional[str] = None
    instructions: Optional[str] = None
    diagnosis: Optional[str] = None

class AdvancedStats(BaseModel):
    total_patients: int
    appointments_by_month: List[dict]
    consultations_by_month: List[dict]
    top_diagnoses: List[dict]
    patient_growth: List[dict]

# --- Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(doctor_id: str) -> str:
    payload = {
        'doctor_id': doctor_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_doctor(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload['doctor_id']
    except:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

async def get_current_doctor_full(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        doctor_id = payload['doctor_id']
    except:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "password": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    return doctor

# Helper to check admin role
async def require_admin(doctor_id: str = Depends(get_current_doctor)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor or doctor.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores.")
    return doctor_id

async def log_activity(user_id: str, user_name: str, action: str, target_type: str, target_id: str, details: str):
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_entry)

async def get_doctor_name(doctor_id: str) -> str:
    doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "name": 1})
    return doc['name'] if doc else 'Desconocido'

def fix_datetime(record, fields):
    for f in fields:
        if f in record and isinstance(record[f], str):
            record[f] = datetime.fromisoformat(record[f])

# --- Auth endpoints ---
@api_router.post("/auth/register")
async def register_doctor(input: DoctorCreate):
    existing = await db.doctors.find_one({"email": input.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya esta registrado")
    
    doctor_count = await db.doctors.count_documents({})
    is_first = doctor_count == 0
    
    doctor_dict = input.model_dump()
    hashed_pw = hash_password(doctor_dict.pop('password'))
    doctor_obj = Doctor(**doctor_dict)
    doctor_obj.role = "admin" if is_first else "doctor"
    doctor_obj.status = "active" if is_first else "pending"
    
    doc = doctor_obj.model_dump()
    doc['password'] = hashed_pw
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.doctors.insert_one(doc)
    
    if is_first:
        token = create_token(doctor_obj.id)
        return {"token": token, "doctor": doctor_obj}
    else:
        return {"message": "Registro enviado. Tu cuenta necesita aprobacion del administrador.", "pending": True}

@api_router.post("/auth/login")
async def login_doctor(input: DoctorLogin):
    doctor = await db.doctors.find_one({"email": input.email}, {"_id": 0})
    if not doctor or not verify_password(input.password, doctor['password']):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    
    if doctor.get('status', 'active') == 'pending':
        raise HTTPException(status_code=403, detail="Tu cuenta esta pendiente de aprobacion por el administrador")
    
    if doctor.get('status', 'active') == 'rejected':
        raise HTTPException(status_code=403, detail="Tu cuenta ha sido rechazada. Contacta al administrador")
    
    token = create_token(doctor['id'])
    doctor.pop('password')
    if isinstance(doctor['created_at'], str):
        doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
    
    return {"token": token, "doctor": doctor}

@api_router.get("/auth/me", response_model=Doctor)
async def get_current_doctor_info(doctor_id: str = Depends(get_current_doctor)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "password": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
    if isinstance(doctor['created_at'], str):
        doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
    return doctor

# --- Profile & Password ---
@api_router.put("/auth/profile")
async def update_profile(input: DoctorProfileUpdate, doctor_id: str = Depends(get_current_doctor)):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    result = await db.doctors.update_one({"id": doctor_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return {"message": "Perfil actualizado"}

@api_router.post("/auth/upload-photo")
async def upload_profile_photo(file: UploadFile = File(...), doctor_id: str = Depends(get_current_doctor)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos de imagen")
    
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads", "photos")
    os.makedirs(upload_dir, exist_ok=True)
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{doctor_id}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    photo_url = f"/api/uploads/photos/{filename}"
    await db.doctors.update_one({"id": doctor_id}, {"$set": {"photo_url": photo_url}})
    
    return {"photo_url": photo_url}

@api_router.post("/auth/upload-logo")
async def upload_logo(file: UploadFile = File(...), doctor_id: str = Depends(get_current_doctor)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos de imagen")
    
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads", "logos")
    os.makedirs(upload_dir, exist_ok=True)
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"{doctor_id}_logo.{ext}"
    filepath = os.path.join(upload_dir, filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    logo_url = f"/api/uploads/logos/{filename}"
    await db.doctors.update_one({"id": doctor_id}, {"$set": {"logo_url": logo_url}})
    
    return {"logo_url": logo_url}

@api_router.put("/auth/change-password")
async def change_password(input: ChangePassword, doctor_id: str = Depends(get_current_doctor)):
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor or not verify_password(input.current_password, doctor['password']):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    hashed = hash_password(input.new_password)
    await db.doctors.update_one({"id": doctor_id}, {"$set": {"password": hashed}})
    return {"message": "Contraseña actualizada"}

# --- Admin endpoints ---
@api_router.get("/admin/users")
async def get_all_users(admin_id: str = Depends(require_admin)):
    users = await db.doctors.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.get("/admin/pending-users")
async def get_pending_users(admin_id: str = Depends(require_admin)):
    users = await db.doctors.find({"status": "pending"}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.put("/admin/users/{user_id}/approve")
async def approve_user(user_id: str, admin_id: str = Depends(require_admin)):
    result = await db.doctors.update_one({"id": user_id}, {"$set": {"status": "active"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    admin_name = await get_doctor_name(admin_id)
    await log_activity(admin_id, admin_name, "approve", "user", user_id, "Usuario aprobado")
    return {"message": "Usuario aprobado"}

@api_router.put("/admin/users/{user_id}/reject")
async def reject_user(user_id: str, admin_id: str = Depends(require_admin)):
    result = await db.doctors.update_one({"id": user_id}, {"$set": {"status": "rejected"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    admin_name = await get_doctor_name(admin_id)
    await log_activity(admin_id, admin_name, "reject", "user", user_id, "Usuario rechazado")
    return {"message": "Usuario rechazado"}

@api_router.put("/admin/users/{user_id}/change-password")
async def admin_change_password(user_id: str, input: AdminChangePassword, admin_id: str = Depends(require_admin)):
    hashed = hash_password(input.new_password)
    result = await db.doctors.update_one({"id": user_id}, {"$set": {"password": hashed}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Contraseña actualizada"}

@api_router.put("/admin/users/{user_id}/role")
async def change_user_role(user_id: str, role: str, admin_id: str = Depends(require_admin)):
    if role not in ['admin', 'doctor']:
        raise HTTPException(status_code=400, detail="Rol invalido")
    result = await db.doctors.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    admin_name = await get_doctor_name(admin_id)
    await log_activity(admin_id, admin_name, "update", "user", user_id, f"Rol cambiado a {role}")
    return {"message": f"Rol cambiado a {role}"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin_id: str = Depends(require_admin)):
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    target = await db.doctors.find_one({"id": user_id}, {"_id": 0, "name": 1})
    result = await db.doctors.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    admin_name = await get_doctor_name(admin_id)
    await log_activity(admin_id, admin_name, "delete", "user", user_id, f"Usuario eliminado: {target['name'] if target else 'N/A'}")
    return {"message": "Usuario eliminado"}

@api_router.get("/admin/activity-logs")
async def get_activity_logs(
    admin_id: str = Depends(require_admin),
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0)
):
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.activity_logs.count_documents({})
    return {"logs": logs, "total": total}

# --- Patients ---
@api_router.post("/patients")
async def create_patient(input: PatientCreate, doctor: dict = Depends(get_current_doctor_full)):
    patient_dict = input.model_dump()
    patient_dict['doctor_id'] = doctor['id']
    patient_obj = Patient(**patient_dict)
    
    doc = patient_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.patients.insert_one(doc)
    await log_activity(doctor['id'], doctor['name'], "create", "patient", patient_obj.id, f"Paciente creado: {input.name}")
    
    result = patient_obj.model_dump()
    return result

@api_router.get("/patients")
async def get_patients(doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {} if is_admin else {"doctor_id": doctor['id']}
    patients = await db.patients.find(query, {"_id": 0}).to_list(1000)
    
    if is_admin:
        doctor_cache = {}
        for p in patients:
            did = p.get('doctor_id', '')
            if did not in doctor_cache:
                doctor_cache[did] = await get_doctor_name(did)
            p['doctor_name'] = doctor_cache[did]
    
    for patient in patients:
        fix_datetime(patient, ['created_at', 'updated_at'])
    return patients

@api_router.get("/patients/search")
async def search_patients(q: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"cedula": {"$regex": q, "$options": "i"}}
        ]
    }
    if not is_admin:
        query["doctor_id"] = doctor['id']
    
    patients = await db.patients.find(query, {"_id": 0}).to_list(100)
    for patient in patients:
        fix_datetime(patient, ['created_at', 'updated_at'])
    return patients

@api_router.get("/patients/advanced-search")
async def advanced_search_patients(q: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    doc_filter = {} if is_admin else {"doctor_id": doctor['id']}
    
    # Search in consultations (diagnosis, treatment, notes)
    consultation_query = {
        **doc_filter,
        "$or": [
            {"diagnosis": {"$regex": q, "$options": "i"}},
            {"treatment": {"$regex": q, "$options": "i"}},
            {"notes": {"$regex": q, "$options": "i"}}
        ]
    }
    matching_consultations = await db.consultations.find(consultation_query, {"_id": 0, "patient_id": 1}).to_list(1000)
    patient_ids_from_consultations = list(set(c['patient_id'] for c in matching_consultations))
    
    # Also search in patient name, cedula, medical_history
    patient_query = {
        **doc_filter,
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"cedula": {"$regex": q, "$options": "i"}},
            {"medical_history": {"$regex": q, "$options": "i"}}
        ]
    }
    direct_patients = await db.patients.find(patient_query, {"_id": 0}).to_list(1000)
    direct_ids = set(p['id'] for p in direct_patients)
    
    # Fetch patients found via consultations that aren't already in direct results
    extra_ids = [pid for pid in patient_ids_from_consultations if pid not in direct_ids]
    extra_patients = []
    if extra_ids:
        extra_patients = await db.patients.find({"id": {"$in": extra_ids}}, {"_id": 0}).to_list(1000)
    
    all_patients = direct_patients + extra_patients
    
    if is_admin:
        doctor_cache = {}
        for p in all_patients:
            did = p.get('doctor_id', '')
            if did not in doctor_cache:
                doctor_cache[did] = await get_doctor_name(did)
            p['doctor_name'] = doctor_cache[did]
    
    for patient in all_patients:
        fix_datetime(patient, ['created_at', 'updated_at'])
    
    return all_patients

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": patient_id} if is_admin else {"id": patient_id, "doctor_id": doctor['id']}
    patient = await db.patients.find_one(query, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    fix_datetime(patient, ['created_at', 'updated_at'])
    return patient

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, input: PatientUpdate, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    query = {"id": patient_id} if is_admin else {"id": patient_id, "doctor_id": doctor['id']}
    result = await db.patients.update_one(query, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    fix_datetime(patient, ['created_at', 'updated_at'])
    await log_activity(doctor['id'], doctor['name'], "update", "patient", patient_id, f"Paciente actualizado: {patient['name']}")
    return patient

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0, "name": 1})
    query = {"id": patient_id} if is_admin else {"id": patient_id, "doctor_id": doctor['id']}
    result = await db.patients.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    await log_activity(doctor['id'], doctor['name'], "delete", "patient", patient_id, f"Paciente eliminado: {patient['name'] if patient else 'N/A'}")
    return {"message": "Paciente eliminado"}

# --- Appointments ---
@api_router.post("/appointments")
async def create_appointment(input: AppointmentCreate, doctor: dict = Depends(get_current_doctor_full)):
    appointment_dict = input.model_dump()
    appointment_dict['doctor_id'] = doctor['id']
    appointment_dict['date'] = datetime.fromisoformat(appointment_dict['date'])
    appointment_obj = Appointment(**appointment_dict)
    
    doc = appointment_obj.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.appointments.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(doctor['id'], doctor['name'], "create", "appointment", appointment_obj.id, f"Cita creada para {patient['name'] if patient else 'N/A'}")
    
    result = appointment_obj.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/appointments")
async def get_appointments(doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {} if is_admin else {"doctor_id": doctor['id']}
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    
    if is_admin:
        doctor_cache = {}
        for a in appointments:
            did = a.get('doctor_id', '')
            if did not in doctor_cache:
                doctor_cache[did] = await get_doctor_name(did)
            a['doctor_name'] = doctor_cache[did]
    
    for appointment in appointments:
        fix_datetime(appointment, ['date', 'created_at'])
    return appointments

@api_router.get("/patients/{patient_id}/appointments")
async def get_patient_appointments(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"patient_id": patient_id} if is_admin else {"patient_id": patient_id, "doctor_id": doctor['id']}
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    for appointment in appointments:
        fix_datetime(appointment, ['date', 'created_at'])
    return appointments

@api_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, input: AppointmentUpdate, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if 'date' in update_data:
        update_data['date'] = datetime.fromisoformat(update_data['date']).isoformat()
    query = {"id": appointment_id} if is_admin else {"id": appointment_id, "doctor_id": doctor['id']}
    result = await db.appointments.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    await log_activity(doctor['id'], doctor['name'], "update", "appointment", appointment_id, "Cita actualizada")
    return {"message": "Cita actualizada"}

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": appointment_id} if is_admin else {"id": appointment_id, "doctor_id": doctor['id']}
    result = await db.appointments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    await log_activity(doctor['id'], doctor['name'], "delete", "appointment", appointment_id, "Cita eliminada")
    return {"message": "Cita eliminada"}

# --- Consultations ---
@api_router.post("/consultations")
async def create_consultation(input: ConsultationCreate, doctor: dict = Depends(get_current_doctor_full)):
    consultation_dict = input.model_dump()
    consultation_dict['doctor_id'] = doctor['id']
    consultation_dict['date'] = datetime.now(timezone.utc)
    consultation_obj = Consultation(**consultation_dict)
    
    doc = consultation_obj.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.consultations.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(doctor['id'], doctor['name'], "create", "consultation", consultation_obj.id, f"Consulta creada para {patient['name'] if patient else 'N/A'}")
    
    result = consultation_obj.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/patients/{patient_id}/consultations")
async def get_patient_consultations(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"patient_id": patient_id} if is_admin else {"patient_id": patient_id, "doctor_id": doctor['id']}
    consultations = await db.consultations.find(query, {"_id": 0}).to_list(1000)
    for consultation in consultations:
        fix_datetime(consultation, ['date', 'created_at'])
    return consultations

@api_router.put("/consultations/{consultation_id}")
async def update_consultation(consultation_id: str, input: ConsultationUpdate, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    query = {"id": consultation_id} if is_admin else {"id": consultation_id, "doctor_id": doctor['id']}
    result = await db.consultations.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    await log_activity(doctor['id'], doctor['name'], "update", "consultation", consultation_id, "Consulta actualizada")
    return {"message": "Consulta actualizada"}

@api_router.delete("/consultations/{consultation_id}")
async def delete_consultation(consultation_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": consultation_id} if is_admin else {"id": consultation_id, "doctor_id": doctor['id']}
    result = await db.consultations.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    await log_activity(doctor['id'], doctor['name'], "delete", "consultation", consultation_id, "Consulta eliminada")
    return {"message": "Consulta eliminada"}

# --- Files ---
@api_router.post("/files")
async def upload_file(input: FileUploadCreate, doctor: dict = Depends(get_current_doctor_full)):
    file_dict = input.model_dump()
    file_dict['doctor_id'] = doctor['id']
    file_obj = FileUpload(**file_dict)
    
    doc = file_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.files.insert_one(doc)
    return file_obj

@api_router.get("/patients/{patient_id}/files")
async def get_patient_files(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"patient_id": patient_id} if is_admin else {"patient_id": patient_id, "doctor_id": doctor['id']}
    files = await db.files.find(query, {"_id": 0}).to_list(1000)
    for file in files:
        fix_datetime(file, ['created_at'])
    return files

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": file_id} if is_admin else {"id": file_id, "doctor_id": doctor['id']}
    result = await db.files.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    await log_activity(doctor['id'], doctor['name'], "delete", "file", file_id, "Archivo eliminado")
    return {"message": "Archivo eliminado"}

# --- Dashboard ---
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    doc_filter = {} if is_admin else {"doctor_id": doctor['id']}
    
    total_patients = await db.patients.count_documents(doc_filter)
    active_treatments = await db.patients.count_documents({**doc_filter, "status": "active"})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    appt_filter = {**doc_filter, "date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}
    appointments_today = await db.appointments.count_documents(appt_filter)
    
    pending_filter = {**doc_filter, "status": "scheduled"}
    pending_appointments = await db.appointments.count_documents(pending_filter)
    
    return DashboardStats(
        total_patients=total_patients,
        appointments_today=appointments_today,
        active_treatments=active_treatments,
        pending_appointments=pending_appointments
    )

@api_router.post("/patients/{patient_id}/upload-file")
async def upload_patient_file(
    patient_id: str,
    file: UploadFile = File(...),
    doctor: dict = Depends(get_current_doctor_full)
):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": patient_id} if is_admin else {"id": patient_id, "doctor_id": doctor['id']}
    patient = await db.patients.find_one(query, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    contents = await file.read()
    file_data = base64.b64encode(contents).decode('utf-8')
    
    file_obj = FileUpload(
        patient_id=patient_id,
        doctor_id=doctor['id'],
        file_name=file.filename,
        file_url=f"data:{file.content_type};base64,{file_data}",
        file_type=file.content_type
    )
    
    doc = file_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.files.insert_one(doc)
    await log_activity(doctor['id'], doctor['name'], "create", "file", file_obj.id, f"Archivo subido: {file.filename}")
    return file_obj

@api_router.get("/appointments/upcoming-reminders")
async def get_upcoming_reminders(doctor_id: str = Depends(get_current_doctor)):
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    day_after = now + timedelta(days=2)
    
    appointments = await db.appointments.find({
        "doctor_id": doctor_id,
        "status": "scheduled",
        "date": {
            "$gte": tomorrow.isoformat(),
            "$lt": day_after.isoformat()
        }
    }, {"_id": 0}).to_list(100)
    
    for appointment in appointments:
        fix_datetime(appointment, ['date', 'created_at'])
        patient = await db.patients.find_one({"id": appointment['patient_id']}, {"_id": 0})
        if patient:
            appointment['patient_name'] = patient['name']
            appointment['patient_phone'] = patient['phone']
    
    return appointments

# --- PDF Export ---
@api_router.get("/patients/{patient_id}/export-pdf")
async def export_patient_pdf(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": patient_id} if is_admin else {"id": patient_id, "doctor_id": doctor['id']}
    patient = await db.patients.find_one(query, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    consultations = await db.consultations.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    appointments = await db.appointments.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#D97757'),
        spaceAfter=30,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#4B7F52'),
        spaceAfter=12,
    )
    
    # Add doctor logo if available
    logo_path = None
    if doctor.get('logo_url'):
        potential_path = str(ROOT_DIR) + doctor['logo_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(potential_path):
            logo_path = potential_path
    
    if logo_path:
        try:
            logo_img = Image(logo_path, width=2*inch, height=1*inch)
            logo_img.hAlign = 'LEFT'
            story.append(logo_img)
            story.append(Spacer(1, 0.2*inch))
        except Exception:
            pass
    
    story.append(Paragraph("Arandu Clinic", title_style))
    story.append(Paragraph("Historial Clínico del Paciente", styles['Heading2']))
    story.append(Spacer(1, 0.3*inch))
    
    patient_data = [
        ['Nombre:', patient['name']],
        ['Edad:', f"{patient['age']} años"],
        ['Cédula:', patient['cedula']],
        ['Nacionalidad:', patient.get('nationality') or 'No especificada'],
        ['Teléfono:', patient['phone']],
        ['Domicilio:', patient['address']],
        ['Ocupación:', patient['occupation']],
        ['Seguro Médico:', patient.get('insurance_name') or 'Sin seguro'],
        ['Nro. Carnet Seguro:', patient.get('insurance_number') or 'N/A'],
        ['Estado:', patient['status']],
    ]
    
    patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F2EB')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E0D6'))
    ]))
    
    story.append(patient_table)
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("Historial Médico", heading_style))
    story.append(Paragraph(patient['medical_history'], styles['Normal']))
    story.append(Spacer(1, 0.3*inch))
    
    if consultations:
        story.append(Paragraph(f"Consultas Realizadas ({len(consultations)})", heading_style))
        for cons in consultations:
            date_str = datetime.fromisoformat(cons['date']) if isinstance(cons['date'], str) else cons['date']
            story.append(Paragraph(f"<b>Fecha:</b> {date_str.strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
            story.append(Paragraph(f"<b>Diagnóstico:</b> {cons['diagnosis']}", styles['Normal']))
            story.append(Paragraph(f"<b>Tratamiento:</b> {cons['treatment']}", styles['Normal']))
            story.append(Paragraph(f"<b>Notas:</b> {cons['notes']}", styles['Normal']))
            story.append(Spacer(1, 0.2*inch))
    
    if appointments:
        story.append(Paragraph(f"Citas Programadas ({len(appointments)})", heading_style))
        for apt in appointments:
            date_str = datetime.fromisoformat(apt['date']) if isinstance(apt['date'], str) else apt['date']
            story.append(Paragraph(f"<b>Fecha:</b> {date_str.strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
            story.append(Paragraph(f"<b>Motivo:</b> {apt['reason']}", styles['Normal']))
            story.append(Paragraph(f"<b>Estado:</b> {apt['status']}", styles['Normal']))
            story.append(Spacer(1, 0.2*inch))
    
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(f"Documento generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Italic']))
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=historial_{patient['name'].replace(' ', '_')}.pdf"
        }
    )

# --- Prescriptions ---
@api_router.post("/prescriptions")
async def create_prescription(input: PrescriptionCreate, doctor: dict = Depends(get_current_doctor_full)):
    prescription_dict = input.model_dump()
    prescription_dict['doctor_id'] = doctor['id']
    prescription_dict['date'] = datetime.now(timezone.utc)
    prescription_obj = Prescription(**prescription_dict)
    
    doc = prescription_obj.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.prescriptions.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(doctor['id'], doctor['name'], "create", "prescription", prescription_obj.id, f"Receta creada para {patient['name'] if patient else 'N/A'}")
    
    result = prescription_obj.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/patients/{patient_id}/prescriptions")
async def get_patient_prescriptions(patient_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"patient_id": patient_id} if is_admin else {"patient_id": patient_id, "doctor_id": doctor['id']}
    prescriptions = await db.prescriptions.find(query, {"_id": 0}).to_list(1000)
    for prescription in prescriptions:
        fix_datetime(prescription, ['date', 'created_at'])
    return prescriptions

@api_router.put("/prescriptions/{prescription_id}")
async def update_prescription(prescription_id: str, input: PrescriptionUpdate, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    query = {"id": prescription_id} if is_admin else {"id": prescription_id, "doctor_id": doctor['id']}
    result = await db.prescriptions.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    await log_activity(doctor['id'], doctor['name'], "update", "prescription", prescription_id, "Receta actualizada")
    return {"message": "Receta actualizada"}

@api_router.delete("/prescriptions/{prescription_id}")
async def delete_prescription(prescription_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": prescription_id} if is_admin else {"id": prescription_id, "doctor_id": doctor['id']}
    result = await db.prescriptions.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    await log_activity(doctor['id'], doctor['name'], "delete", "prescription", prescription_id, "Receta eliminada")
    return {"message": "Receta eliminada"}

@api_router.get("/prescriptions/{prescription_id}/pdf")
async def export_prescription_pdf(prescription_id: str, doctor: dict = Depends(get_current_doctor_full)):
    is_admin = doctor.get('role') == 'admin'
    query = {"id": prescription_id} if is_admin else {"id": prescription_id, "doctor_id": doctor['id']}
    prescription = await db.prescriptions.find_one(query, {"_id": 0})
    if not prescription:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    patient = await db.patients.find_one({"id": prescription['patient_id']}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Get the prescribing doctor's info (not necessarily the current user)
    prescribing_doctor = await db.doctors.find_one({"id": prescription['doctor_id']}, {"_id": 0, "password": 0})
    if not prescribing_doctor:
        prescribing_doctor = {"name": "Desconocido", "specialty": None, "license_number": None}
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=colors.HexColor('#D97757'),
        spaceAfter=10,
        alignment=1,
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#4B7F52'),
        spaceAfter=30,
        alignment=1,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#4B7F52'),
        spaceAfter=8,
        spaceBefore=12,
    )
    
    # Add custom logo if the prescribing doctor has one
    logo_path = None
    if prescribing_doctor.get('logo_url'):
        potential_path = str(ROOT_DIR) + prescribing_doctor['logo_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(potential_path):
            logo_path = potential_path
    
    if logo_path:
        try:
            logo_img = Image(logo_path, width=2.5*inch, height=1.2*inch)
            logo_img.hAlign = 'CENTER'
            story.append(logo_img)
            story.append(Spacer(1, 0.15*inch))
        except Exception:
            pass
    
    story.append(Paragraph("Arandu Clinic", title_style))
    story.append(Paragraph("Receta Médica", subtitle_style))
    story.append(Spacer(1, 0.2*inch))
    
    date_str = datetime.fromisoformat(prescription['date']) if isinstance(prescription['date'], str) else prescription['date']
    story.append(Paragraph(f"<b>Fecha:</b> {date_str.strftime('%d/%m/%Y')}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    patient_info = [
        ['Paciente:', patient['name']],
        ['Edad:', f"{patient['age']} años"],
        ['Cédula:', patient['cedula']],
    ]
    
    patient_table = Table(patient_info, colWidths=[1.5*inch, 4*inch])
    patient_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    story.append(patient_table)
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("Diagnóstico", heading_style))
    story.append(Paragraph(prescription['diagnosis'], styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Medicamentos", heading_style))
    story.append(Paragraph(prescription['medications'], styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Instrucciones", heading_style))
    story.append(Paragraph(prescription['instructions'], styles['Normal']))
    story.append(Spacer(1, 0.5*inch))
    
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("_" * 50, styles['Normal']))
    story.append(Paragraph(f"Dr. {prescribing_doctor['name']}", styles['Normal']))
    if prescribing_doctor.get('specialty'):
        story.append(Paragraph(prescribing_doctor['specialty'], styles['Normal']))
    else:
        story.append(Paragraph("Médico", styles['Normal']))
    if prescribing_doctor.get('license_number'):
        story.append(Paragraph(f"Mat. {prescribing_doctor['license_number']}", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=receta_{patient['name'].replace(' ', '_')}_{date_str.strftime('%Y%m%d')}.pdf"
        }
    )

# --- Advanced Stats ---
@api_router.get("/dashboard/advanced-stats")
async def get_advanced_stats(doctor: dict = Depends(get_current_doctor_full)):
    from collections import Counter
    
    is_admin = doctor.get('role') == 'admin'
    doc_filter = {} if is_admin else {"doctor_id": doctor['id']}
    
    total_patients = await db.patients.count_documents(doc_filter)
    
    all_appointments = await db.appointments.find(doc_filter, {"_id": 0}).to_list(10000)
    all_consultations = await db.consultations.find(doc_filter, {"_id": 0}).to_list(10000)
    all_patients = await db.patients.find(doc_filter, {"_id": 0}).to_list(10000)
    
    appointments_by_month = {}
    for apt in all_appointments:
        date = datetime.fromisoformat(apt['date']) if isinstance(apt['date'], str) else apt['date']
        month_key = date.strftime('%Y-%m')
        appointments_by_month[month_key] = appointments_by_month.get(month_key, 0) + 1
    
    consultations_by_month = {}
    for cons in all_consultations:
        date = datetime.fromisoformat(cons['date']) if isinstance(cons['date'], str) else cons['date']
        month_key = date.strftime('%Y-%m')
        consultations_by_month[month_key] = consultations_by_month.get(month_key, 0) + 1
    
    diagnoses = [cons['diagnosis'] for cons in all_consultations]
    diagnosis_counts = Counter(diagnoses)
    top_diagnoses = [{"name": diag, "count": count} for diag, count in diagnosis_counts.most_common(5)]
    
    patient_growth = {}
    for patient in all_patients:
        date = datetime.fromisoformat(patient['created_at']) if isinstance(patient['created_at'], str) else patient['created_at']
        month_key = date.strftime('%Y-%m')
        patient_growth[month_key] = patient_growth.get(month_key, 0) + 1
    
    sorted_months = sorted(set(list(appointments_by_month.keys()) + list(consultations_by_month.keys()) + list(patient_growth.keys())))
    
    appointments_data = [{"month": month, "count": appointments_by_month.get(month, 0)} for month in sorted_months[-6:]]
    consultations_data = [{"month": month, "count": consultations_by_month.get(month, 0)} for month in sorted_months[-6:]]
    patient_growth_data = [{"month": month, "count": patient_growth.get(month, 0)} for month in sorted_months[-6:]]
    
    return {
        "total_patients": total_patients,
        "appointments_by_month": appointments_data,
        "consultations_by_month": consultations_data,
        "top_diagnoses": top_diagnoses,
        "patient_growth": patient_growth_data
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
