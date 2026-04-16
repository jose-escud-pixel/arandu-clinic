import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Users, Shield, Building2, Plus, Edit2, Trash2, Check, X,
  Eye, EyeOff, Key, UserCheck, Activity, Palette,
  ArrowRightLeft, UserX, UserCheck2, Power
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ─── Modal genérico ──────────────────────────────────── */
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="font-bold text-lg text-foreground">{title}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

/* ─── Panel: Gestión de Empresas (Super Admin) ────────── */
const EmpresasPanel = () => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nombre: '', slug: '', descripcion: '',
    primary_color: '#D97757', secondary_color: '#4B7F52',
    bg_color: '#FDFCF8', text_color: '#2D2A26',
    muted_color: '#F5F2EB', border_color: '#E5E0D6',
    profesional_label: 'Doctor', indicaciones_label: 'Indicaciones',
    extended_patient: false,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEmpresas = useCallback(async () => {
    setLoading(true);
    try { setEmpresas((await api.empresas.getAll()) || []); }
    catch { setEmpresas([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEmpresas(); }, [loadEmpresas]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: '', slug: '', descripcion: '', primary_color: '#D97757', secondary_color: '#4B7F52', bg_color: '#FDFCF8', text_color: '#2D2A26', muted_color: '#F5F2EB', border_color: '#E5E0D6', profesional_label: 'Doctor', indicaciones_label: 'Indicaciones', extended_patient: false });
    setLogoFile(null); setError(''); setShowModal(true);
  };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ nombre: emp.nombre||'', slug: emp.slug||'', descripcion: emp.descripcion||'', primary_color: emp.primary_color||'#D97757', secondary_color: emp.secondary_color||'#4B7F52', bg_color: emp.bg_color||'#FDFCF8', text_color: emp.text_color||'#2D2A26', muted_color: emp.muted_color||'#F5F2EB', border_color: emp.border_color||'#E5E0D6', profesional_label: emp.profesional_label||'Doctor', indicaciones_label: emp.indicaciones_label||'Indicaciones', extended_patient: emp.extended_patient||false });
    setLogoFile(null); setError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre || !form.slug) { setError('Nombre y slug son requeridos'); return; }
    setSaving(true); setError('');
    try {
      let saved = editing ? await api.empresas.update(editing.id, form) : await api.empresas.create(form);
      if (logoFile && (saved?.id || editing?.id)) await api.empresas.uploadLogo(saved?.id || editing?.id, logoFile);
      setShowModal(false); loadEmpresas();
    } catch (e) { setError(e?.response?.data?.detail || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta empresa?')) return;
    try { await api.empresas.delete(id); loadEmpresas(); }
    catch (e) { alert(e?.response?.data?.detail || 'Error'); }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Cargando empresas...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Empresas / Clínicas</h3>
        <Button onClick={openCreate} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> Nueva Empresa</Button>
      </div>
      <div className="grid gap-3">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {emp.logo_url ? (
                <img src={`${BACKEND_URL}${emp.logo_url}`} alt={emp.nombre} className="h-10 w-16 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${emp.primary_color||'#D97757'}20` }}>
                  <Building2 className="w-5 h-5" style={{ color: emp.primary_color||'#D97757' }} />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">{emp.nombre}</p>
                <p className="text-xs text-muted-foreground">{emp.slug}</p>
              </div>
              <div className="flex gap-1 ml-2">
                {['primary_color','secondary_color','bg_color'].map(k => (
                  <span key={k} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: emp[k] }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} className="rounded-xl hover:bg-primary/10"><Edit2 className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(emp.id)} className="rounded-xl hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
        {empresas.length === 0 && <p className="text-center text-muted-foreground py-8">No hay empresas registradas</p>}
      </div>

      {showModal && (
        <Modal title={editing ? 'Editar Empresa' : 'Nueva Empresa'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} placeholder="Arandu Clinic" className="rounded-xl" /></div>
              <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f=>({...f,slug:e.target.value.toLowerCase().replace(/\s/g,'-')}))} placeholder="arandu-clinic" className="rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label>Descripción</Label><Input value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Breve descripción" className="rounded-xl" /></div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1"><Palette className="w-4 h-4" /> Colores del tema</p>
              <div className="grid grid-cols-3 gap-2">
                {[{key:'primary_color',label:'Primario'},{key:'secondary_color',label:'Secundario'},{key:'bg_color',label:'Fondo'},{key:'text_color',label:'Texto'},{key:'muted_color',label:'Muted'},{key:'border_color',label:'Borde'}].map(({key,label}) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex items-center gap-1">
                      <input type="color" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                      <input type="text" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="flex-1 text-xs border border-gray-200 rounded px-1 py-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Label "Profesional"</Label><Input value={form.profesional_label} onChange={e=>setForm(f=>({...f,profesional_label:e.target.value}))} placeholder="Doctor / Fisioterapeuta" className="rounded-xl" /></div>
              <div className="space-y-1"><Label>Label "Indicaciones"</Label><Input value={form.indicaciones_label} onChange={e=>setForm(f=>({...f,indicaciones_label:e.target.value}))} placeholder="Indicaciones / Receta" className="rounded-xl" /></div>
            </div>
            <div className="flex items-center gap-3 py-2">
              <input type="checkbox" id="ext" checked={form.extended_patient} onChange={e=>setForm(f=>({...f,extended_patient:e.target.checked}))} className="w-4 h-4 rounded" />
              <Label htmlFor="ext" className="cursor-pointer">Formulario extendido de pacientes <span className="text-xs text-muted-foreground">(sexo, peso, estado civil…)</span></Label>
            </div>
            <div className="space-y-1">
              <Label>Logo</Label>
              <input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files[0])} className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-sm cursor-pointer" />
              {editing?.logo_url && !logoFile && <img src={`${BACKEND_URL}${editing.logo_url}`} alt="" className="inline h-6 mt-1" />}
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={()=>setShowModal(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear empresa'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* ─── Tabla de usuarios con asignación de empresa ────── */
const UsersTable = ({ users, empresas, onApprove, onReject, onChangeRole, onChangePassword, onDelete, onAssignEmpresa, onToggleStatus, isSuperAdmin }) => {
  const [pwModal, setPwModal] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const handleChangePw = async () => {
    if (!newPw || !pwModal) return;
    setSavingPw(true);
    try { await onChangePassword(pwModal.id, newPw); setPwModal(null); setNewPw(''); }
    finally { setSavingPw(false); }
  };

  const handleEmpresaChange = async (uid, empresaId) => {
    setAssigningId(uid);
    try { await onAssignEmpresa(uid, empresaId); }
    finally { setAssigningId(null); }
  };

  const handleToggle = async (uid) => {
    setTogglingId(uid);
    try { await onToggleStatus(uid); }
    finally { setTogglingId(null); }
  };

  const ROLES = isSuperAdmin ? ['doctor','admin','super_admin'] : ['doctor','admin'];

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Usuario</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium min-w-[180px]">Empresa</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rol</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Estado</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  {isSuperAdmin && u.role !== 'super_admin' ? (
                    /* Super admin puede cambiar empresa de cualquier usuario */
                    <div className="flex items-center gap-1">
                      <select
                        value={u.empresa_id || ''}
                        onChange={e => handleEmpresaChange(u.id, e.target.value)}
                        disabled={assigningId === u.id}
                        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background max-w-[180px] disabled:opacity-60"
                      >
                        <option value="">— Sin empresa —</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                        ))}
                      </select>
                      {assigningId === u.id && (
                        <div className="w-3.5 h-3.5 border border-gray-300 border-t-primary rounded-full animate-spin flex-shrink-0"
                             style={{ borderTopColor: 'var(--empresa-primary)' }} />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {u.role === 'super_admin' ? '— Global —' : (u.empresa?.nombre || '—')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select value={u.role} onChange={e => onChangeRole(u.id, e.target.value)}
                          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 font-medium ${
                    u.status==='active'   ? 'bg-green-100 text-green-700'
                    : u.status==='pending'  ? 'bg-yellow-100 text-yellow-700'
                    : u.status==='disabled' ? 'bg-gray-100 text-gray-500'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {u.status==='active'   ? 'Activo'
                     : u.status==='pending'  ? 'Pendiente'
                     : u.status==='disabled' ? 'Deshabilitado'
                     : 'Rechazado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {u.status==='pending' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={()=>onApprove(u.id)}
                                className="rounded-lg hover:bg-green-50 text-green-600 h-7 w-7 p-0" title="Aprobar"><Check className="w-3.5 h-3.5"/></Button>
                        <Button variant="ghost" size="sm" onClick={()=>onReject(u.id)}
                                className="rounded-lg hover:bg-red-50 text-red-500 h-7 w-7 p-0" title="Rechazar"><X className="w-3.5 h-3.5"/></Button>
                      </>
                    )}
                    {/* Habilitar / Deshabilitar */}
                    {u.status !== 'pending' && (
                      <Button variant="ghost" size="sm" disabled={togglingId===u.id}
                              onClick={()=>handleToggle(u.id)}
                              className={`rounded-lg h-7 w-7 p-0 ${u.status==='disabled' ? 'hover:bg-green-50 text-gray-400 hover:text-green-600' : 'hover:bg-orange-50 text-gray-400 hover:text-orange-500'}`}
                              title={u.status==='disabled' ? 'Habilitar usuario' : 'Deshabilitar usuario'}>
                        {togglingId===u.id
                          ? <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"/>
                          : u.status==='disabled'
                            ? <UserCheck2 className="w-3.5 h-3.5"/>
                            : <UserX className="w-3.5 h-3.5"/>}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={()=>{setPwModal(u);setNewPw('');setShowPw(false);}}
                            className="rounded-lg hover:bg-blue-50 text-blue-500 h-7 w-7 p-0" title="Cambiar contraseña"><Key className="w-3.5 h-3.5"/></Button>
                    <Button variant="ghost" size="sm" onClick={()=>onDelete(u.id)}
                            className="rounded-lg hover:bg-red-50 text-red-500 h-7 w-7 p-0" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No hay usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pwModal && (
        <Modal title={`Cambiar contraseña — ${pwModal.name}`} onClose={()=>setPwModal(null)}>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input type={showPw?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)}
                       placeholder="Mínimo 6 caracteres" className="rounded-xl pr-10" />
                <button type="button" onClick={()=>setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>setPwModal(null)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={handleChangePw} disabled={savingPw||!newPw} className="flex-1 rounded-xl">
                {savingPw?'Guardando...':'Cambiar contraseña'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

/* ─── Panel: Log de actividad ─────────────────────────── */
const ActivityPanel = ({ isSuperAdmin }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getActivityLogs(200, 0)
      .then(data => setLogs(data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  if (logs.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Activity className="w-12 h-12 mx-auto opacity-30 mb-2" />
      <p>Sin registros de actividad aún</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Fecha</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Usuario</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Acción</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Detalles</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.created_at).toLocaleString('es-PY',{dateStyle:'short',timeStyle:'short'})}
              </td>
              <td className="px-4 py-2.5 text-xs font-medium text-foreground">{log.user_name||log.user_id}</td>
              <td className="px-4 py-2.5">
                <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5"
                      style={{backgroundColor:'var(--empresa-primary-10)',color:'var(--empresa-primary)'}}>
                  {log.action}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Modal: Crear Usuario ────────────────────────────── */
const CreateUserModal = ({ onClose, onCreated, empresas, isSuperAdmin }) => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'doctor',
    empresa_id: '', specialty: '', license_number: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('Nombre, email y contraseña son requeridos'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setSaving(true); setError('');
    try {
      await api.admin.createUser({
        ...form,
        empresa_id: form.empresa_id || undefined,
      });
      onCreated();
      onClose();
    } catch (err) { setError(err?.response?.data?.detail || 'Error al crear usuario'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Crear nuevo usuario" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Nombre completo *</Label>
            <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                   placeholder="Dr. Juan Pérez" className="rounded-xl" required />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                   placeholder="doctor@clinica.com" className="rounded-xl" required />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Contraseña *</Label>
            <div className="relative">
              <Input type={showPw?'text':'password'} value={form.password}
                     onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                     placeholder="Mínimo 6 caracteres" className="rounded-xl pr-10" required />
              <button type="button" onClick={()=>setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </select>
          </div>
          {isSuperAdmin && (
            <div className="space-y-1">
              <Label>Empresa</Label>
              <select value={form.empresa_id} onChange={e=>setForm(f=>({...f,empresa_id:e.target.value}))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
                <option value="">— Sin empresa —</option>
                {empresas.map(emp=><option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Especialidad</Label>
            <Input value={form.specialty} onChange={e=>setForm(f=>({...f,specialty:e.target.value}))}
                   placeholder="Ej: Fisioterapia" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label>Matrícula</Label>
            <Input value={form.license_number} onChange={e=>setForm(f=>({...f,license_number:e.target.value}))}
                   placeholder="Ej: MP-12345" className="rounded-xl" />
          </div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={saving} className="flex-1 rounded-xl gap-2">
            {saving ? 'Creando...' : <><Plus className="w-4 h-4"/> Crear usuario</>}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Componente principal: AdminPage ─────────────────── */
const AdminPage = ({ doctor }) => {
  const isSuperAdmin = doctor?.role === 'super_admin';
  const isAdmin = doctor?.role === 'admin' || isSuperAdmin;
  const { labels } = useEmpresa();

  const TABS = [
    ...(isSuperAdmin ? [
      { id: 'empresas',   label: 'Empresas',         icon: Building2  },
      { id: 'all-users',  label: 'Todos los Usuarios',icon: Users      },
    ] : []),
    { id: 'users',    label: 'Usuarios',           icon: Users      },
    { id: 'pending',  label: 'Pendientes',         icon: UserCheck  },
    { id: 'activity', label: 'Log Actividad',      icon: Activity   },
  ];

  const [activeTab, setActiveTab] = useState(TABS[0]?.id || 'users');
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Cargar lista de empresas para el dropdown de asignación
  useEffect(() => {
    if (isSuperAdmin) {
      api.empresas.getAll().then(setEmpresas).catch(()=>{});
    }
  }, [isSuperAdmin]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [u, p] = await Promise.all([api.admin.getUsers(), api.admin.getPendingUsers()]);
      setUsers(u||[]); setPendingUsers(p||[]);
    } catch { /* silent */ }
    finally { setLoadingUsers(false); }
  }, []);

  const loadAllUsers = useCallback(async () => {
    if (!isSuperAdmin) return;
    try { setAllUsers((await api.superadmin.getAllUsers())||[]); }
    catch { /* silent */ }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (activeTab==='users'||activeTab==='pending') loadUsers();
    if (activeTab==='all-users') loadAllUsers();
  }, [activeTab, loadUsers, loadAllUsers]);

  const handleApprove       = async (uid) => { await api.admin.approveUser(uid); loadUsers(); };
  const handleReject        = async (uid) => { await api.admin.rejectUser(uid);  loadUsers(); };
  const handleChangeRole    = async (uid, role) => { await api.admin.changeUserRole(uid, role); loadUsers(); if(activeTab==='all-users') loadAllUsers(); };
  const handleChangePw      = async (uid, pw)   => { await api.admin.changeUserPassword(uid, pw); };
  const handleToggleStatus  = async (uid) => {
    await api.admin.toggleUserStatus(uid);
    loadUsers();
    if (activeTab==='all-users') loadAllUsers();
  };
  const handleDelete        = async (uid) => {
    if (!window.confirm('¿Eliminar este usuario permanentemente?')) return;
    await api.admin.deleteUser(uid); loadUsers(); if(activeTab==='all-users') loadAllUsers();
  };

  // Super admin: asignar empresa a un usuario
  const handleAssignEmpresa = async (uid, empresaId) => {
    await api.superadmin.assignEmpresa(uid, empresaId);
    loadAllUsers();
    loadUsers();
  };

  if (!isAdmin) return (
    <div className="text-center py-16 text-muted-foreground">No tenés permisos para esta sección.</div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6" style={{color:'var(--empresa-primary)'}} />
          Administración
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isSuperAdmin ? 'Panel Super Administrador — Gestión global' : 'Panel de Administración'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-2xl w-fit flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive?'bg-white text-foreground shadow-sm':'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4"/>
              {tab.label}
              {tab.id==='pending' && pendingUsers.length>0 && (
                <span className="bg-yellow-400 text-yellow-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{pendingUsers.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div>
        {activeTab==='empresas' && isSuperAdmin && <EmpresasPanel />}

        {activeTab==='all-users' && isSuperAdmin && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{color:'var(--empresa-primary)'}}/>
                Todos los usuarios ({allUsers.length})
                <span className="text-xs font-normal text-muted-foreground ml-1">— Click en la empresa para reasignar</span>
              </h3>
              <Button onClick={()=>setShowCreateUser(true)} size="sm" className="gap-2 rounded-xl">
                <Plus className="w-4 h-4"/> Crear usuario
              </Button>
            </div>
            <UsersTable
              users={allUsers} empresas={empresas}
              onApprove={handleApprove} onReject={handleReject}
              onChangeRole={handleChangeRole} onChangePassword={handleChangePw}
              onDelete={handleDelete} onAssignEmpresa={handleAssignEmpresa}
              onToggleStatus={handleToggleStatus}
              isSuperAdmin={true}
            />
          </div>
        )}

        {activeTab==='users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Usuarios de esta empresa ({users.length})
              </h3>
              <Button onClick={()=>setShowCreateUser(true)} size="sm" className="gap-2 rounded-xl">
                <Plus className="w-4 h-4"/> Crear usuario
              </Button>
            </div>
            {loadingUsers ? <div className="text-center py-8 text-muted-foreground">Cargando...</div> : (
              <UsersTable
                users={users} empresas={empresas}
                onApprove={handleApprove} onReject={handleReject}
                onChangeRole={handleChangeRole} onChangePassword={handleChangePw}
                onDelete={handleDelete} onAssignEmpresa={handleAssignEmpresa}
                onToggleStatus={handleToggleStatus}
                isSuperAdmin={isSuperAdmin}
              />
            )}
          </div>
        )}

        {activeTab==='pending' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Pendientes de aprobación ({pendingUsers.length})
              </h3>
              <Button onClick={()=>setShowCreateUser(true)} size="sm" className="gap-2 rounded-xl">
                <Plus className="w-4 h-4"/> Crear usuario
              </Button>
            </div>
            {loadingUsers ? <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            : pendingUsers.length===0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="w-12 h-12 mx-auto opacity-30 mb-3"/>
                <p>No hay usuarios pendientes</p>
              </div>
            ) : (
              <UsersTable
                users={pendingUsers} empresas={empresas}
                onApprove={handleApprove} onReject={handleReject}
                onChangeRole={handleChangeRole} onChangePassword={handleChangePw}
                onDelete={handleDelete} onAssignEmpresa={handleAssignEmpresa}
                onToggleStatus={handleToggleStatus}
                isSuperAdmin={isSuperAdmin}
              />
            )}
          </div>
        )}

        {activeTab==='activity' && <ActivityPanel isSuperAdmin={isSuperAdmin} />}
      </div>

      {showCreateUser && (
        <CreateUserModal
          onClose={() => setShowCreateUser(false)}
          onCreated={() => { loadUsers(); if(activeTab==='all-users') loadAllUsers(); }}
          empresas={empresas}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
};

export default AdminPage;
