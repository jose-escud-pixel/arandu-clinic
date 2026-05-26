from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt, jwt, base64
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import inch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Multi-Tenant Clinic Platform")
api_router = APIRouter(prefix="/api")

uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
(uploads_dir / "photos").mkdir(exist_ok=True)
(uploads_dir / "logos").mkdir(exist_ok=True)
(uploads_dir / "firmas").mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'clinic-multitenant-secret-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_APP = 'arandu-clinic'

logger = logging.getLogger("arandu")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ═══════════════════════════════════════════════════════════════
# MODELOS
# ═══════════════════════════════════════════════════════════════

class Empresa(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    nombre: str
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str = "#D97757"
    secondary_color: str = "#4B7F52"
    bg_color: str = "#FDFCF8"
    text_color: str = "#2D2A26"
    muted_color: str = "#F5F2EB"
    border_color: str = "#E5E0D6"
    profesional_label: str = "Doctor"    # or "Fisioterapeuta"
    indicaciones_label: str = "Indicaciones"
    extended_patient: bool = False
    # Modo de visibilidad de pacientes:
    #   "private" → cada doctor sólo ve sus pacientes (admin ve todos). Caso Arandu Clinic.
    #   "shared"  → todos los usuarios de la empresa ven todos los pacientes. Default para empresas nuevas.
    patient_sharing_mode: str = "shared"
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmpresaCreate(BaseModel):
    slug: str
    nombre: str
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    primary_color: str = "#D97757"
    secondary_color: str = "#4B7F52"
    bg_color: str = "#FDFCF8"
    text_color: str = "#2D2A26"
    muted_color: str = "#F5F2EB"
    border_color: str = "#E5E0D6"
    profesional_label: str = "Doctor"
    indicaciones_label: str = "Indicaciones"
    extended_patient: bool = False
    patient_sharing_mode: str = "shared"   # nuevas empresas: pacientes compartidos por defecto

class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = None
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    muted_color: Optional[str] = None
    border_color: Optional[str] = None
    profesional_label: Optional[str] = None
    indicaciones_label: Optional[str] = None
    extended_patient: Optional[bool] = None
    patient_sharing_mode: Optional[str] = None
    active: Optional[bool] = None

class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "doctor"   # "super_admin" | "admin" | "coordinador" | "doctor"
    empresa_id: Optional[str] = None   # None → super_admin, sin empresa fija
    empresas: List[str] = []           # IDs de empresas accesibles
    permissions: Dict[str, bool] = Field(default_factory=dict)
    status: str = "pending"
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    ci_ruc: Optional[str] = None
    ci_dv: Optional[str] = None
    photo_url: Optional[str] = None
    firma_url: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    empresa_slug: Optional[str] = None

class DoctorLogin(BaseModel):
    email: EmailStr
    password: str

class DoctorProfileUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    ci_ruc: Optional[str] = None
    ci_dv: Optional[str] = None

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class AdminChangePassword(BaseModel):
    new_password: str

class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    empresa_ids: Optional[List[str]] = None
    permissions: Optional[Dict[str, bool]] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None

class SwitchEmpresaInput(BaseModel):
    empresa_id: str

class AssignEmpresasInput(BaseModel):
    empresa_ids: List[str]

class CreateUserAdmin(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "doctor"
    empresa_id: str
    permissions: Optional[Dict[str, bool]] = None

class UpdatePermissionsInput(BaseModel):
    permissions: Dict[str, bool]

class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    doctor_id: str
    name: str
    # Todos los campos opcionales aceptan None / "" — evita 500 al guardar pacientes
    # con datos parciales (la edad o la cédula pueden quedar vacíos al registrar).
    age: Optional[int] = None
    cedula: Optional[str] = ""
    nationality: Optional[str] = None
    address: Optional[str] = ""
    occupation: Optional[str] = ""
    phone: Optional[str] = ""
    insurance_name: Optional[str] = None
    insurance_number: Optional[str] = None
    medical_history: Optional[str] = ""
    status: str = "active"
    # Campos extendidos (Equilibrio)
    sexo: Optional[str] = None
    peso: Optional[float] = None
    estado_civil: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    ci_ruc: Optional[str] = None      # CI/RUC separado del cedula (Equilibrio)
    ci_dv: Optional[str] = None       # Dígito verificador
    current_status: Optional[str] = None  # Estado actual / evolución
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PatientCreate(BaseModel):
    name: str
    age: Optional[int] = None
    cedula: Optional[str] = ""
    nationality: Optional[str] = None
    address: Optional[str] = ""
    occupation: Optional[str] = ""
    phone: Optional[str] = ""
    insurance_name: Optional[str] = None
    insurance_number: Optional[str] = None
    medical_history: Optional[str] = ""
    status: Optional[str] = "active"
    sexo: Optional[str] = None
    peso: Optional[float] = None
    estado_civil: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    ci_ruc: Optional[str] = None
    ci_dv: Optional[str] = None
    current_status: Optional[str] = None

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
    sexo: Optional[str] = None
    peso: Optional[float] = None
    estado_civil: Optional[str] = None
    contacto_emergencia: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    ci_ruc: Optional[str] = None
    ci_dv: Optional[str] = None
    current_status: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
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
    empresa_id: str
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
    empresa_id: str
    patient_id: str
    doctor_id: str
    file_name: str
    file_url: str
    file_type: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Prescription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    patient_id: str
    doctor_id: str
    date: datetime
    medications: str
    instructions: str
    diagnosis: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PrescriptionCreate(BaseModel):
    patient_id: str
    medications: Optional[str] = ""
    instructions: Optional[str] = ""
    diagnosis: Optional[str] = ""

class PrescriptionUpdate(BaseModel):
    medications: Optional[str] = None
    instructions: Optional[str] = None
    diagnosis: Optional[str] = None

class MedicalHistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    patient_id: str
    doctor_id: str
    category: str = "otro"
    description: str
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MedicalHistoryEntryCreate(BaseModel):
    category: str = "otro"
    description: str
    date: Optional[str] = None

class MedicalHistoryEntryUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    doctor_id: Optional[str] = None   # None = broadcast
    title: str
    message: str
    type: str = "info"   # info | warning | alert | appointment
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationCreate(BaseModel):
    doctor_id: Optional[str] = None
    title: str
    message: str
    type: str = "info"

class DashboardStats(BaseModel):
    total_patients: int
    appointments_today: int
    active_treatments: int
    pending_appointments: int

# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(doctor_id: str, empresa_id: Optional[str] = None, role: str = "doctor") -> str:
    payload = {
        'app': JWT_APP,
        'doctor_id': doctor_id,
        'empresa_id': empresa_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def is_privileged(user: dict) -> bool:
    return user.get('role') in ['admin', 'coordinador', 'super_admin']

def get_empresa_filter(user: dict) -> dict:
    role = user.get('role', 'doctor')
    if role == 'super_admin':
        eid = user.get('current_empresa_id')
        return {"empresa_id": eid} if eid else {}
    eid = user.get('current_empresa_id') or user.get('empresa_id')
    if not eid:
        raise HTTPException(403, "Usuario sin empresa asignada")
    return {"empresa_id": eid}

def get_user_empresa_id(user: dict) -> Optional[str]:
    return user.get('current_empresa_id') or user.get('empresa_id')

def get_user_empresa_ids(user: dict) -> List[str]:
    ids = [eid for eid in (user.get('empresas') or []) if eid]
    primary = user.get('empresa_id')
    current = user.get('current_empresa_id')
    for eid in [primary, current]:
        if eid and eid not in ids:
            ids.append(eid)
    return ids

def user_can_access_empresa(user: dict, empresa_id: str) -> bool:
    return user.get('role') == 'super_admin' or empresa_id in get_user_empresa_ids(user)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('app') != JWT_APP:
            raise HTTPException(401, "Token inválido para Arandu Clinic")
        return payload['doctor_id']
    except HTTPException:
        raise
    except:
        raise HTTPException(401, "Token inválido")

async def get_current_user_full(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('app') != JWT_APP:
            raise HTTPException(401, "Token inválido para Arandu Clinic")
        doctor_id = payload['doctor_id']
        empresa_id = payload.get('empresa_id')
    except HTTPException:
        raise
    except:
        raise HTTPException(401, "Token inválido")
    user = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if user.get('status') == 'pending':
        raise HTTPException(403, "Cuenta pendiente de aprobación")
    if user.get('status') == 'rejected':
        raise HTTPException(403, "Cuenta rechazada")
    user['current_empresa_id'] = empresa_id
    return user

async def require_admin_or_super(user: dict = Depends(get_current_user_full)):
    if user.get('role') not in ['admin', 'super_admin']:
        raise HTTPException(403, "Solo administradores.")
    return user

async def require_super_admin(user: dict = Depends(get_current_user_full)):
    if user.get('role') != 'super_admin':
        raise HTTPException(403, "Solo Super Administrador.")
    return user

def check_permission(user: dict, perm: str) -> bool:
    """Verifica si el usuario tiene el permiso 'modulo.accion'.
    super_admin y admin siempre tienen acceso total."""
    if user.get('role') in ['super_admin', 'admin']:
        return True
    return user.get('permissions', {}).get(perm, False)

def require_permission(user: dict, perm: str):
    """Lanza 403 si el doctor no tiene el permiso requerido."""
    if not check_permission(user, perm):
        module, _, action = perm.partition('.')
        raise HTTPException(403, f"Sin permiso: {PERMISOS_LABELS.get(perm, perm)}")

# ── Catálogo de permisos granulares ───────────────────────────
# Formato: { "modulo": ["accion1", "accion2", ...] }
# admin/super_admin tienen todos implícitamente; estos aplican a doctor/coordinador.
PERMISOS_DISPONIBLES = {
    "pacientes":        ["ver", "crear", "editar", "eliminar", "exportar_pdf"],
    "citas":            ["ver", "crear", "editar", "eliminar"],
    "historia_clinica": ["ver", "crear", "editar", "eliminar"],
    "consultas":        ["ver", "crear", "editar", "eliminar"],
    "recetas":          ["ver", "crear", "editar", "eliminar"],
    "archivos":         ["ver", "subir", "eliminar"],
    "estadisticas":     ["ver"],
}

PERMISOS_LABELS = {
    "pacientes.ver":           "Ver pacientes",
    "pacientes.crear":         "Crear pacientes",
    "pacientes.editar":        "Editar pacientes",
    "pacientes.eliminar":      "Eliminar pacientes",
    "pacientes.exportar_pdf":  "Exportar PDF paciente",
    "citas.ver":               "Ver citas",
    "citas.crear":             "Crear citas",
    "citas.editar":            "Editar citas",
    "citas.eliminar":          "Eliminar citas",
    "historia_clinica.ver":    "Ver historia clínica",
    "historia_clinica.crear":  "Agregar antecedentes",
    "historia_clinica.editar": "Editar antecedentes",
    "historia_clinica.eliminar": "Eliminar antecedentes",
    "consultas.ver":           "Ver consultas",
    "consultas.crear":         "Crear consultas",
    "consultas.editar":        "Editar consultas",
    "consultas.eliminar":      "Eliminar consultas",
    "recetas.ver":             "Ver recetas/indicaciones",
    "recetas.crear":           "Crear recetas",
    "recetas.editar":          "Editar recetas",
    "recetas.eliminar":        "Eliminar recetas",
    "archivos.ver":            "Ver archivos adjuntos",
    "archivos.subir":          "Subir archivos",
    "archivos.eliminar":       "Eliminar archivos",
    "estadisticas.ver":        "Ver estadísticas",
}

# Permisos asignados por defecto a un doctor recién creado
PERMISOS_DEFAULT_DOCTOR = {
    "pacientes.ver": True,
    "pacientes.crear": True,
    "pacientes.editar": True,
    "pacientes.eliminar": False,
    "pacientes.exportar_pdf": True,
    "citas.ver": True,
    "citas.crear": True,
    "citas.editar": True,
    "citas.eliminar": False,
    "historia_clinica.ver": True,
    "historia_clinica.crear": True,
    "historia_clinica.editar": True,
    "historia_clinica.eliminar": False,
    "consultas.ver": True,
    "consultas.crear": True,
    "consultas.editar": True,
    "consultas.eliminar": False,
    "recetas.ver": True,
    "recetas.crear": True,
    "recetas.editar": True,
    "recetas.eliminar": False,
    "archivos.ver": True,
    "archivos.subir": True,
    "archivos.eliminar": False,
    "estadisticas.ver": True,
}

PERMISOS_DEFAULT_COORDINADOR = {
    f"{modulo}.{accion}": True
    for modulo, acciones in PERMISOS_DISPONIBLES.items()
    for accion in acciones
}
PERMISOS_DEFAULT_COORDINADOR["estadisticas.ver"] = True

# ── Permisos verticales ────────────────────────────────────────
# Reglas de la jerarquía:
#   super_admin > admin > coordinador > doctor
# Nadie puede degradar a alguien de su mismo rango o superior, ni degradarse
# a sí mismo. Sólo se puede operar sobre usuarios de rango estrictamente
# inferior (o sobre sí mismo en acciones que no impliquen degradación).
ROLE_RANK = {"doctor": 1, "coordinador": 2, "admin": 3, "super_admin": 4}

def role_rank(role: Optional[str]) -> int:
    return ROLE_RANK.get(role or "doctor", 1)

def assert_can_manage_target(actor: dict, target: dict, action: str = "modificar"):
    """
    Verifica que el actor pueda actuar sobre target en acciones administrativas
    *destructivas o que cambian su rol* (degradar, eliminar, deshabilitar,
    rechazar, cambiar contraseña). NO usar para promociones — para eso usar
    assert_can_change_role.
    Reglas:
    - Nadie puede actuar sobre sí mismo en acciones destructivas.
    - El rango del actor debe ser estrictamente mayor al del target.
    """
    if target.get('id') == actor.get('id'):
        raise HTTPException(403, f"No puedes {action} tu propia cuenta")
    if role_rank(actor.get('role')) <= role_rank(target.get('role')):
        raise HTTPException(403,
            f"No puedes {action} a un usuario con rango igual o superior al tuyo")

def assert_can_change_role(actor: dict, target: dict, new_role: str):
    """
    Reglas para cambiar el rol de target a new_role:
    - No te puedes cambiar tu propio rol (ni para subir ni para bajar).
    - Sólo puedes asignar roles de rango estrictamente inferior al tuyo.
      (admin ⇒ doctor/coordinador; super_admin ⇒ admin/coordinador/doctor).
    - Sólo puedes cambiar el rol de usuarios de rango estrictamente inferior
      al tuyo.
    """
    if target.get('id') == actor.get('id'):
        raise HTTPException(403, "No puedes cambiar tu propio rol")
    if new_role not in ROLE_RANK:
        raise HTTPException(400, "Rol inválido")
    actor_rank = role_rank(actor.get('role'))
    if role_rank(target.get('role')) >= actor_rank:
        raise HTTPException(403,
            "No puedes cambiar el rol de un usuario con rango igual o superior al tuyo")
    if role_rank(new_role) >= actor_rank:
        raise HTTPException(403,
            "No puedes asignar un rol igual o superior al tuyo")

async def log_activity(user_id: str, user_name: str, action: str, target_type: str,
                       target_id: str, details: str, empresa_id: Optional[str] = None):
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "target_type": target_type,
        "module": target_type,
        "target_id": target_id,
        "details": details,
        "empresa_id": empresa_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

async def get_doctor_name(doctor_id: str) -> str:
    doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "name": 1})
    return doc['name'] if doc else 'Desconocido'

def fix_datetime(record, fields):
    for f in fields:
        if f in record and isinstance(record[f], str):
            try:
                record[f] = datetime.fromisoformat(record[f])
            except:
                pass

async def get_empresa_sharing_mode(empresa_id: Optional[str]) -> str:
    """
    Devuelve "shared" o "private" según la empresa.
    - Arandu Clinic (legacy): "private" — cada doctor ve sólo sus pacientes.
    - Cualquier otra empresa: "shared" por defecto — todos los usuarios ven todos los pacientes.
    El admin/super_admin siempre ve todo dentro de su empresa, independiente del modo.
    """
    if not empresa_id:
        return "shared"
    emp = await db.empresas.find_one(
        {"id": empresa_id},
        {"_id": 0, "patient_sharing_mode": 1, "slug": 1}
    )
    if not emp:
        return "shared"
    mode = emp.get("patient_sharing_mode")
    if mode in ("shared", "private"):
        return mode
    # Sin campo → fallback por slug (Arandu = private, resto = shared)
    return "private" if emp.get("slug") == "arandu-clinic" else "shared"

async def get_patient_filter(user: dict) -> dict:
    """
    Construye el filtro de Mongo para listar/leer pacientes respetando:
    - empresa actual del usuario
    - rol (admin/super_admin ven todo en su empresa)
    - empresa.patient_sharing_mode:
        * "shared"  → todos los usuarios de la empresa ven todos los pacientes
        * "private" → cada doctor sólo ve sus propios pacientes (legacy Arandu)
    """
    empresa_filter = get_empresa_filter(user)
    if is_privileged(user):
        return empresa_filter
    eid = get_user_empresa_id(user)
    mode = await get_empresa_sharing_mode(eid)
    if mode == "shared":
        return empresa_filter
    return {**empresa_filter, "doctor_id": user['id']}

async def get_empresa_config(empresa_id: Optional[str]) -> dict:
    """Returns empresa config dict. Falls back to default arandu config."""
    default = {
        "nombre": "Arandu Clinic",
        "logo_url": None,
        "primary_color": "#D97757",
        "secondary_color": "#4B7F52",
        "profesional_label": "Doctor",
        "indicaciones_label": "Indicaciones",
        "extended_patient": False
    }
    if not empresa_id:
        return default
    emp = await db.empresas.find_one({"id": empresa_id}, {"_id": 0})
    return emp if emp else default

# ═══════════════════════════════════════════════════════════════
# STARTUP: crear empresas por defecto si no existen
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    # arandu-clinic — sistema original para doctores independientes (cada doctor ve sus pacientes)
    if not await db.empresas.find_one({"slug": "arandu-clinic"}):
        await db.empresas.insert_one({
            "id": str(uuid.uuid4()),
            "slug": "arandu-clinic",
            "nombre": "Arandu Clinic",
            "logo_url": None,
            "primary_color": "#D97757",
            "secondary_color": "#4B7F52",
            "bg_color": "#FDFCF8",
            "text_color": "#2D2A26",
            "muted_color": "#F5F2EB",
            "border_color": "#E5E0D6",
            "profesional_label": "Doctor",
            "indicaciones_label": "Indicaciones",
            "extended_patient": False,
            "patient_sharing_mode": "private",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    # equilibrio — clínica con varios profesionales: pacientes compartidos
    if not await db.empresas.find_one({"slug": "equilibrio"}):
        await db.empresas.insert_one({
            "id": str(uuid.uuid4()),
            "slug": "equilibrio",
            "nombre": "Equilibrio Salud y Bienestar",
            "logo_url": None,
            "primary_color": "#D4238A",
            "secondary_color": "#79B82C",
            "bg_color": "#0D0D0D",
            "text_color": "#FFFFFF",
            "muted_color": "#1A1A1A",
            "border_color": "#2A2A2A",
            "profesional_label": "Fisioterapeuta",
            "indicaciones_label": "Indicaciones",
            "extended_patient": True,
            "patient_sharing_mode": "shared",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # ── Backfill patient_sharing_mode para empresas existentes ──
    # Arandu Clinic mantiene la lógica original (private). Cualquier otra empresa
    # ya creada que no tenga el campo se asume "shared".
    await db.empresas.update_many(
        {"slug": "arandu-clinic", "patient_sharing_mode": {"$exists": False}},
        {"$set": {"patient_sharing_mode": "private"}}
    )
    await db.empresas.update_many(
        {"slug": {"$ne": "arandu-clinic"}, "patient_sharing_mode": {"$exists": False}},
        {"$set": {"patient_sharing_mode": "shared"}}
    )

    # ── Garantizar que jose@aranduinformatica.net sea super_admin ──────────
    SUPER_ADMIN_EMAIL = "jose@aranduinformatica.net"
    jose_user = await db.doctors.find_one({"email": SUPER_ADMIN_EMAIL})
    if jose_user:
        # Actualizar rol a super_admin si no lo es ya
        if jose_user.get("role") != "super_admin":
            await db.doctors.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {"$set": {
                    "role": "super_admin",
                    "status": "active",
                    "empresa_id": None,   # super_admin no tiene empresa fija
                    "empresas": [],
                }}
            )
            print(f"[startup] {SUPER_ADMIN_EMAIL} → role=super_admin")
    else:
        # Si no existe aún, crear el usuario con rol super_admin
        # (contraseña provisional: cambiala desde el panel Admin)
        _hash = hash_password("Arandu2024!")
        await db.doctors.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Jose Admin",
            "email": SUPER_ADMIN_EMAIL,
            "password": _hash,
            "role": "super_admin",
            "status": "active",
            "empresa_id": None,
            "empresas": [],
            "permissions": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"[startup] Creado {SUPER_ADMIN_EMAIL} como super_admin (pass: Arandu2024!)")

    # ── Migrar doctores existentes sin empresa_id → arandu-clinic ─────────
    arandu_empresa = await db.empresas.find_one({"slug": "arandu-clinic"}, {"_id": 0})
    if arandu_empresa:
        arandu_id = arandu_empresa["id"]
        # Todos los usuarios (excepto super_admin) sin empresa_id van a arandu-clinic
        result = await db.doctors.update_many(
            {
                "empresa_id": {"$in": [None, ""]},
                "role": {"$ne": "super_admin"},
            },
            {
                "$set": {"empresa_id": arandu_id},
                "$addToSet": {"empresas": arandu_id},
            }
        )
        if result.modified_count > 0:
            print(f"[startup] Migrados {result.modified_count} usuario(s) a arandu-clinic")
        # Igual con los pacientes, consultas, etc. sin empresa_id
        for col_name in ["patients", "appointments", "consultations", "prescriptions", "files"]:
            col = db[col_name]
            r = await col.update_many(
                {"empresa_id": {"$in": [None, ""]}},
                {"$set": {"empresa_id": arandu_id}}
            )
            if r.modified_count > 0:
                print(f"[startup] Migrados {r.modified_count} doc(s) en '{col_name}' a arandu-clinic")

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

@api_router.post("/auth/register")
async def register(input: DoctorCreate):
    existing = await db.doctors.find_one({"email": input.email})
    if existing:
        raise HTTPException(400, "El email ya está registrado")

    total_users = await db.doctors.count_documents({})
    is_first = total_users == 0

    doctor_dict = input.model_dump()
    hashed_pw = hash_password(doctor_dict.pop('password'))
    empresa_slug = doctor_dict.pop('empresa_slug', None)

    empresa_id = None
    empresas_list = []

    if is_first:
        role = "super_admin"
        status_val = "active"
    else:
        role = "doctor"
        status_val = "pending"
        if empresa_slug:
            empresa = await db.empresas.find_one({"slug": empresa_slug}, {"_id": 0})
            if empresa:
                empresa_id = empresa['id']
                empresas_list = [empresa_id]

    doctor_obj = Doctor(**doctor_dict, role=role, status=status_val,
                        empresa_id=empresa_id, empresas=empresas_list)
    doc = doctor_obj.model_dump()
    doc['password'] = hashed_pw
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)

    if is_first:
        token = create_token(doctor_obj.id, empresa_id, role)
        result = {k: v for k, v in doc.items() if k not in ['_id', 'password']}
        return {"token": token, "doctor": result, "empresas": []}
    return {"message": "Registro enviado. Pendiente de aprobación.", "pending": True}

@api_router.post("/auth/login")
async def login(input: DoctorLogin):
    doctor = await db.doctors.find_one({"email": input.email}, {"_id": 0})
    if not doctor or not verify_password(input.password, doctor.get('password', '')):
        raise HTTPException(401, "Credenciales inválidas")
    if doctor.get('status') == 'pending':
        raise HTTPException(403, "Cuenta pendiente de aprobación")
    if doctor.get('status') == 'rejected':
        raise HTTPException(403, "Cuenta rechazada. Contacta al administrador.")
    if doctor.get('status') == 'disabled':
        raise HTTPException(403, "Cuenta deshabilitada. Contacta al administrador.")

    role = doctor.get('role', 'doctor')
    empresa_id = doctor.get('empresa_id')

    accessible_empresas = []
    
    if role == 'super_admin':
        # Super admin ve TODAS las empresas activas
        empresas_raw = await db.empresas.find({"active": True}, {"_id": 0}).to_list(100)
        accessible_empresas = empresas_raw
    else:
        empresa_ids = [eid for eid in (doctor.get('empresas') or []) if eid]
        if empresa_id and empresa_id not in empresa_ids:
            empresa_ids.insert(0, empresa_id)
        accessible_empresas = await db.empresas.find(
            {"id": {"$in": empresa_ids}, "active": True},
            {"_id": 0}
        ).to_list(100)
        if accessible_empresas and empresa_id not in [emp["id"] for emp in accessible_empresas]:
            empresa_id = accessible_empresas[0]["id"]

    token = create_token(doctor['id'], empresa_id, role)
    doctor.pop('password', None)
    doctor['empresa_id'] = empresa_id
    doctor['current_empresa_id'] = empresa_id
    if isinstance(doctor.get('created_at'), str):
        try:
            doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
        except:
            pass

    return {"token": token, "doctor": doctor, "empresas": accessible_empresas}

@api_router.post("/auth/switch-empresa")
async def switch_empresa(input: SwitchEmpresaInput, user: dict = Depends(get_current_user_full)):
    role = user.get('role', 'doctor')
    empresa = await db.empresas.find_one({"id": input.empresa_id}, {"_id": 0})
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    if role == 'super_admin':
        pass  # super_admin can switch to any
    elif role == 'admin':
        if input.empresa_id != user.get('empresa_id') and input.empresa_id not in user.get('empresas', []):
            raise HTTPException(403, "Sin acceso a esta empresa")
    else:
        if input.empresa_id not in user.get('empresas', []):
            raise HTTPException(403, "Sin acceso a esta empresa")

    token = create_token(user['id'], input.empresa_id, role)
    return {"token": token, "empresa": empresa}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user_full)):
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    # Cargar empresa actual
    eid = user.get('current_empresa_id') or user.get('empresa_id')
    empresa = None
    if eid:
        empresa = await db.empresas.find_one({"id": eid}, {"_id": 0})
    user['empresa'] = empresa
    return user

@api_router.get("/auth/empresas")
async def get_my_empresas(user: dict = Depends(get_current_user_full)):
    role = user.get('role', 'doctor')
    if role == 'super_admin':
        return await db.empresas.find({"active": True}, {"_id": 0}).to_list(100)
    ids = user.get('empresas', [])
    if not ids and user.get('empresa_id'):
        ids = [user['empresa_id']]
    return await db.empresas.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)

