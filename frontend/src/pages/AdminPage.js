import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Users, Building2, Plus, Edit2, Trash2, Check, X,
  Eye, EyeOff, Key, Activity, Palette,
  UserX, UserCheck2, Settings2, Search
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

const EMPRESA_FORM_DEFAULTS = {
  nombre: '', slug: '', descripcion: '',
  razon_social: '', ruc: '', direccion: '', telefono: '', email: '', contacto: '',
  primary_color: '#D97757', secondary_color: '#4B7F52',
  bg_color: '#FDFCF8', text_color: '#2D2A26',
  muted_color: '#F5F2EB', border_color: '#E5E0D6',
  profesional_label: 'Doctor', indicaciones_label: 'Indicaciones',
  extended_patient: false,
};

/* ─── Panel: Gestión de Empresas / Clínicas ────────── */
const EmpresasPanel = ({ isSuperAdmin }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPRESA_FORM_DEFAULTS);
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
    setForm(EMPRESA_FORM_DEFAULTS);
    setLogoFile(null); setError(''); setShowModal(true);
  };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      ...EMPRESA_FORM_DEFAULTS,
      nombre: emp.nombre||'', slug: emp.slug||'', descripcion: emp.descripcion||'',
      razon_social: emp.razon_social||'', ruc: emp.ruc||'', direccion: emp.direccion||'',
      telefono: emp.telefono||'', email: emp.email||'', contacto: emp.contacto||'',
      primary_color: emp.primary_color||'#D97757', secondary_color: emp.secondary_color||'#4B7F52',
      bg_color: emp.bg_color||'#FDFCF8', text_color: emp.text_color||'#2D2A26',
      muted_color: emp.muted_color||'#F5F2EB', border_color: emp.border_color||'#E5E0D6',
      profesional_label: emp.profesional_label||'Doctor', indicaciones_label: emp.indicaciones_label||'Indicaciones',
      extended_patient: emp.extended_patient||false
    });
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
    if (!isSuperAdmin) return;
    if (!window.confirm('¿Eliminar esta empresa?')) return;
    try { await api.empresas.delete(id); loadEmpresas(); }
    catch (e) { alert(e?.response?.data?.detail || 'Error'); }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Cargando empresas...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Empresas / Clínicas</h3>
        {isSuperAdmin && <Button onClick={openCreate} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> Nueva Empresa</Button>}
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
                <p className="text-xs text-muted-foreground">{emp.slug}{emp.ruc ? ` · RUC ${emp.ruc}` : ''}</p>
                {(emp.razon_social || emp.telefono) && (
                  <p className="text-xs text-muted-foreground">{emp.razon_social || emp.telefono}</p>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                {['primary_color','secondary_color','bg_color'].map(k => (
                  <span key={k} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: emp[k] }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} className="rounded-xl hover:bg-primary/10"><Edit2 className="w-4 h-4" /></Button>
              {isSuperAdmin && (
                <Button variant="ghost" size="sm" onClick={() => handleDelete(emp.id)} className="rounded-xl hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></Button>
              )}
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
              <p className="text-sm font-medium text-foreground mb-2">Datos de la empresa</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Razón social</Label><Input value={form.razon_social} onChange={e=>setForm(f=>({...f,razon_social:e.target.value}))} placeholder="Razón social legal" className="rounded-xl" /></div>
                <div className="space-y-1"><Label>RUC</Label><Input value={form.ruc} onChange={e=>setForm(f=>({...f,ruc:e.target.value}))} placeholder="80000000-0" className="rounded-xl" /></div>
                <div className="space-y-1"><Label>Teléfono</Label><Input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} placeholder="0981 000 000" className="rounded-xl" /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="clinica@correo.com" className="rounded-xl" /></div>
                <div className="space-y-1"><Label>Contacto</Label><Input value={form.contacto} onChange={e=>setForm(f=>({...f,contacto:e.target.value}))} placeholder="Persona de contacto" className="rounded-xl" /></div>
                <div className="space-y-1"><Label>Dirección</Label><Input value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} placeholder="Dirección fiscal o comercial" className="rounded-xl" /></div>
              </div>
            </div>
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
/* ─── Modal: Permisos granulares de un doctor ─────────── */
const PERMISOS_LABELS = {
  ver: 'Ver', crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar',
  exportar_pdf: 'Exportar PDF', subir: 'Subir',
};
const MODULO_LABELS = {
  pacientes: 'Pacientes', citas: 'Citas', historia_clinica: 'Historia Clínica',
  consultas: 'Consultas', recetas: 'Recetas/Indicaciones',
  archivos: 'Archivos', estadisticas: 'Estadísticas',
};

// Permisos verticales: super_admin > admin > doctor.
// Nadie puede degradar/eliminar/deshabilitar a sí mismo ni a un par o superior.
const ROLE_RANK = { doctor: 1, coordinador: 2, admin: 3, super_admin: 4 };
const ROLE_LABELS = {
  doctor: 'Doctor',
  coordinador: 'Coordinador clínico',
  admin: 'Admin del sitio',
  super_admin: 'Super Admin',
};
const rankOf = (r) => ROLE_RANK[r] || 1;

const EmpresasAsignadasModal = ({ user, empresas, onClose, onSave, saving }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(user.empresas || (user.empresa_id ? [user.empresa_id] : []));
  const normalized = query.trim().toLowerCase();
  const filtered = empresas.filter(emp =>
    !normalized ||
    emp.nombre?.toLowerCase().includes(normalized) ||
    emp.slug?.toLowerCase().includes(normalized) ||
    emp.ruc?.toLowerCase().includes(normalized)
  );

  const toggleEmpresa = (empresaId) => {
    setSelected(prev => prev.includes(empresaId)
      ? prev.filter(id => id !== empresaId)
      : [...prev, empresaId]
    );
  };

  return (
    <Modal title={`Empresas de ${user.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empresa, slug o RUC" className="rounded-xl" />
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted text-xs text-muted-foreground flex justify-between">
            <span>{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</span>
            <button type="button" onClick={() => setSelected(empresas.map(emp => emp.id))} className="text-primary hover:underline">Marcar todas</button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {filtered.map(emp => {
              const checked = selected.includes(emp.id);
              return (
                <label key={emp.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleEmpresa(emp.id)} className="w-4 h-4 rounded" />
                  {emp.logo_url ? (
                    <img src={`${BACKEND_URL}${emp.logo_url}`} alt="" className="h-8 w-10 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{emp.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.slug}{emp.ruc ? ` · RUC ${emp.ruc}` : ''}</p>
                  </div>
                </label>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No hay empresas con ese filtro</p>}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
          <Button onClick={() => onSave(user.id, selected)} disabled={saving || selected.length === 0} className="flex-1 rounded-xl">
            {saving ? 'Guardando...' : 'Guardar empresas'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const UsersTable = ({ users, empresas, currentUser, onApprove, onReject, onChangeRole, onChangePassword, onDelete, onAssignEmpresas, onToggleStatus, isSuperAdmin, onPermisosUpdated }) => {
  const [pwModal, setPwModal] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [empresasModal, setEmpresasModal] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [permisosDrafts, setPermisosDrafts] = useState({});
  const [savingPermsId, setSavingPermsId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.admin.getPermisosDisponibles()
      .then(data => setCatalogo(data))
      .catch(() => setCatalogo({}));
  }, []);

  const handleChangePw = async () => {
    if (!newPw || !pwModal) return;
    setSavingPw(true);
    try { await onChangePassword(pwModal.id, newPw); setPwModal(null); setNewPw(''); }
    finally { setSavingPw(false); }
  };

  const handleEmpresasSave = async (uid, empresaIds) => {
    setAssigningId(uid);
    try {
      await onAssignEmpresas(uid, empresaIds);
      setEmpresasModal(null);
    } finally {
      setAssigningId(null);
    }
  };

  const openPermissions = (u) => {
    setExpandedUser(prev => prev === u.id ? null : u.id);
    setPermisosDrafts(prev => ({
      ...prev,
      [u.id]: prev[u.id] || { ...(u.permissions || {}) }
    }));
  };

  const togglePermiso = (uid, key) => {
    setPermisosDrafts(prev => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [key]: !(prev[uid] || {})[key],
      }
    }));
  };

  const toggleModulo = (uid, modulo, acciones) => {
    const current = permisosDrafts[uid] || {};
    const allOn = acciones.every(a => current[`${modulo}.${a}`]);
    const next = {};
    acciones.forEach(a => { next[`${modulo}.${a}`] = !allOn; });
    setPermisosDrafts(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), ...next }
    }));
  };

  const savePermisos = async (uid) => {
    setSavingPermsId(uid);
    try {
      await api.admin.updatePermissions(uid, permisosDrafts[uid] || {});
      if (onPermisosUpdated) onPermisosUpdated();
    } finally {
      setSavingPermsId(null);
    }
  };

  const handleToggle = async (uid) => {
    setTogglingId(uid);
    try { await onToggleStatus(uid); }
    finally { setTogglingId(null); }
  };

  // ¿El currentUser puede actuar (degradar / deshabilitar / eliminar) sobre u?
  const canManage = (u) => {
    if (!currentUser) return false;
    if (u.id === currentUser.id) return false; // nunca sobre sí mismo
    return rankOf(currentUser.role) > rankOf(u.role);
  };

  // Roles asignables: estrictamente inferiores al rol del actor.
  const ALL_ROLES = ['doctor','coordinador','admin','super_admin'];
  const assignableRoles = (currentUser?.role === 'super_admin')
      ? ['doctor','coordinador','admin']
      : (currentUser?.role === 'admin' ? ['doctor','coordinador'] : []);

  const statusLabel = (status) => (
    status === 'active' ? 'Activo'
    : status === 'pending' ? 'Pendiente'
    : status === 'disabled' ? 'Deshabilitado'
    : 'Rechazado'
  );
  const statusClass = (status) => (
    status === 'active' ? 'bg-green-100 text-green-700'
    : status === 'pending' ? 'bg-yellow-100 text-yellow-700'
    : status === 'disabled' ? 'bg-gray-100 text-gray-500'
    : 'bg-red-100 text-red-700'
  );
  const empresasSummary = (u) => {
    if (u.role === 'super_admin') return 'Global';
    const names = (u.empresas_detalle || []).map(emp => emp.nombre);
    if (names.length) return names.join(', ');
    return u.empresa?.nombre || 'Sin empresa';
  };
  const permisosSummary = (u) => {
    if (['admin', 'super_admin'].includes(u.role)) return 'Todos los permisos';
    const keys = Object.entries(u.permissions || {}).filter(([, on]) => on).map(([key]) => key);
    if (!keys.length) return 'Sin permisos activos';
    const modulos = [...new Set(keys.map(key => key.split('.')[0]))];
    return modulos.map(m => MODULO_LABELS[m] || m).join(', ');
  };
  const filteredUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.name, u.email, ROLE_LABELS[u.role], empresasSummary(u), permisosSummary(u)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <>
      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuario, rol, empresa o permisos"
            className="pl-9 rounded-xl bg-white"
          />
        </div>

        {filteredUsers.map(u => {
          const isExpanded = expandedUser === u.id;
          const canEditAccess = canManage(u) && ['doctor', 'coordinador'].includes(u.role);
          const empresaCount = (u.empresas || []).length || (u.empresa_id ? 1 : 0);
          return (
            <div key={u.id} className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="p-4 grid gap-4 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_190px_120px_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{permisosSummary(u)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => isSuperAdmin && u.role !== 'super_admin' && setEmpresasModal(u)}
                  disabled={!isSuperAdmin || u.role === 'super_admin' || assigningId === u.id}
                  className="text-left rounded-xl border border-border bg-background hover:bg-muted/40 px-3 py-2 disabled:cursor-default disabled:hover:bg-background"
                >
                  <span className="block text-xs font-medium text-foreground">
                    {u.role === 'super_admin' ? 'Global' : `${empresaCount} empresa${empresaCount === 1 ? '' : 's'}`}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {empresasSummary(u)}
                  </span>
                </button>

                <div>
                  {canManage(u) ? (
                    <select
                      value={u.role}
                      onChange={e => onChangeRole(u.id, e.target.value)}
                      className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background"
                    >
                      {[u.role, ...assignableRoles.filter(r => r !== u.role)]
                        .filter(r => ALL_ROLES.includes(r))
                        .map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </select>
                  ) : (
                    <span className="inline-block text-xs rounded-lg px-2 py-1 bg-muted text-muted-foreground border border-border">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  )}
                </div>

                <span className={`w-fit inline-block text-xs rounded-full px-2 py-0.5 font-medium ${statusClass(u.status)}`}>
                  {statusLabel(u.status)}
                </span>

                <div className="flex flex-wrap gap-1 justify-start lg:justify-end">
                  {u.status === 'pending' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => onApprove(u.id)}
                              className="rounded-lg hover:bg-green-50 text-green-600 h-8 w-8 p-0" title="Aprobar"><Check className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="sm" onClick={() => onReject(u.id)}
                              className="rounded-lg hover:bg-red-50 text-red-500 h-8 w-8 p-0" title="Rechazar"><X className="w-3.5 h-3.5"/></Button>
                    </>
                  )}
                  {u.status !== 'pending' && canManage(u) && (
                    <Button variant="ghost" size="sm" disabled={togglingId === u.id}
                            onClick={() => handleToggle(u.id)}
                            className={`rounded-lg h-8 w-8 p-0 ${u.status === 'disabled' ? 'hover:bg-green-50 text-gray-400 hover:text-green-600' : 'hover:bg-orange-50 text-gray-400 hover:text-orange-500'}`}
                            title={u.status === 'disabled' ? 'Habilitar usuario' : 'Deshabilitar usuario'}>
                      {togglingId === u.id
                        ? <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"/>
                        : u.status === 'disabled'
                          ? <UserCheck2 className="w-3.5 h-3.5"/>
                          : <UserX className="w-3.5 h-3.5"/>}
                    </Button>
                  )}
                  {canManage(u) && (
                    <Button variant="ghost" size="sm" onClick={() => {setPwModal(u);setNewPw('');setShowPw(false);}}
                            className="rounded-lg hover:bg-blue-50 text-blue-500 h-8 w-8 p-0" title="Cambiar contraseña"><Key className="w-3.5 h-3.5"/></Button>
                  )}
                  {canEditAccess && (
                    <Button variant="ghost" size="sm" onClick={() => openPermissions(u)}
                            className={`rounded-lg h-8 w-8 p-0 ${isExpanded ? 'bg-purple-50 text-purple-600' : 'hover:bg-purple-50 text-purple-500'}`}
                            title="Permisos"><Settings2 className="w-3.5 h-3.5"/></Button>
                  )}
                  {canManage(u) && (
                    <Button variant="ghost" size="sm" onClick={() => onDelete(u.id)}
                            className="rounded-lg hover:bg-red-50 text-red-500 h-8 w-8 p-0" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></Button>
                  )}
                </div>
              </div>

              {isExpanded && canEditAccess && (
                <div className="border-t border-border bg-muted/20 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-purple-500" />
                        Permisos de {u.name}
                      </p>
                      <p className="text-xs text-muted-foreground">Marcá los accesos y guardá sin salir de esta pantalla.</p>
                    </div>
                    <Button size="sm" onClick={() => savePermisos(u.id)} disabled={savingPermsId === u.id || !catalogo} className="rounded-xl">
                      {savingPermsId === u.id ? 'Guardando...' : 'Guardar permisos'}
                    </Button>
                  </div>
                  {!catalogo ? (
                    <p className="text-sm text-muted-foreground">Cargando permisos...</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {Object.entries(catalogo).map(([modulo, acciones]) => {
                        const draft = permisosDrafts[u.id] || {};
                        const allOn = acciones.every(a => draft[`${modulo}.${a}`]);
                        return (
                          <div key={modulo} className="rounded-xl border border-border bg-white overflow-hidden">
                            <button type="button" onClick={() => toggleModulo(u.id, modulo, acciones)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-muted/80 text-left">
                              <span className="text-sm font-medium text-foreground">{MODULO_LABELS[modulo] || modulo}</span>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full ${allOn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {allOn ? 'Todo' : 'Parcial'}
                              </span>
                            </button>
                            <div className="p-3 grid grid-cols-2 gap-2">
                              {acciones.map(accion => {
                                const key = `${modulo}.${accion}`;
                                return (
                                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={!!draft[key]} onChange={() => togglePermiso(u.id, key)} className="w-4 h-4 rounded" />
                                    <span className={draft[key] ? 'text-foreground' : 'text-muted-foreground'}>{PERMISOS_LABELS[accion] || accion}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center py-10 text-muted-foreground rounded-2xl border border-border bg-white">No hay usuarios</div>
        )}
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
      {empresasModal && (
        <EmpresasAsignadasModal
          user={empresasModal}
          empresas={empresas}
          saving={assigningId === empresasModal.id}
          onClose={() => setEmpresasModal(null)}
          onSave={handleEmpresasSave}
        />
      )}
    </>
  );
};

const UsuariosList = ({ users, empresas, currentUser, onDelete, isSuperAdmin, onSaved }) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    api.admin.getPermisosDisponibles().then(setCatalogo).catch(() => setCatalogo({}));
  }, []);

  const canManage = (u) => currentUser && u.id !== currentUser.id && rankOf(currentUser.role) > rankOf(u.role);
  const summary = (u) => {
    const empresasText = u.role === 'super_admin'
      ? 'Global'
      : (u.empresas_detalle || []).map(e => e.nombre).join(', ') || u.empresa?.nombre || '';
    return [u.name, u.email, ROLE_LABELS[u.role], empresasText].filter(Boolean).join(' ');
  };
  const filtered = users.filter(u => summary(u).toLowerCase().includes(search.trim().toLowerCase()));

  const openEdit = (u) => {
    setEditing(u);
    setError('');
    setShowPw(false);
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'doctor',
      empresa_ids: u.empresas || (u.empresa_id ? [u.empresa_id] : []),
      permissions: { ...(u.permissions || {}) },
      specialty: u.specialty || '',
      license_number: u.license_number || '',
    });
  };

  const toggleEmpresa = (id) => {
    setForm(f => ({
      ...f,
      empresa_ids: f.empresa_ids.includes(id)
        ? f.empresa_ids.filter(eid => eid !== id)
        : [...f.empresa_ids, id]
    }));
  };

  const togglePermiso = (key) => {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const toggleModulo = (modulo, acciones) => {
    const allOn = acciones.every(a => form.permissions[`${modulo}.${a}`]);
    const next = {};
    acciones.forEach(a => { next[`${modulo}.${a}`] = !allOn; });
    setForm(f => ({ ...f, permissions: { ...f.permissions, ...next } }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.admin.updateUser(editing.id, {
        ...form,
        password: form.password || undefined,
        empresa_ids: isSuperAdmin && form.role !== 'super_admin' ? form.empresa_ids : undefined,
        permissions: ['doctor', 'coordinador'].includes(form.role) ? form.permissions : undefined,
      });
      setEditing(null);
      setForm(null);
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e=>setSearch(e.target.value)}
                 placeholder="Buscar usuario, email, rol, empresa o permiso..."
                 className="pl-11 rounded-xl bg-white h-11" />
        </div>
        <div className="space-y-3">
          {filtered.map(u => (
            <div key={u.id} className="rounded-2xl border border-border bg-white px-4 py-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                <Key className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{u.name}</p>
                <p className="text-sm text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className={`hidden sm:inline-block text-xs rounded-full px-3 py-1 border ${u.role === 'admin' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {ROLE_LABELS[u.role] || u.role}
              </span>
              {canManage(u) && (
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-8 w-8 p-0 text-yellow-500 hover:bg-yellow-50" title="Editar">
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              {canManage(u) && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(u.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-10 text-muted-foreground rounded-2xl border border-border bg-white">No hay usuarios</div>}
        </div>
      </div>

      {editing && form && (
        <Modal title="Editar Usuario" onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nombre *</Label><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="rounded-xl" /></div>
              <div className="space-y-1"><Label>Usuario / Email *</Label><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="rounded-xl" /></div>
              <div className="col-span-2 space-y-1">
                <Label>Contraseña (dejar vacío para no cambiar)</Label>
                <div className="relative">
                  <Input type={showPw?'text':'password'} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} className="rounded-xl pr-10" />
                  <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label>Rol *</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {['super_admin','admin','coordinador','doctor']
                  .filter(r => r === form.role || (isSuperAdmin ? r !== 'super_admin' : ['coordinador','doctor'].includes(r)))
                  .map(r => (
                    <button key={r} type="button" onClick={()=>setForm(f=>({...f,role:r}))}
                            className={`rounded-xl border px-3 py-3 text-sm text-left ${form.role===r ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                      {ROLE_LABELS[r] || r}
                    </button>
                  ))}
              </div>
            </div>

            {isSuperAdmin && form.role !== 'super_admin' && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted text-sm font-medium text-foreground">Nuestras Empresas ({form.empresa_ids.length}/{empresas.length})</div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {empresas.map(emp => (
                    <label key={emp.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer ${form.empresa_ids.includes(emp.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                      <input type="checkbox" checked={form.empresa_ids.includes(emp.id)} onChange={()=>toggleEmpresa(emp.id)} />
                      <span className="truncate text-sm">{emp.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {['doctor', 'coordinador'].includes(form.role) && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted text-sm font-medium text-foreground">Permisos por Módulo</div>
                <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
                  {catalogo && Object.entries(catalogo).map(([modulo, acciones]) => {
                    const allOn = acciones.every(a => form.permissions[`${modulo}.${a}`]);
                    return (
                      <div key={modulo} className="rounded-xl border border-border overflow-hidden">
                        <button type="button" onClick={()=>toggleModulo(modulo, acciones)} className="w-full px-3 py-2 bg-background flex items-center justify-between">
                          <span className="text-sm font-medium">{MODULO_LABELS[modulo] || modulo}</span>
                          <span className="text-xs text-muted-foreground">{acciones.filter(a => form.permissions[`${modulo}.${a}`]).length}/{acciones.length}</span>
                        </button>
                        <div className="p-3 flex flex-wrap gap-2">
                          {acciones.map(a => {
                            const key = `${modulo}.${a}`;
                            return <button type="button" key={key} onClick={()=>togglePermiso(key)} className={`text-xs rounded-full px-3 py-1 border ${form.permissions[key] ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{PERMISOS_LABELS[a] || a}</button>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={()=>setEditing(null)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl">{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </form>
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
              <option value="coordinador">Coordinador clínico</option>
              {isSuperAdmin && <option value="admin">Admin del sitio</option>}
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

/* ─── Componente principal: Usuarios / Mis empresas ───── */
const AdminPage = ({ doctor, mode = 'users' }) => {
  const isSuperAdmin = doctor?.role === 'super_admin';
  const isAdmin = doctor?.role === 'admin' || isSuperAdmin;

  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Cargar lista de empresas para el dropdown de asignación
  useEffect(() => {
    if (isAdmin) api.empresas.getAll().then(setEmpresas).catch(()=>{});
  }, [isAdmin]);

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
    if (mode === 'users') {
      loadUsers();
      if (isSuperAdmin) loadAllUsers();
    }
  }, [mode, isSuperAdmin, loadUsers, loadAllUsers]);

  const handleApprove       = async (uid) => { await api.admin.approveUser(uid); loadUsers(); };
  const handleReject        = async (uid) => { await api.admin.rejectUser(uid);  loadUsers(); };
  const handleChangeRole    = async (uid, role) => { await api.admin.changeUserRole(uid, role); loadUsers(); if(isSuperAdmin) loadAllUsers(); };
  const handleChangePw      = async (uid, pw)   => { await api.admin.changeUserPassword(uid, pw); };
  const handleToggleStatus  = async (uid) => {
    await api.admin.toggleUserStatus(uid);
    loadUsers();
    if (isSuperAdmin) loadAllUsers();
  };
  const handleDelete        = async (uid) => {
    if (!window.confirm('¿Eliminar este usuario permanentemente?')) return;
    await api.admin.deleteUser(uid); loadUsers(); if(isSuperAdmin) loadAllUsers();
  };

  const handleAssignEmpresas = async (uid, empresaIds) => {
    await api.superadmin.assignEmpresas(uid, empresaIds);
    loadAllUsers();
    loadUsers();
  };

  if (!isAdmin) return (
    <div className="text-center py-16 text-muted-foreground">No tenés permisos para esta sección.</div>
  );

  const visibleUsers = isSuperAdmin
    ? allUsers
    : [...users, ...pendingUsers.filter(p => !users.some(u => u.id === p.id))];

  if (mode === 'empresas') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" style={{color:'var(--empresa-primary)'}} />
            Mis empresas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Datos, tema y configuración de las empresas asignadas.
          </p>
        </div>
        <EmpresasPanel isSuperAdmin={isSuperAdmin} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <Users className="w-6 h-6" style={{color:'var(--empresa-primary)'}} />
          Usuarios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión de usuarios, roles, empresas asignadas y permisos.
        </p>
        </div>
        <Button onClick={()=>setShowCreateUser(true)} size="sm" className="gap-2 rounded-xl">
          <Plus className="w-4 h-4"/> Crear usuario
        </Button>
      </div>

      {loadingUsers ? <div className="text-center py-8 text-muted-foreground">Cargando...</div> : (
        <UsuariosList
          users={visibleUsers} empresas={empresas}
          currentUser={doctor}
          onDelete={handleDelete}
          isSuperAdmin={isSuperAdmin}
          onSaved={() => { loadUsers(); if(isSuperAdmin) loadAllUsers(); }}
        />
      )}

      {showCreateUser && (
        <CreateUserModal
          onClose={() => setShowCreateUser(false)}
          onCreated={() => { loadUsers(); if(isSuperAdmin) loadAllUsers(); }}
          empresas={empresas}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
};

export default AdminPage;
