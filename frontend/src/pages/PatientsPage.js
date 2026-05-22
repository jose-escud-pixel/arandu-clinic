import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Users, Plus, Search, X, ChevronRight, Phone,
  Shield, Briefcase, Filter, UserCheck
} from 'lucide-react';

/* ─── Modal Nuevo / Editar Paciente ───────────────────── */
const PatientModal = ({ patient, onClose, onSaved, labels }) => {
  const isEdit = !!patient;
  const [form, setForm] = useState({
    name:              patient?.name || '',
    age:               patient?.age  || '',
    cedula:            patient?.cedula || '',
    ci_ruc:            patient?.ci_ruc || '',
    ci_dv:             patient?.ci_dv || '',
    nationality:       patient?.nationality || '',
    address:           patient?.address || '',
    occupation:        patient?.occupation || '',
    phone:             patient?.phone || '',
    insurance_name:    patient?.insurance_name || '',
    insurance_number:  patient?.insurance_number || '',
    medical_history:   patient?.medical_history || '',
    current_status:    patient?.current_status || '',
    status:            patient?.status || 'active',
    // Campos extendidos (Equilibrio)
    sexo:                  patient?.sexo || '',
    peso:                  patient?.peso || '',
    estado_civil:          patient?.estado_civil || '',
    contacto_emergencia:   patient?.contacto_emergencia || '',
    fecha_nacimiento:      patient?.fecha_nacimiento || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const showExtended = labels.extendedPatient;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    // Anti-doble-submit: si ya está guardando, ignorar el click
    if (saving) return;
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError('');
    try {
      // Construir payload limpio: omitir campos vacíos para no enviar "" donde
      // el backend espera int / float (age, peso) y evitar 422 que parecen
      // colgarse cuando el proxy los procesa lento.
      const payload = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v === '' || v === null || v === undefined) return; // omitir vacíos
        payload[k] = v;
      });
      if (form.age !== '' && form.age != null) {
        const n = parseInt(form.age, 10);
        if (!Number.isNaN(n)) payload.age = n; else delete payload.age;
      }
      if (form.peso !== '' && form.peso != null) {
        const n = parseFloat(form.peso);
        if (!Number.isNaN(n)) payload.peso = n; else delete payload.peso;
      }
      if (isEdit) await api.patients.update(patient.id, payload);
      else        await api.patients.create(payload);
      onSaved(); onClose();
    } catch (err) {
      // Mensajes más específicos según el tipo de fallo
      let msg = err?.response?.data?.detail;
      if (!msg) {
        if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
          msg = 'El servidor tardó demasiado en responder. Intentá de nuevo.';
        } else if (err?.message === 'Network Error') {
          msg = 'No se pudo conectar con el servidor. Revisá tu conexión.';
        } else {
          msg = 'Error al guardar paciente';
        }
      }
      // Si detail viene como array (validación FastAPI), tomar el primero legible
      if (Array.isArray(msg)) msg = msg[0]?.msg || JSON.stringify(msg);
      setError(typeof msg === 'string' ? msg : 'Error al guardar paciente');
      // eslint-disable-next-line no-console
      console.error('[PatientModal] save error', err);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-bold text-lg text-foreground">
            {isEdit ? 'Editar Paciente' : 'Nuevo Paciente'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* ── Datos personales ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Datos Personales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nombre completo *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                       placeholder="Juan Pérez" className="rounded-xl" required />
              </div>
              <div className="space-y-1">
                <Label>Edad</Label>
                <Input type="number" value={form.age} onChange={e => set('age', e.target.value)}
                       placeholder="35" className="rounded-xl" min="0" max="150" />
              </div>
              <div className="space-y-1">
                <Label>Cédula</Label>
                <Input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                       placeholder="1234567" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>CI/RUC</Label>
                <div className="flex gap-1.5">
                  <Input value={form.ci_ruc} onChange={e => set('ci_ruc', e.target.value)}
                         placeholder="RUC o CI empresarial" className="rounded-xl flex-1" />
                  <Input value={form.ci_dv} onChange={e => set('ci_dv', e.target.value)}
                         placeholder="DV" className="rounded-xl w-16" maxLength={2} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nacionalidad</Label>
                <Input value={form.nationality} onChange={e => set('nationality', e.target.value)}
                       placeholder="Paraguaya" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Ocupación</Label>
                <Input value={form.occupation} onChange={e => set('occupation', e.target.value)}
                       placeholder="Docente, Ingeniero..." className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                       placeholder="+595 9XX XXX XXX" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)}
                       placeholder="Av. Mariscal López 1234" className="rounded-xl" />
              </div>
            </div>
          </div>

          {/* ── Seguro médico ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Seguro Médico
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre del seguro</Label>
                <Input value={form.insurance_name} onChange={e => set('insurance_name', e.target.value)}
                       placeholder="IPS, Aseguradora..." className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Nº de afiliado / póliza</Label>
                <Input value={form.insurance_number} onChange={e => set('insurance_number', e.target.value)}
                       placeholder="N° de afiliado" className="rounded-xl" />
              </div>
            </div>
          </div>

          {/* ── Campos extendidos (Equilibrio) ── */}
          {showExtended && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Datos adicionales
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Sexo</Label>
                  <select value={form.sexo} onChange={e => set('sexo', e.target.value)}
                          className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Peso (kg)</Label>
                  <Input type="number" step="0.1" value={form.peso} onChange={e => set('peso', e.target.value)}
                         placeholder="70.5" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label>Estado civil</Label>
                  <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}
                          className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
                    <option value="">Seleccionar...</option>
                    <option value="soltero">Soltero/a</option>
                    <option value="casado">Casado/a</option>
                    <option value="divorciado">Divorciado/a</option>
                    <option value="viudo">Viudo/a</option>
                    <option value="union_libre">Unión libre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={form.fecha_nacimiento}
                         onChange={e => set('fecha_nacimiento', e.target.value)} className="rounded-xl" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Contacto de emergencia</Label>
                  <Input value={form.contacto_emergencia} onChange={e => set('contacto_emergencia', e.target.value)}
                         placeholder="Nombre y teléfono del contacto de emergencia" className="rounded-xl" />
                </div>
              </div>
            </div>
          )}

          {/* ── Historial / antecedentes ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Antecedentes / Historial clínico
            </p>
            <textarea
              value={form.medical_history}
              onChange={e => set('medical_history', e.target.value)}
              rows={3}
              placeholder="Alergias, condiciones crónicas, cirugías previas, medicación actual..."
              className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background"
            />
          </div>

          {/* ── Estado actual / evolución ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Estado actual / Evolución
            </p>
            <textarea
              value={form.current_status}
              onChange={e => set('current_status', e.target.value)}
              rows={2}
              placeholder="Estado actual del paciente, evolución del tratamiento..."
              className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">{error}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-xl">
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear paciente'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Componente principal ────────────────────────────── */
const PatientsPage = ({ doctor }) => {
  const { labels } = useEmpresa();
  const isPrivileged = doctor?.role === 'super_admin' || doctor?.role === 'admin';

  const [patients,    setPatients]    = useState([]);
  const [doctors,     setDoctors]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterDoc,   setFilterDoc]   = useState('');   // '' = todos
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);

  const loadDoctors = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      const list = await api.admin.getUsers();
      setDoctors(list || []);
    } catch { /* silent */ }
  }, [isPrivileged]);

  const loadPatients = useCallback(async (docId = filterDoc) => {
    setLoading(true);
    try {
      const data = await api.patients.getAll(docId || undefined);
      setPatients(data || []);
    } catch { setPatients([]); }
    finally { setLoading(false); }
  }, [filterDoc]);

  useEffect(() => {
    loadDoctors();
    loadPatients();
  }, []); // eslint-disable-line

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { loadPatients(); return; }
    try {
      const results = await api.patients.search(q);
      setPatients(results || []);
    } catch { /* silent */ }
  };

  const handleFilterDoc = (docId) => {
    setFilterDoc(docId);
    loadPatients(docId);
  };

  const handleDelete = async (id, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('¿Eliminar este paciente?')) return;
    try { await api.patients.delete(id); loadPatients(); }
    catch (err) { alert(err?.response?.data?.detail || 'Error al eliminar'); }
  };

  const openEdit = (p, e) => {
    e.preventDefault(); e.stopPropagation();
    setEditing(p); setShowModal(true);
  };

  const displayedPatients = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) ||
           p.cedula?.toLowerCase().includes(q) ||
           p.phone?.includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" style={{ color: 'var(--empresa-primary)' }} />
            Pacientes
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {displayedPatients.length} {displayedPatients.length === 1 ? 'paciente' : 'pacientes'}
            {filterDoc ? ` — filtrando por ${doctors.find(d=>d.id===filterDoc)?.name || 'doctor'}` : ''}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Nuevo Paciente
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula, teléfono..."
            className="pl-10 pr-8 rounded-2xl border-border"
          />
          {search && (
            <button onClick={() => handleSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro por doctor (solo admin/super_admin) */}
        {isPrivileged && doctors.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterDoc}
              onChange={e => handleFilterDoc(e.target.value)}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background"
            >
              <option value="">Todos los doctores</option>
              {doctors.filter(d => d.role !== 'super_admin').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 rounded-full mx-auto mb-3"
               style={{ borderTopColor: 'var(--empresa-primary)' }} />
          Cargando pacientes...
        </div>
      ) : displayedPatients.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {search ? 'No se encontraron resultados' : 'No hay pacientes registrados'}
          </p>
          {!search && (
            <Button onClick={() => setShowModal(true)} variant="outline" className="mt-4 rounded-xl gap-2">
              <Plus className="w-4 h-4" /> Agregar primer paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {displayedPatients.map(p => (
            <Link key={p.id} to={`/patients/${p.id}`} className="block group">
              <div className="bg-white border border-border rounded-2xl px-5 py-4 hover:border-primary/40 hover:shadow-sm transition-all flex items-center justify-between"
                   style={{ '--tw-border-opacity': 1 }}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                       style={{ backgroundColor: 'var(--empresa-primary)' }}>
                    {p.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {p.cedula && (
                        <span className="text-xs text-muted-foreground">CI: {p.cedula}</span>
                      )}
                      {p.age && (
                        <span className="text-xs text-muted-foreground">{p.age} años</span>
                      )}
                      {p.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {p.phone}
                        </span>
                      )}
                      {p.occupation && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {p.occupation}
                        </span>
                      )}
                      {p.insurance_name && (
                        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> {p.insurance_name}
                        </span>
                      )}
                      {/* Campo doctor (solo admin/super_admin) */}
                      {isPrivileged && p.doctor_name && (
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 flex items-center gap-1"
                              style={{ backgroundColor: 'var(--empresa-primary-10)', color: 'var(--empresa-primary)' }}>
                          <UserCheck className="w-3 h-3" /> {p.doctor_name}
                        </span>
                      )}
                      {/* Campos extendidos */}
                      {labels.extendedPatient && p.sexo && (
                        <span className="text-xs text-muted-foreground capitalize">{p.sexo}</span>
                      )}
                      {labels.extendedPatient && p.peso && (
                        <span className="text-xs text-muted-foreground">{p.peso} kg</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={e => openEdit(p, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
                    title="Editar"
                  >
                    Editar
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <PatientModal
          patient={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={loadPatients}
          labels={labels}
        />
      )}
    </div>
  );
};

export default PatientsPage;