@api_router.put("/auth/profile")
async def update_profile(input: DoctorProfileUpdate, user: dict = Depends(get_current_user_full)):
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "Sin datos para actualizar")
    await db.doctors.update_one({"id": user['id']}, {"$set": data})
    return {"message": "Perfil actualizado"}

@api_router.post("/auth/upload-photo")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user_full)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Solo imágenes")
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{user['id']}.{ext}"
    filepath = uploads_dir / "photos" / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    url = f"/api/uploads/photos/{filename}"
    await db.doctors.update_one({"id": user['id']}, {"$set": {"photo_url": url}})
    return {"photo_url": url}

@api_router.post("/auth/upload-logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(get_current_user_full)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Solo imágenes")
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"{user['id']}_logo.{ext}"
    filepath = uploads_dir / "logos" / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    url = f"/api/uploads/logos/{filename}"
    await db.doctors.update_one({"id": user['id']}, {"$set": {"logo_url": url}})
    return {"logo_url": url}

@api_router.post("/auth/upload-firma")
async def upload_firma(file: UploadFile = File(...), user: dict = Depends(get_current_user_full)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Solo imágenes")
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"{user['id']}_firma.{ext}"
    filepath = uploads_dir / "firmas" / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    url = f"/api/uploads/firmas/{filename}"
    await db.doctors.update_one({"id": user['id']}, {"$set": {"firma_url": url}})
    return {"firma_url": url}

@api_router.put("/auth/change-password")
async def change_password(input: ChangePassword, user: dict = Depends(get_current_user_full)):
    doctor = await db.doctors.find_one({"id": user['id']}, {"_id": 0})
    if not doctor or not verify_password(input.current_password, doctor.get('password', '')):
        raise HTTPException(400, "Contraseña actual incorrecta")
    await db.doctors.update_one({"id": user['id']}, {"$set": {"password": hash_password(input.new_password)}})
    return {"message": "Contraseña actualizada"}

# ═══════════════════════════════════════════════════════════════
# EMPRESAS (Super Admin)
# ═══════════════════════════════════════════════════════════════

@api_router.get("/empresas")
async def list_empresas(user: dict = Depends(get_current_user_full)):
    if user.get('role') == 'super_admin':
        return await db.empresas.find({}, {"_id": 0}).to_list(100)
    ids = get_user_empresa_ids(user)
    if not ids:
        return []
    return await db.empresas.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)

@api_router.get("/empresas/public")
async def list_empresas_public():
    """Lista pública para el login."""
    return await db.empresas.find({"active": True}, {"_id": 0,
        "id": 1, "slug": 1, "nombre": 1, "logo_url": 1,
        "primary_color": 1, "secondary_color": 1, "bg_color": 1,
        "text_color": 1, "muted_color": 1, "border_color": 1}).to_list(100)

@api_router.get("/empresas/{empresa_id}")
async def get_empresa_by_id(empresa_id: str, user: dict = Depends(get_current_user_full)):
    if not user_can_access_empresa(user, empresa_id):
        raise HTTPException(403, "Sin acceso")
    emp = await db.empresas.find_one({"id": empresa_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "Empresa no encontrada")
    return emp

@api_router.post("/empresas")
async def create_empresa(input: EmpresaCreate, user: dict = Depends(require_super_admin)):
    existing = await db.empresas.find_one({"slug": input.slug})
    if existing:
        raise HTTPException(400, "El slug ya existe")
    emp = Empresa(**input.model_dump())
    doc = emp.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.empresas.insert_one(doc)
    await log_activity(user['id'], user['name'], "create", "empresa", emp.id, f"Empresa creada: {emp.nombre}")
    return {k: v for k, v in doc.items() if k != '_id'}

@api_router.put("/empresas/{empresa_id}")
async def update_empresa(empresa_id: str, input: EmpresaUpdate, user: dict = Depends(require_admin_or_super)):
    if not user_can_access_empresa(user, empresa_id):
        raise HTTPException(403, "Sin acceso")
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    data.pop("active", None)
    if not data:
        raise HTTPException(400, "Sin datos")
    result = await db.empresas.update_one({"id": empresa_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Empresa no encontrada")
    await log_activity(user['id'], user['name'], "update", "empresa", empresa_id, "Empresa actualizada")
    return {"message": "Empresa actualizada"}

@api_router.post("/empresas/{empresa_id}/upload-logo")
async def upload_empresa_logo(empresa_id: str, file: UploadFile = File(...), user: dict = Depends(require_admin_or_super)):
    if not user_can_access_empresa(user, empresa_id):
        raise HTTPException(403, "Sin acceso")
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Solo imágenes")
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"empresa_{empresa_id}.{ext}"
    filepath = uploads_dir / "logos" / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    url = f"/api/uploads/logos/{filename}"
    await db.empresas.update_one({"id": empresa_id}, {"$set": {"logo_url": url}})
    return {"logo_url": url}

@api_router.delete("/empresas/{empresa_id}")
async def delete_empresa(empresa_id: str, user: dict = Depends(require_super_admin)):
    result = await db.empresas.update_one({"id": empresa_id}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(404, "Empresa no encontrada")
    await log_activity(user['id'], user['name'], "delete", "empresa", empresa_id, "Empresa desactivada")
    return {"message": "Empresa desactivada"}

# ═══════════════════════════════════════════════════════════════
# SUPER ADMIN — Gestión de usuarios (todas las empresas)
# ═══════════════════════════════════════════════════════════════

@api_router.get("/superadmin/users")
async def sa_get_all_users(user: dict = Depends(require_super_admin)):
    users = await db.doctors.find({}, {"_id": 0, "password": 0}).to_list(1000)
    # Enriquecer con nombre de empresa
    all_empresas = await db.empresas.find({}, {"_id": 0, "id": 1, "nombre": 1, "slug": 1}).to_list(100)
    empresa_map = {e["id"]: e for e in all_empresas}
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
        eid = u.get("empresa_id")
        u["empresa"] = empresa_map.get(eid) if eid else None
        u["empresas_detalle"] = [
            empresa_map[eid] for eid in (u.get("empresas") or []) if eid in empresa_map
        ]
    return users

@api_router.post("/superadmin/users")
async def sa_create_user(input: CreateUserAdmin, admin: dict = Depends(require_super_admin)):
    if await db.doctors.find_one({"email": input.email}):
        raise HTTPException(400, "Email ya existe")
    empresa = await db.empresas.find_one({"id": input.empresa_id}, {"_id": 0})
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")
    hashed = hash_password(input.password)
    doctor = Doctor(
        email=input.email,
        name=input.name,
        role=input.role,
        empresa_id=input.empresa_id,
        empresas=[input.empresa_id],
        permissions=input.permissions or (
            PERMISOS_DEFAULT_COORDINADOR if input.role == "coordinador"
            else PERMISOS_DEFAULT_DOCTOR if input.role == "doctor"
            else {}
        ),
        status="active"
    )
    doc = doctor.model_dump()
    doc['password'] = hashed
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)
    await log_activity(admin['id'], admin['name'], "create", "user", doctor.id,
                       f"Usuario creado: {input.name} ({input.role}) en {empresa['nombre']}")
    return {k: v for k, v in doc.items() if k not in ['_id', 'password']}

@api_router.put("/superadmin/users/{user_id}/empresa")
async def sa_assign_empresa(user_id: str, body: SwitchEmpresaInput, admin: dict = Depends(require_super_admin)):
    empresa = await db.empresas.find_one({"id": body.empresa_id}, {"_id": 0})
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    # Actualizar el usuario
    await db.doctors.update_one({"id": user_id}, {
        "$set": {"empresa_id": body.empresa_id},
        "$addToSet": {"empresas": body.empresa_id}
    })

    # Migrar TODOS los registros del doctor a la nueva empresa
    migrated = {}
    for col_name in ["patients", "appointments", "consultations", "prescriptions", "files", "activity_logs"]:
        col = db[col_name]
        r = await col.update_many(
            {"doctor_id": user_id},
            {"$set": {"empresa_id": body.empresa_id}}
        )
        if r.modified_count > 0:
            migrated[col_name] = r.modified_count

    await log_activity(admin['id'], admin['name'], "switch", "empresa", user_id,
                       f"Usuario {user_id} migrado a empresa {empresa['nombre']} — {migrated}",
                       body.empresa_id)
    return {"message": f"Empresa asignada. Registros migrados: {migrated}"}

@api_router.put("/superadmin/users/{user_id}/empresas")
async def sa_assign_empresas(user_id: str, body: AssignEmpresasInput, admin: dict = Depends(require_super_admin)):
    empresa_ids = list(dict.fromkeys([eid for eid in body.empresa_ids if eid]))
    target = await db.doctors.find_one({"id": user_id}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if target.get("role") == "super_admin":
        raise HTTPException(400, "Un super admin no requiere empresas asignadas")
    if not empresa_ids:
        raise HTTPException(400, "Seleccioná al menos una empresa")

    count = await db.empresas.count_documents({"id": {"$in": empresa_ids}})
    if count != len(empresa_ids):
        raise HTTPException(404, "Una o más empresas no existen")

    primary_empresa = target.get("empresa_id") if target.get("empresa_id") in empresa_ids else empresa_ids[0]
    await db.doctors.update_one({"id": user_id}, {
        "$set": {"empresa_id": primary_empresa, "empresas": empresa_ids}
    })
    await log_activity(admin['id'], admin['name'], "update", "user", user_id,
                       f"Empresas asignadas a {target['name']}: {len(empresa_ids)}",
                       primary_empresa)
    return {"message": "Empresas asignadas", "empresa_id": primary_empresa, "empresas": empresa_ids}

@api_router.put("/superadmin/users/{user_id}/permissions")
async def sa_set_permissions(user_id: str, input: UpdatePermissionsInput, admin: dict = Depends(require_super_admin)):
    await db.doctors.update_one({"id": user_id}, {"$set": {"permissions": input.permissions}})
    await log_activity(admin['id'], admin['name'], "update", "user", user_id, "Permisos actualizados")
    return {"message": "Permisos actualizados"}

# ═══════════════════════════════════════════════════════════════
# ADMIN — Gestión de usuarios (solo su empresa)
# ═══════════════════════════════════════════════════════════════

@api_router.get("/permisos-disponibles")
async def get_permisos_disponibles(user: dict = Depends(get_current_user_full)):
    """Devuelve el catálogo de módulos y acciones disponibles para configurar permisos."""
    return PERMISOS_DISPONIBLES

@api_router.get("/admin/users")
async def get_all_users(admin: dict = Depends(require_admin_or_super)):
    empresa_filter = get_empresa_filter(admin)
    users = await db.doctors.find(empresa_filter, {"_id": 0, "password": 0}).to_list(1000)
    all_empresas = await db.empresas.find({}, {"_id": 0, "id": 1, "nombre": 1, "slug": 1}).to_list(100)
    empresa_map = {e["id"]: e for e in all_empresas}
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
        eid = u.get("empresa_id")
        u["empresa"] = empresa_map.get(eid) if eid else None
        u["empresas_detalle"] = [
            empresa_map[eid] for eid in (u.get("empresas") or []) if eid in empresa_map
        ]
    return users

@api_router.get("/admin/pending-users")
async def get_pending_users(admin: dict = Depends(require_admin_or_super)):
    empresa_filter = get_empresa_filter(admin)
    query = {**empresa_filter, "status": "pending"}
    users = await db.doctors.find(query, {"_id": 0, "password": 0}).to_list(1000)
    all_empresas = await db.empresas.find({}, {"_id": 0, "id": 1, "nombre": 1, "slug": 1}).to_list(100)
    empresa_map = {e["id"]: e for e in all_empresas}
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
        eid = u.get("empresa_id")
        u["empresa"] = empresa_map.get(eid) if eid else None
        u["empresas_detalle"] = [
            empresa_map[eid] for eid in (u.get("empresas") or []) if eid in empresa_map
        ]
    return users

@api_router.put("/admin/users/{uid}/approve")
async def approve_user(uid: str, admin: dict = Depends(require_admin_or_super)):
    empresa_filter = get_empresa_filter(admin)
    result = await db.doctors.update_one({**empresa_filter, "id": uid}, {"$set": {"status": "active"}})
    if result.matched_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    await log_activity(admin['id'], admin['name'], "approve", "user", uid, "Usuario aprobado",
                       get_user_empresa_id(admin))
    return {"message": "Usuario aprobado"}

@api_router.put("/admin/users/{uid}/reject")
async def reject_user(uid: str, admin: dict = Depends(require_admin_or_super)):
    empresa_filter = get_empresa_filter(admin)
    target = await db.doctors.find_one({**empresa_filter, "id": uid},
                                       {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permisos verticales
    assert_can_manage_target(admin, target, "rechazar")
    result = await db.doctors.update_one({**empresa_filter, "id": uid}, {"$set": {"status": "rejected"}})
    if result.matched_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    await log_activity(admin['id'], admin['name'], "reject", "user", uid, "Usuario rechazado",
                       get_user_empresa_id(admin))
    return {"message": "Usuario rechazado"}

@api_router.put("/admin/users/{uid}/change-password")
async def admin_change_password(uid: str, input: AdminChangePassword, admin: dict = Depends(require_admin_or_super)):
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "name": 1, "permissions": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permitir cambiarse a uno mismo la contraseña pasa por /auth/change-password.
    # Aquí (admin actuando sobre otro) bloqueamos auto-cambio y actuar sobre pares/superiores.
    assert_can_manage_target(admin, target, "cambiar la contraseña de")
    await db.doctors.update_one({"id": uid}, {"$set": {"password": hash_password(input.new_password)}})
    return {"message": "Contraseña actualizada"}

@api_router.put("/admin/users/{uid}")
async def update_user_full(uid: str, input: AdminUserUpdate, admin: dict = Depends(require_admin_or_super)):
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "name": 1, "email": 1, "permissions": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    assert_can_manage_target(admin, target, "modificar")

    data = {}
    if input.name is not None:
        data["name"] = input.name.strip()
    if input.email is not None:
        email = str(input.email).strip().lower()
        existing = await db.doctors.find_one({"email": email, "id": {"$ne": uid}}, {"_id": 0, "id": 1})
        if existing:
            raise HTTPException(400, "Ya existe un usuario con ese email")
        data["email"] = email
    if input.password:
        if len(input.password) < 6:
            raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
        data["password"] = hash_password(input.password)
    if input.specialty is not None:
        data["specialty"] = input.specialty
    if input.license_number is not None:
        data["license_number"] = input.license_number
    if input.role is not None and input.role != target.get("role"):
        valid_roles = ['coordinador', 'doctor']
        if admin.get('role') == 'super_admin':
            valid_roles.extend(['admin', 'super_admin'])
        if input.role not in valid_roles:
            raise HTTPException(400, "Rol inválido")
        assert_can_change_role(admin, target, input.role)
        data["role"] = input.role
        if input.role == "coordinador" and not target.get("permissions"):
            data["permissions"] = PERMISOS_DEFAULT_COORDINADOR
        elif input.role == "doctor" and not target.get("permissions"):
            data["permissions"] = PERMISOS_DEFAULT_DOCTOR
    if input.permissions is not None:
        next_role = data.get("role", target.get("role"))
        if next_role in ["doctor", "coordinador"]:
            data["permissions"] = input.permissions
    if input.empresa_ids is not None:
        if admin.get("role") != "super_admin":
            raise HTTPException(403, "Solo Super Administrador puede asignar múltiples empresas")
        empresa_ids = list(dict.fromkeys([eid for eid in input.empresa_ids if eid]))
        if data.get("role", target.get("role")) != "super_admin" and not empresa_ids:
            raise HTTPException(400, "Seleccioná al menos una empresa")
        if empresa_ids:
            count = await db.empresas.count_documents({"id": {"$in": empresa_ids}})
            if count != len(empresa_ids):
                raise HTTPException(404, "Una o más empresas no existen")
        data["empresas"] = empresa_ids
        data["empresa_id"] = empresa_ids[0] if empresa_ids else None

    if not data:
        raise HTTPException(400, "Sin datos")
    await db.doctors.update_one({"id": uid}, {"$set": data})
    await log_activity(admin['id'], admin['name'], "update", "user", uid, f"Usuario actualizado: {target.get('name')}",
                       get_user_empresa_id(admin))
    return {"message": "Usuario actualizado"}

@api_router.put("/admin/users/{uid}/role")
async def change_role(uid: str, role: str, admin: dict = Depends(require_admin_or_super)):
    valid_roles = ['coordinador', 'doctor']
    if admin.get('role') == 'super_admin':
        valid_roles.extend(['admin', 'super_admin'])
    if role not in valid_roles:
        raise HTTPException(400, "Rol inválido")
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permisos verticales: no auto-cambio de rol y no cambiar a iguales/superiores
    assert_can_change_role(admin, target, role)
    update_data = {"role": role}
    if role == "coordinador" and not target.get("permissions"):
        update_data["permissions"] = PERMISOS_DEFAULT_COORDINADOR
    elif role == "doctor" and not target.get("permissions"):
        update_data["permissions"] = PERMISOS_DEFAULT_DOCTOR
    await db.doctors.update_one({"id": uid}, {"$set": update_data})
    await log_activity(admin['id'], admin['name'], "update", "user", uid, f"Rol cambiado a {role}",
                       get_user_empresa_id(admin))
    return {"message": f"Rol cambiado a {role}"}

@api_router.put("/admin/users/{uid}/permissions")
async def update_permissions(uid: str, input: UpdatePermissionsInput, admin: dict = Depends(require_admin_or_super)):
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permisos verticales: un admin no puede tocar los permisos de otro admin
    # ni los suyos (evita auto-perderse permisos sin querer).
    assert_can_manage_target(admin, target, "modificar los permisos de")
    await db.doctors.update_one({"id": uid}, {"$set": {"permissions": input.permissions}})
    await log_activity(admin['id'], admin['name'], "update", "user", uid, "Permisos actualizados",
                       get_user_empresa_id(admin))
    return {"message": "Permisos actualizados"}

@api_router.post("/admin/users/create")
async def admin_create_user(input: dict, admin: dict = Depends(require_admin_or_super)):
    """Crea un usuario directamente desde el panel de administración (sin esperar aprobación)."""
    email = input.get("email", "").strip().lower()
    password = input.get("password", "")
    name = input.get("name", "").strip()
    role = input.get("role", "doctor")
    empresa_id = input.get("empresa_id") or None

    if not email or not password or not name:
        raise HTTPException(400, "Email, contraseña y nombre son requeridos")
    if len(password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")

    # Validar rol
    valid_roles = ['doctor', 'coordinador']
    if admin.get('role') == 'super_admin':
        valid_roles.extend(['admin', 'super_admin'])
    if role not in valid_roles:
        raise HTTPException(400, f"Rol inválido. Valores posibles: {valid_roles}")

    existing = await db.doctors.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Ya existe un usuario con ese email")

    # Si no se especificó empresa, heredar la del admin que crea
    if not empresa_id and admin.get('role') != 'super_admin':
        empresa_id = get_user_empresa_id(admin)

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": new_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "empresa_id": empresa_id,
        "empresas": [empresa_id] if empresa_id else [],
        "permissions": (
            PERMISOS_DEFAULT_COORDINADOR if role == "coordinador"
            else PERMISOS_DEFAULT_DOCTOR if role == "doctor"
            else {}
        ),
        "status": "active",   # creado directo → activo
        "specialty": input.get("specialty", ""),
        "license_number": input.get("license_number", ""),
        "created_at": now,
        "firma_url": None,
        "logo_url": None,
        "photo_url": None,
    }
    await db.doctors.insert_one(doc)
    await log_activity(admin['id'], admin['name'], "create", "user", new_id,
                       f"Usuario creado por admin: {email} ({role})", get_user_empresa_id(admin))
    return {"id": new_id, "message": "Usuario creado exitosamente"}

@api_router.put("/admin/users/{uid}/toggle-status")
async def toggle_user_status(uid: str, admin: dict = Depends(require_admin_or_super)):
    """Alterna estado del usuario entre 'active' y 'disabled'."""
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "status": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permisos verticales: no se puede deshabilitar a uno mismo ni a un par/superior
    assert_can_manage_target(admin, target, "deshabilitar")
    new_status = "disabled" if target.get("status") == "active" else "active"
    await db.doctors.update_one({"id": uid}, {"$set": {"status": new_status}})
    action_label = "deshabilitado" if new_status == "disabled" else "habilitado"
    await log_activity(admin['id'], admin['name'], "update", "user", uid,
                       f"Usuario {action_label}: {target['name']}", get_user_empresa_id(admin))
    return {"message": f"Usuario {action_label}", "new_status": new_status}

@api_router.delete("/admin/users/{uid}")
async def delete_user(uid: str, admin: dict = Depends(require_admin_or_super)):
    target = await db.doctors.find_one({"id": uid}, {"_id": 0, "id": 1, "role": 1, "name": 1})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Permisos verticales: no auto-eliminación, no eliminar pares/superiores
    assert_can_manage_target(admin, target, "eliminar")
    result = await db.doctors.delete_one({"id": uid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    await log_activity(admin['id'], admin['name'], "delete", "user", uid,
                       f"Usuario eliminado: {target['name'] if target else 'N/A'}",
                       get_user_empresa_id(admin))
    return {"message": "Usuario eliminado"}

@api_router.get("/admin/activity-logs")
async def get_activity_logs(
    admin: dict = Depends(require_admin_or_super),
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0)
):
    empresa_filter = get_empresa_filter(admin)
    query = empresa_filter if empresa_filter else {}
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    # Normalizar campo de fecha para el frontend
    for log in logs:
        if "timestamp" in log and "created_at" not in log:
            log["created_at"] = log["timestamp"]
    return logs

# ═══════════════════════════════════════════════════════════════
# PACIENTES
# ═══════════════════════════════════════════════════════════════

@api_router.post("/patients")
async def create_patient(input: PatientCreate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.crear")
    eid = get_user_empresa_id(user)
    if not eid:
        raise HTTPException(400, "Sin empresa activa")
    patient_dict = input.model_dump()
    # Sanitizar valores vacíos que no deben llegar al modelo como string ""
    for num_field in ("age",):
        if patient_dict.get(num_field) in ("", None):
            patient_dict[num_field] = None
    if patient_dict.get("peso") in ("", None):
        patient_dict["peso"] = None
    patient_dict['doctor_id'] = user['id']
    patient_dict['empresa_id'] = eid
    try:
        patient_obj = Patient(**patient_dict)
    except Exception as e:
        # Convertir errores de validación en 400 (en vez de 500) para que el
        # frontend reciba un mensaje claro y no se quede el spinner girando.
        raise HTTPException(400, f"Datos del paciente inválidos: {e}")
    doc = patient_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    try:
        await db.patients.insert_one(doc)
    except Exception as e:
        logger.exception("[create_patient] insert_one falló")
        raise HTTPException(500, f"No se pudo guardar el paciente: {e}")
    try:
        await log_activity(user['id'], user['name'], "create", "patient", patient_obj.id,
                           f"Paciente creado: {input.name}", eid)
    except Exception:
        # El log de actividad no debe bloquear la creación si falla
        logger.exception("[create_patient] log_activity falló (ignorado)")
    return patient_obj.model_dump()

@api_router.get("/patients")
async def get_patients(
    user: dict = Depends(get_current_user_full),
    doctor_id: Optional[str] = Query(default=None)
):
    require_permission(user, "pacientes.ver")
    empresa_filter = get_empresa_filter(user)
    privileged = is_privileged(user)
    if privileged:
        # Admin/super_admin: puede filtrar por doctor, o ver todos
        query = empresa_filter
        if doctor_id:
            query = {**empresa_filter, "doctor_id": doctor_id}
    else:
        # Doctor normal: depende del modo de la empresa
        # - shared  (clínicas) → ve todos los pacientes de la empresa
        # - private (Arandu)   → sólo sus propios pacientes
        base = await get_patient_filter(user)
        if doctor_id:
            query = {**base, "doctor_id": doctor_id}
        else:
            query = base
    patients = await db.patients.find(query, {"_id": 0}).to_list(1000)
    if privileged:
        dc = {}
        for p in patients:
            did = p.get('doctor_id', '')
            if did not in dc:
                dc[did] = await get_doctor_name(did)
            p['doctor_name'] = dc[did]
    for p in patients:
        fix_datetime(p, ['created_at', 'updated_at'])
    return patients

@api_router.get("/patients/search")
async def search_patients(q: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.ver")
    base = await get_patient_filter(user)
    query = {**base, "$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"cedula": {"$regex": q, "$options": "i"}}
    ]}
    patients = await db.patients.find(query, {"_id": 0}).to_list(100)
    for p in patients:
        fix_datetime(p, ['created_at', 'updated_at'])
    return patients

@api_router.get("/patients/advanced-search")
async def advanced_search(q: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.ver")
    base = await get_patient_filter(user)
    cons_q = {**base, "$or": [
        {"diagnosis": {"$regex": q, "$options": "i"}},
        {"treatment": {"$regex": q, "$options": "i"}},
        {"notes": {"$regex": q, "$options": "i"}}
    ]}
    matching = await db.consultations.find(cons_q, {"_id": 0, "patient_id": 1}).to_list(1000)
    ids_from_cons = list(set(c['patient_id'] for c in matching))
    pat_q = {**base, "$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"cedula": {"$regex": q, "$options": "i"}},
        {"medical_history": {"$regex": q, "$options": "i"}}
    ]}
    direct = await db.patients.find(pat_q, {"_id": 0}).to_list(1000)
    direct_ids = set(p['id'] for p in direct)
    extra_ids = [pid for pid in ids_from_cons if pid not in direct_ids]
    extra = await db.patients.find({"id": {"$in": extra_ids}}, {"_id": 0}).to_list(1000) if extra_ids else []
    all_patients = direct + extra
    for p in all_patients:
        fix_datetime(p, ['created_at', 'updated_at'])
    return all_patients

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.ver")
    base = await get_patient_filter(user)
    patient = await db.patients.find_one({**base, "id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    fix_datetime(patient, ['created_at', 'updated_at'])
    return patient

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, input: PatientUpdate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.editar")
    base = await get_patient_filter(user)
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.patients.update_one({**base, "id": patient_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Paciente no encontrado")
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    fix_datetime(patient, ['created_at', 'updated_at'])
    await log_activity(user['id'], user['name'], "update", "patient", patient_id,
                       f"Paciente actualizado: {patient['name']}", get_user_empresa_id(user))
    return patient

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.eliminar")
    empresa_filter = get_empresa_filter(user)
    base = empresa_filter if is_privileged(user) else {**empresa_filter, "doctor_id": user['id']}
    patient = await db.patients.find_one({**base, "id": patient_id}, {"_id": 0, "name": 1})
    result = await db.patients.delete_one({**base, "id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Paciente no encontrado")
    await log_activity(user['id'], user['name'], "delete", "patient", patient_id,
                       f"Paciente eliminado: {patient['name'] if patient else 'N/A'}",
                       get_user_empresa_id(user))
    return {"message": "Paciente eliminado"}

# ═══════════════════════════════════════════════════════════════
# HISTORIAL MÉDICO / ESTADO ACTUAL
# ═══════════════════════════════════════════════════════════════

@api_router.get("/patients/{patient_id}/medical-history")
async def get_medical_history(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "historia_clinica.ver")
    # Mismo criterio que para ver al paciente: si la empresa es shared todos los
    # usuarios ven el historial; si es private (Arandu) sólo el doctor dueño.
    base = await get_patient_filter(user)
    entries = await db.medical_history_entries.find(
        {**base, "patient_id": patient_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    if not entries:
        patient = await db.patients.find_one({**base, "id": patient_id}, {"_id": 0})
        if patient and patient.get('medical_history', '').strip():
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            eid = get_user_empresa_id(user)
            for line in [l.strip() for l in patient['medical_history'].split('\n') if l.strip()]:
                doc = {"id": str(uuid.uuid4()), "patient_id": patient_id,
                       "doctor_id": user['id'], "empresa_id": eid,
                       "category": "otro", "description": line,
                       "date": today, "created_at": datetime.now(timezone.utc).isoformat()}
                await db.medical_history_entries.insert_one(doc)
            entries = await db.medical_history_entries.find(
                {**base, "patient_id": patient_id}, {"_id": 0}
            ).sort("created_at", -1).to_list(1000)
    for e in entries:
        if isinstance(e.get('created_at'), datetime):
            e['created_at'] = e['created_at'].isoformat()
    return entries

@api_router.post("/patients/{patient_id}/medical-history")
async def create_history_entry(patient_id: str, input: MedicalHistoryEntryCreate,
                               user: dict = Depends(get_current_user_full)):
    require_permission(user, "historia_clinica.crear")
    eid = get_user_empresa_id(user)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    doc = {"id": str(uuid.uuid4()), "patient_id": patient_id, "doctor_id": user['id'],
           "empresa_id": eid, "category": input.category, "description": input.description,
           "date": input.date or today, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.medical_history_entries.insert_one(doc)
    await log_activity(user['id'], user['name'], "create", "medical_history", patient_id,
                       f"Antecedente agregado: {input.description[:60]}", eid)
    return {k: v for k, v in doc.items() if k != '_id'}

@api_router.put("/medical-history-entries/{entry_id}")
async def update_history_entry(entry_id: str, input: MedicalHistoryEntryUpdate,
                               user: dict = Depends(get_current_user_full)):
    require_permission(user, "historia_clinica.editar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "Sin datos")
    result = await db.medical_history_entries.update_one({**base, "id": entry_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Entrada no encontrada")
    return {"message": "Antecedente actualizado"}

@api_router.delete("/medical-history-entries/{entry_id}")
async def delete_history_entry(entry_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "historia_clinica.eliminar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    result = await db.medical_history_entries.delete_one({**base, "id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Entrada no encontrada")
    return {"message": "Antecedente eliminado"}

# ═══════════════════════════════════════════════════════════════
# CITAS / AGENDA
# ═══════════════════════════════════════════════════════════════

@api_router.post("/appointments")
async def create_appointment(input: AppointmentCreate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "citas.crear")
    eid = get_user_empresa_id(user)
    appt = Appointment(
        empresa_id=eid,
        patient_id=input.patient_id,
        doctor_id=user['id'],
        date=datetime.fromisoformat(input.date),
        reason=input.reason,
        notes=input.notes
    )
    doc = appt.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.appointments.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(user['id'], user['name'], "create", "appointment", appt.id,
                       f"Cita creada para {patient['name'] if patient else 'N/A'}", eid)
    result = appt.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/appointments")
async def get_appointments(user: dict = Depends(get_current_user_full)):
    require_permission(user, "citas.ver")
    empresa_filter = get_empresa_filter(user)
    query = empresa_filter if is_privileged(user) else {**empresa_filter, "doctor_id": user['id']}
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    if is_privileged(user):
        dc = {}
        for a in appointments:
            did = a.get('doctor_id', '')
            if did not in dc:
                dc[did] = await get_doctor_name(did)
            a['doctor_name'] = dc[did]
    for a in appointments:
        fix_datetime(a, ['date', 'created_at'])
    return appointments

@api_router.get("/patients/{patient_id}/appointments")
async def get_patient_appointments(patient_id: str, user: dict = Depends(get_current_user_full)):
    # Si el usuario puede ver al paciente debería ver sus citas asociadas.
    base = await get_patient_filter(user)
    appts = await db.appointments.find({**base, "patient_id": patient_id}, {"_id": 0}).to_list(1000)
    for a in appts:
        fix_datetime(a, ['date', 'created_at'])
    return appts

@api_router.put("/appointments/{aid}")
async def update_appointment(aid: str, input: AppointmentUpdate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "citas.editar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    if 'date' in data:
        data['date'] = datetime.fromisoformat(data['date']).isoformat()
    result = await db.appointments.update_one({**base, "id": aid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    await log_activity(user['id'], user['name'], "update", "appointment", aid, "Cita actualizada",
                       get_user_empresa_id(user))
    return {"message": "Cita actualizada"}

@api_router.delete("/appointments/{aid}")
async def delete_appointment(aid: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "citas.eliminar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    result = await db.appointments.delete_one({**base, "id": aid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    await log_activity(user['id'], user['name'], "delete", "appointment", aid, "Cita eliminada",
                       get_user_empresa_id(user))
    return {"message": "Cita eliminada"}

@api_router.get("/appointments/upcoming-reminders")
async def upcoming_reminders(user: dict = Depends(get_current_user_full)):
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    day_after = now + timedelta(days=2)
    empresa_filter = get_empresa_filter(user)
    query = {**empresa_filter, "doctor_id": user['id'], "status": "scheduled",
             "date": {"$gte": tomorrow.isoformat(), "$lt": day_after.isoformat()}}
    appts = await db.appointments.find(query, {"_id": 0}).to_list(100)
    for a in appts:
        fix_datetime(a, ['date', 'created_at'])
        patient = await db.patients.find_one({"id": a['patient_id']}, {"_id": 0})
        if patient:
            a['patient_name'] = patient['name']
            a['patient_phone'] = patient.get('phone', '')
    return appts

# ═══════════════════════════════════════════════════════════════
# CONSULTAS
# ═══════════════════════════════════════════════════════════════

@api_router.post("/consultations")
async def create_consultation(input: ConsultationCreate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "consultas.crear")
    eid = get_user_empresa_id(user)
    cons = Consultation(empresa_id=eid, patient_id=input.patient_id, doctor_id=user['id'],
                        date=datetime.now(timezone.utc), diagnosis=input.diagnosis,
                        treatment=input.treatment, notes=input.notes)
    doc = cons.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.consultations.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(user['id'], user['name'], "create", "consultation", cons.id,
                       f"Consulta creada para {patient['name'] if patient else 'N/A'}", eid)
    result = cons.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/patients/{patient_id}/consultations")
async def get_patient_consultations(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "consultas.ver")
    # Mismo criterio de visibilidad que el paciente.
    base = await get_patient_filter(user)
    consultations = await db.consultations.find({**base, "patient_id": patient_id}, {"_id": 0}).to_list(1000)
    for c in consultations:
        fix_datetime(c, ['date', 'created_at'])
    return consultations

@api_router.put("/consultations/{cid}")
async def update_consultation(cid: str, input: ConsultationUpdate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "consultas.editar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    result = await db.consultations.update_one({**base, "id": cid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Consulta no encontrada")
    await log_activity(user['id'], user['name'], "update", "consultation", cid, "Consulta actualizada",
                       get_user_empresa_id(user))
    return {"message": "Consulta actualizada"}

@api_router.delete("/consultations/{cid}")
async def delete_consultation(cid: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "consultas.eliminar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    result = await db.consultations.delete_one({**base, "id": cid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Consulta no encontrada")
    await log_activity(user['id'], user['name'], "delete", "consultation", cid, "Consulta eliminada",
                       get_user_empresa_id(user))
    return {"message": "Consulta eliminada"}

# ═══════════════════════════════════════════════════════════════
# ARCHIVOS
# ═══════════════════════════════════════════════════════════════

@api_router.post("/patients/{patient_id}/upload-file")
async def upload_patient_file(patient_id: str, file: UploadFile = File(...),
                               user: dict = Depends(get_current_user_full)):
    require_permission(user, "archivos.subir")
    eid = get_user_empresa_id(user)
    base = await get_patient_filter(user)
    patient = await db.patients.find_one({**base, "id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    contents = await file.read()
    file_data = base64.b64encode(contents).decode()
    file_obj = FileUpload(empresa_id=eid, patient_id=patient_id, doctor_id=user['id'],
                          file_name=file.filename,
                          file_url=f"data:{file.content_type};base64,{file_data}",
                          file_type=file.content_type)
    doc = file_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.files.insert_one(doc)
    await log_activity(user['id'], user['name'], "create", "file", file_obj.id,
                       f"Archivo subido: {file.filename}", eid)
    return file_obj

@api_router.get("/patients/{patient_id}/files")
async def get_patient_files(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "archivos.ver")
    base = await get_patient_filter(user)
    files = await db.files.find({**base, "patient_id": patient_id}, {"_id": 0}).to_list(1000)
    for f in files:
        fix_datetime(f, ['created_at'])
    return files

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "archivos.eliminar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    result = await db.files.delete_one({**base, "id": file_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Archivo no encontrado")
    return {"message": "Archivo eliminado"}

# ═══════════════════════════════════════════════════════════════
# INDICACIONES / PRESCRIPCIONES
# ═══════════════════════════════════════════════════════════════

@api_router.post("/prescriptions")
async def create_prescription(input: PrescriptionCreate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "recetas.crear")
    eid = get_user_empresa_id(user)
    pres = Prescription(empresa_id=eid, patient_id=input.patient_id, doctor_id=user['id'],
                        date=datetime.now(timezone.utc), medications=input.medications,
                        instructions=input.instructions, diagnosis=input.diagnosis)
    doc = pres.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.prescriptions.insert_one(doc)
    patient = await db.patients.find_one({"id": input.patient_id}, {"_id": 0, "name": 1})
    await log_activity(user['id'], user['name'], "create", "prescription", pres.id,
                       f"Indicación creada para {patient['name'] if patient else 'N/A'}", eid)
    result = pres.model_dump()
    result['date'] = result['date'].isoformat()
    result['created_at'] = result['created_at'].isoformat()
    return result

@api_router.get("/patients/{patient_id}/prescriptions")
async def get_patient_prescriptions(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "recetas.ver")
    base = await get_patient_filter(user)
    prescriptions = await db.prescriptions.find({**base, "patient_id": patient_id}, {"_id": 0}).to_list(1000)
    for p in prescriptions:
        fix_datetime(p, ['date', 'created_at'])
    return prescriptions

@api_router.put("/prescriptions/{pid}")
async def update_prescription(pid: str, input: PrescriptionUpdate, user: dict = Depends(get_current_user_full)):
    require_permission(user, "recetas.editar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    data = {k: v for k, v in input.model_dump().items() if v is not None}
    result = await db.prescriptions.update_one({**base, "id": pid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Indicación no encontrada")
    await log_activity(user['id'], user['name'], "update", "prescription", pid, "Indicación actualizada",
                       get_user_empresa_id(user))
    return {"message": "Indicación actualizada"}

@api_router.delete("/prescriptions/{pid}")
async def delete_prescription(pid: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "recetas.eliminar")
    base = {} if is_privileged(user) else {"doctor_id": user['id']}
    result = await db.prescriptions.delete_one({**base, "id": pid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Indicación no encontrada")
    await log_activity(user['id'], user['name'], "delete", "prescription", pid, "Indicación eliminada",
                       get_user_empresa_id(user))
    return {"message": "Indicación eliminada"}

# ═══════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user_full)):
    empresa_filter = get_empresa_filter(user)
    doc_filter = empresa_filter if is_privileged(user) else {**empresa_filter, "doctor_id": user['id']}
    total_patients = await db.patients.count_documents(doc_filter)
    active_treatments = await db.patients.count_documents({**doc_filter, "status": "active"})
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    appt_filter = {**doc_filter, "date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}
    appointments_today = await db.appointments.count_documents(appt_filter)
    pending_appointments = await db.appointments.count_documents({**doc_filter, "status": "scheduled"})
    return DashboardStats(total_patients=total_patients, appointments_today=appointments_today,
                          active_treatments=active_treatments, pending_appointments=pending_appointments)

@api_router.get("/dashboard/advanced-stats")
async def advanced_stats(user: dict = Depends(get_current_user_full)):
    require_permission(user, "estadisticas.ver")
    from collections import Counter
    empresa_filter = get_empresa_filter(user)
    doc_filter = empresa_filter if is_privileged(user) else {**empresa_filter, "doctor_id": user['id']}
    total_patients = await db.patients.count_documents(doc_filter)
    all_appointments = await db.appointments.find(doc_filter, {"_id": 0}).to_list(10000)
    all_consultations = await db.consultations.find(doc_filter, {"_id": 0}).to_list(10000)
    all_patients = await db.patients.find(doc_filter, {"_id": 0}).to_list(10000)
    def by_month(records, field='date'):
        d = {}
        for r in records:
            try:
                dt = datetime.fromisoformat(r[field]) if isinstance(r[field], str) else r[field]
                k = dt.strftime('%Y-%m')
                d[k] = d.get(k, 0) + 1
            except:
                pass
        return d
    appts_m = by_month(all_appointments)
    cons_m = by_month(all_consultations)
    pat_m = by_month(all_patients, 'created_at')
    diagnoses = Counter([c['diagnosis'] for c in all_consultations])
    sorted_months = sorted(set(list(appts_m) + list(cons_m) + list(pat_m)))[-6:]
    return {
        "total_patients": total_patients,
        "appointments_by_month": [{"month": m, "count": appts_m.get(m, 0)} for m in sorted_months],
        "consultations_by_month": [{"month": m, "count": cons_m.get(m, 0)} for m in sorted_months],
        "top_diagnoses": [{"name": d, "count": c} for d, c in diagnoses.most_common(5)],
        "patient_growth": [{"month": m, "count": pat_m.get(m, 0)} for m in sorted_months],
    }

# ═══════════════════════════════════════════════════════════════
# NOTIFICACIONES
# ═══════════════════════════════════════════════════════════════

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user_full)):
    eid = get_user_empresa_id(user)
    query = {
        "empresa_id": eid,
        "$or": [{"doctor_id": user['id']}, {"doctor_id": None}]
    }
    notifs = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifs

@api_router.post("/notifications/mark-read/{notif_id}")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user_full)):
    await db.notifications.update_one({"id": notif_id}, {"$set": {"read": True}})
    return {"message": "Marcado como leído"}

@api_router.post("/notifications")
async def create_notification(input: NotificationCreate, admin: dict = Depends(require_admin_or_super)):
    eid = get_user_empresa_id(admin)
    notif = Notification(empresa_id=eid, doctor_id=input.doctor_id,
                         title=input.title, message=input.message, type=input.type)
    doc = notif.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}

# ═══════════════════════════════════════════════════════════════
# PDF — Historial del Paciente (por empresa)
# ═══════════════════════════════════════════════════════════════

def hex_to_rgb_color(hex_color: str):
    hex_color = hex_color.lstrip('#')
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return colors.Color(r/255, g/255, b/255)

@api_router.get("/patients/{patient_id}/export-pdf")
async def export_patient_pdf(patient_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "pacientes.exportar_pdf")
    base = await get_patient_filter(user)
    patient = await db.patients.find_one({**base, "id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    eid = get_user_empresa_id(user)
    emp = await get_empresa_config(eid)

    consultations = await db.consultations.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    appointments = await db.appointments.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)

    primary_clr = hex_to_rgb_color(emp.get('primary_color', '#D97757'))
    secondary_clr = hex_to_rgb_color(emp.get('secondary_color', '#4B7F52'))

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=22, textColor=primary_clr, spaceAfter=10)
    heading_style = ParagraphStyle('H', parent=styles['Heading2'], fontSize=14, textColor=secondary_clr, spaceAfter=8, spaceBefore=10)

    # Logo empresa
    if emp.get('logo_url'):
        logo_path = str(ROOT_DIR) + emp['logo_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(logo_path):
            try:
                img = Image(logo_path, width=2.2*inch, height=1*inch)
                img.hAlign = 'LEFT'
                story.append(img)
                story.append(Spacer(1, 0.15*inch))
            except:
                pass

    story.append(Paragraph(emp.get('nombre', 'Clínica'), title_style))
    story.append(Paragraph("Historial Clínico del Paciente", styles['Heading2']))
    story.append(Spacer(1, 0.3*inch))

    patient_data = [
        ['Nombre:', patient['name']],
        ['Edad:', f"{patient['age']} años"],
        ['Cédula:', patient['cedula']],
        ['Teléfono:', patient['phone']],
        ['Domicilio:', patient['address']],
        ['Ocupación:', patient['occupation']],
    ]
    if patient.get('sexo'):
        patient_data.append(['Sexo:', patient['sexo']])
    if patient.get('peso'):
        patient_data.append(['Peso:', f"{patient['peso']} kg"])
    if patient.get('fecha_nacimiento'):
        patient_data.append(['Fecha de Nacimiento:', patient['fecha_nacimiento']])
    if patient.get('estado_civil'):
        patient_data.append(['Estado Civil:', patient['estado_civil']])
    if patient.get('contacto_emergencia'):
        patient_data.append(['Contacto Emergencia:', patient['contacto_emergencia']])
    if patient.get('insurance_name'):
        patient_data.append(['Seguro:', patient['insurance_name']])

    pt = Table(patient_data, colWidths=[2*inch, 4*inch])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F2EB')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E0D6'))
    ]))
    story.append(pt)
    story.append(Spacer(1, 0.25*inch))
    story.append(Paragraph("Estado Actual y Antecedentes", heading_style))
    story.append(Paragraph(patient.get('medical_history', ''), styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    if consultations:
        story.append(Paragraph(f"Consultas Realizadas ({len(consultations)})", heading_style))
        for c in consultations:
            try:
                d = datetime.fromisoformat(c['date']) if isinstance(c['date'], str) else c['date']
                story.append(Paragraph(f"<b>Fecha:</b> {d.strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
            except:
                pass
            story.append(Paragraph(f"<b>Diagnóstico:</b> {c['diagnosis']}", styles['Normal']))
            story.append(Paragraph(f"<b>Tratamiento:</b> {c['treatment']}", styles['Normal']))
            story.append(Paragraph(f"<b>Notas:</b> {c['notes']}", styles['Normal']))
            story.append(Spacer(1, 0.15*inch))

    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Italic']))
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=historial_{patient['name'].replace(' ', '_')}.pdf"})

# ═══════════════════════════════════════════════════════════════
# PDF — Indicaciones / Receta (por empresa)
# ═══════════════════════════════════════════════════════════════

@api_router.get("/prescriptions/{prescription_id}/pdf")
async def export_prescription_pdf(prescription_id: str, user: dict = Depends(get_current_user_full)):
    require_permission(user, "recetas.ver")
    base = await get_patient_filter(user)
    prescription = await db.prescriptions.find_one({**base, "id": prescription_id}, {"_id": 0})
    if not prescription:
        raise HTTPException(404, "Indicación no encontrada")
    patient = await db.patients.find_one({"id": prescription['patient_id']}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")

    prescribing_doctor = await db.doctors.find_one({"id": prescription['doctor_id']},
                                                   {"_id": 0, "password": 0})
    if not prescribing_doctor:
        prescribing_doctor = {"name": "Desconocido"}

    eid = get_user_empresa_id(user)
    emp = await get_empresa_config(eid)
    primary_clr = hex_to_rgb_color(emp.get('primary_color', '#D97757'))
    secondary_clr = hex_to_rgb_color(emp.get('secondary_color', '#4B7F52'))
    prof_label = emp.get('profesional_label', 'Doctor')
    ind_label = emp.get('indicaciones_label', 'Indicaciones')

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=26, textColor=primary_clr,
                                 spaceAfter=8, alignment=1)
    subtitle_style = ParagraphStyle('S', parent=styles['Normal'], fontSize=12, textColor=secondary_clr,
                                    spaceAfter=20, alignment=1)
    heading_style = ParagraphStyle('H', parent=styles['Heading2'], fontSize=13, textColor=secondary_clr,
                                   spaceAfter=6, spaceBefore=10)

    # Logo empresa
    if emp.get('logo_url'):
        logo_path = str(ROOT_DIR) + emp['logo_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(logo_path):
            try:
                img = Image(logo_path, width=2.5*inch, height=1.2*inch)
                img.hAlign = 'CENTER'
                story.append(img)
                story.append(Spacer(1, 0.1*inch))
            except:
                pass

    story.append(Paragraph(emp.get('nombre', 'Clínica'), title_style))
    story.append(Paragraph(ind_label, subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_clr))
    story.append(Spacer(1, 0.2*inch))

    try:
        date_str = datetime.fromisoformat(prescription['date']) if isinstance(prescription['date'], str) else prescription['date']
        story.append(Paragraph(f"<b>Fecha:</b> {date_str.strftime('%d/%m/%Y')}", styles['Normal']))
    except:
        pass
    story.append(Spacer(1, 0.15*inch))

    pt = Table([
        ['Paciente:', patient['name']],
        ['Edad:', f"{patient['age']} años"],
        ['Cédula:', patient['cedula']],
    ], colWidths=[1.5*inch, 4*inch])
    pt.setStyle(TableStyle([('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                             ('FONTSIZE', (0, 0), (-1, -1), 11),
                             ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
    story.append(pt)
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("Diagnóstico", heading_style))
    story.append(Paragraph(prescription['diagnosis'], styles['Normal']))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("Medicamentos / Tratamiento", heading_style))
    story.append(Paragraph(prescription['medications'], styles['Normal']))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(ind_label, heading_style))
    story.append(Paragraph(prescription['instructions'], styles['Normal']))
    story.append(Spacer(1, 0.5*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CCCCCC')))
    story.append(Spacer(1, 0.3*inch))

    # Firma digital
    if prescribing_doctor.get('firma_url'):
        firma_path = str(ROOT_DIR) + prescribing_doctor['firma_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(firma_path):
            try:
                firma_img = Image(firma_path, width=1.5*inch, height=0.8*inch)
                firma_img.hAlign = 'LEFT'
                story.append(firma_img)
            except:
                pass

    story.append(Paragraph("_" * 45, styles['Normal']))
    story.append(Paragraph(f"{prof_label}: {prescribing_doctor['name']}", styles['Normal']))
    if prescribing_doctor.get('specialty'):
        story.append(Paragraph(prescribing_doctor['specialty'], styles['Normal']))
    ci_text = prescribing_doctor.get('ci_ruc', '')
    if prescribing_doctor.get('ci_dv'):
        ci_text += f"-{prescribing_doctor['ci_dv']}"
    if ci_text:
        story.append(Paragraph(f"CI/RUC: {ci_text}", styles['Normal']))
    if prescribing_doctor.get('license_number'):
        story.append(Paragraph(f"Mat. {prescribing_doctor['license_number']}", styles['Normal']))

    doc.build(story)
    buffer.seek(0)
    try:
        fname = f"indicacion_{patient['name'].replace(' ', '_')}_{date_str.strftime('%Y%m%d')}.pdf"
    except:
        fname = "indicacion.pdf"
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"})

# ═══════════════════════════════════════════════════════════════
# PDF — Certificado Fisioterapéutico (Equilibrio)
# ═══════════════════════════════════════════════════════════════

@api_router.get("/prescriptions/{prescription_id}/certificado-pdf")
async def export_certificado_pdf(prescription_id: str, user: dict = Depends(get_current_user_full)):
    """Genera un Certificado Fisioterapéutico elegante con firma digital para Equilibrio."""
    base = await get_patient_filter(user)
    prescription = await db.prescriptions.find_one({**base, "id": prescription_id}, {"_id": 0})
    if not prescription:
        raise HTTPException(404, "Indicación no encontrada")
    patient = await db.patients.find_one({"id": prescription['patient_id']}, {"_id": 0})
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    doctor = await db.doctors.find_one({"id": prescription['doctor_id']}, {"_id": 0, "password": 0})
    if not doctor:
        doctor = {"name": "Desconocido"}

    eid = get_user_empresa_id(user)
    emp = await get_empresa_config(eid)

    # Colores de Equilibrio (o los que tenga la empresa)
    primary_hex   = emp.get('primary_color', '#D4238A')
    secondary_hex = emp.get('secondary_color', '#79B82C')
    primary_clr   = hex_to_rgb_color(primary_hex)
    secondary_clr = hex_to_rgb_color(secondary_hex)
    prof_label    = emp.get('profesional_label', 'Fisioterapeuta')
    ind_label     = emp.get('indicaciones_label', 'Indicaciones')
    empresa_nombre = emp.get('nombre', 'Clínica')

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                             rightMargin=60, leftMargin=60, topMargin=50, bottomMargin=60)
    story = []
    styles = getSampleStyleSheet()

    # ── Estilos personalizados ──
    style_center = ParagraphStyle('center', alignment=1, spaceAfter=6)
    style_title  = ParagraphStyle('title',  parent=styles['Heading1'],
                                  fontSize=22, textColor=primary_clr, alignment=1, spaceAfter=4)
    style_sub    = ParagraphStyle('sub',    parent=styles['Normal'],
                                  fontSize=11, textColor=secondary_clr, alignment=1, spaceAfter=16)
    style_body   = ParagraphStyle('body',   parent=styles['Normal'], fontSize=11, spaceAfter=6, leading=16)
    style_label  = ParagraphStyle('label',  parent=styles['Normal'], fontSize=9,
                                  textColor=colors.HexColor('#666666'), spaceAfter=1)
    style_value  = ParagraphStyle('value',  parent=styles['Normal'], fontSize=11, spaceAfter=8, leading=14)
    style_sign   = ParagraphStyle('sign',   parent=styles['Normal'], fontSize=10,
                                  textColor=colors.HexColor('#444444'), alignment=1, spaceAfter=2)

    # ── Encabezado con logo ──
    if emp.get('logo_url'):
        logo_path = str(ROOT_DIR) + emp['logo_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(logo_path):
            try:
                img = Image(logo_path, width=2.8*inch, height=1.3*inch)
                img.hAlign = 'CENTER'
                story.append(img)
                story.append(Spacer(1, 0.08*inch))
            except:
                story.append(Paragraph(empresa_nombre, style_title))
    else:
        story.append(Paragraph(empresa_nombre, style_title))

    story.append(HRFlowable(width="100%", thickness=2.5, color=primary_clr))
    story.append(Spacer(1, 0.05*inch))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_clr))
    story.append(Spacer(1, 0.15*inch))

    # Título del documento
    story.append(Paragraph(f"CERTIFICADO FISIOTERAPÉUTICO", style_title))
    story.append(Paragraph(ind_label.upper(), style_sub))

    # Fecha
    try:
        date_obj = datetime.fromisoformat(prescription['date']) if isinstance(prescription['date'], str) else prescription['date']
        fecha_str = date_obj.strftime('%d de %B de %Y').lower().capitalize()
    except:
        fecha_str = ""
    if fecha_str:
        story.append(Paragraph(f"Asunción, {fecha_str}", style_body))
    story.append(Spacer(1, 0.15*inch))

    # ── Datos del paciente en tabla elegante ──
    ci_paciente = patient.get('cedula', '')
    if patient.get('ci_ruc'):
        ci_paciente = patient['ci_ruc']
        if patient.get('ci_dv'):
            ci_paciente += f"-{patient['ci_dv']}"

    patient_rows = [
        ['Paciente', patient['name']],
    ]
    if patient.get('age'):
        patient_rows.append(['Edad', f"{patient['age']} años"])
    if ci_paciente:
        patient_rows.append(['CI/RUC', ci_paciente])
    if patient.get('phone'):
        patient_rows.append(['Teléfono', patient['phone']])
    if patient.get('fecha_nacimiento') or patient.get('date_of_birth'):
        dob = patient.get('fecha_nacimiento') or patient.get('date_of_birth', '')
        patient_rows.append(['F. Nacimiento', formatDate_py(dob)])
    if labels_extended := (patient.get('sexo') or patient.get('estado_civil')):
        sexo_ec = ' / '.join(filter(None, [patient.get('sexo','').capitalize(), patient.get('estado_civil','').replace('_',' ').capitalize()]))
        if sexo_ec:
            patient_rows.append(['Sexo / E. Civil', sexo_ec])

    pt = Table(patient_rows, colWidths=[1.6*inch, 4.5*inch])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8F8F8')),
        ('FONTNAME',   (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME',   (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE',   (0, 0), (-1, -1), 10),
        ('TEXTCOLOR',  (0, 0), (0, -1), primary_clr),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#DDDDDD')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#FAFAFA')]),
    ]))
    story.append(pt)
    story.append(Spacer(1, 0.2*inch))

    # ── Diagnóstico ──
    if prescription.get('diagnosis'):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#EEEEEE')))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph("DIAGNÓSTICO / MOTIVO DE CONSULTA", style_label))
        story.append(Paragraph(prescription['diagnosis'], style_value))

    # ── Indicaciones / Tratamiento ──
    if prescription.get('medications'):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#EEEEEE')))
        story.append(Spacer(1, 0.08*inch))
        title_meds = "PLAN DE EJERCICIOS / INDICACIONES" if prof_label == 'Fisioterapeuta' else "MEDICAMENTOS / TRATAMIENTO"
        story.append(Paragraph(title_meds, style_label))
        for line in prescription['medications'].split('\n'):
            if line.strip():
                story.append(Paragraph(line.strip(), style_value))

    # ── Instrucciones adicionales ──
    if prescription.get('instructions'):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#EEEEEE')))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph("INSTRUCCIONES ADICIONALES", style_label))
        story.append(Paragraph(prescription['instructions'], style_value))

    story.append(Spacer(1, 0.4*inch))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_clr))
    story.append(Spacer(1, 0.3*inch))

    # ── Firma del profesional ──
    firma_shown = False
    if doctor.get('firma_url'):
        firma_path = str(ROOT_DIR) + doctor['firma_url'].replace('/api/uploads', '/uploads')
        if os.path.exists(firma_path):
            try:
                firma_img = Image(firma_path, width=1.8*inch, height=0.9*inch)
                firma_img.hAlign = 'CENTER'
                story.append(firma_img)
                firma_shown = True
            except:
                pass

    if not firma_shown:
        story.append(Spacer(1, 0.6*inch))

    story.append(HRFlowable(width=3*inch, thickness=0.8, color=colors.HexColor('#AAAAAA'),
                             hAlign='CENTER'))
    story.append(Spacer(1, 0.06*inch))
    story.append(Paragraph(doctor['name'], style_sign))
    story.append(Paragraph(prof_label, ParagraphStyle('ps', parent=style_sign, textColor=primary_clr, fontSize=9)))

    ci_doc = doctor.get('ci_ruc', '')
    if doctor.get('ci_dv'):
        ci_doc += f"-{doctor['ci_dv']}"
    if ci_doc:
        story.append(Paragraph(f"CI/RUC: {ci_doc}", style_sign))
    if doctor.get('specialty'):
        story.append(Paragraph(doctor['specialty'], style_sign))
    if doctor.get('license_number'):
        story.append(Paragraph(f"Matrícula: {doctor['license_number']}", style_sign))

    # Pie de página
    story.append(Spacer(1, 0.4*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#EEEEEE')))
    story.append(Paragraph(
        f"{empresa_nombre}  |  Documento generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        ParagraphStyle('footer', parent=styles['Normal'], fontSize=8,
                       textColor=colors.HexColor('#999999'), alignment=1)
    ))

    doc.build(story)
    buffer.seek(0)
    try:
        fname = f"certificado_{patient['name'].replace(' ', '_')}.pdf"
    except:
        fname = "certificado.pdf"
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"})


def formatDate_py(dateStr):
    """Helper para formatear fecha en PDF."""
    if not dateStr:
        return ""
    try:
        s = str(dateStr).split('T')[0]
        if len(s) == 10:
            y, m, d = s.split('-')
            return f"{d}/{m}/{y}"
    except:
        pass
    return str(dateStr)


# ═══════════════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════════════

app.include_router(api_router)

app.add_middleware(CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"])

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
