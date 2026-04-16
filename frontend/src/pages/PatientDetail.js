import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ArrowLeft, Plus, Trash2, Edit2, Download, X,
  Phone, MapPin, Briefcase, Shield, ClipboardList,
  Pill, FolderOpen, History, Calendar, Search,
  ChevronDown, ChevronUp, Filter, User, Weight, Heart, AlertCircle,
  FileText, Check, Activity
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ─── Helpers ─────────────────────────────────────────── */
const formatDate = (str) => {
  if (!str) return '—';
  try {
    const s = typeof str === 'string' ? str.split('T')[0] : null;
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric' });
    }
    return new Date(str).toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return str; }
};

const formatDateTime = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return str; }
};

/* ─── Modal genérico ──────────────────────────────────── */
const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="font-bold text-lg text-foreground">{title}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════
   PANEL: INDICACIONES / RECETA
═══════════════════════════════════════════════════════ */
const IndicacionesPanel = ({ patientId, labels }) => {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ medications: '', instructions: '', diagnosis: '' });
  const [saving, setSaving]       = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [certDownloading, setCertDownloading] = useState(null);
  const isFisio = labels.profesional === 'Fisioterapeuta';

  const labelSingular = labels.indicaciones || 'Indicaciones';

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.prescriptions.getByPatient(patientId)) || []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ medications: '', instructions: '', diagnosis: '' });
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({ medications: item.medications || '', instructions: item.instructions || '', diagnosis: item.diagnosis || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) await api.prescriptions.update(editing.id, form);
      else         await api.prescriptions.create({ ...form, patient_id: patientId });
      setShowModal(false); load();
    } catch (err) { alert(err?.response?.data?.detail || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Eliminar ${labelSingular.toLowerCase()}?`)) return;
    await api.prescriptions.delete(id); load();
  };

  const handlePDF = async (id) => {
    setDownloading(id);
    try {
      const blob = await api.prescriptions.getPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${labelSingular.toLowerCase()}-${id.slice(0,8)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar PDF'); }
    finally { setDownloading(null); }
  };

  const handleCertificado = async (id) => {
    setCertDownloading(id);
    try {
      const blob = await api.prescriptions.getCertificadoPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `certificado-fisioterapia-${id.slice(0,8)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar certificado'); }
    finally { setCertDownloading(null); }
  };

  const medicLabel = isFisio ? 'Ejercicios / Indicaciones' : 'Medicamentos';

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">{labelSingular} ({items.length})</h3>
        <Button onClick={openCreate} size="sm" className="gap-1 rounded-xl">
          <Plus className="w-3.5 h-3.5" /> Nueva {labelSingular.toLowerCase()}
        </Button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{formatDate(item.date)}</span>
                </div>
                {item.diagnosis && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Diagnóstico: </span>
                    <span className="text-sm text-foreground">{item.diagnosis}</span>
                  </div>
                )}
                {item.medications && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{medicLabel}: </span>
                    <span className="text-sm text-foreground whitespace-pre-line">{item.medications}</span>
                  </div>
                )}
                {item.instructions && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Instrucciones: </span>
                    <span className="text-sm text-foreground">{item.instructions}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 ml-3 flex-shrink-0">
                <button onClick={() => handlePDF(item.id)} disabled={downloading === item.id}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600"
                        title="Descargar PDF receta">
                  {downloading === item.id
                    ? <div className="w-3.5 h-3.5 border border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                </button>
                {isFisio && (
                  <button onClick={() => handleCertificado(item.id)} disabled={certDownloading === item.id}
                          className="p-1.5 rounded-lg hover:bg-pink-50 text-muted-foreground hover:text-pink-600"
                          title="Certificado fisioterapéutico PDF">
                    {certDownloading === item.id
                      ? <div className="w-3.5 h-3.5 border border-pink-300 border-t-pink-600 rounded-full animate-spin" />
                      : <FileText className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Pill className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p>Sin {labelSingular.toLowerCase()} registradas</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={`${editing ? 'Editar' : 'Nueva'} ${labelSingular}`} onClose={() => setShowModal(false)} wide>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label>Diagnóstico / Motivo</Label>
              <Input value={form.diagnosis} onChange={e => setForm(f=>({...f, diagnosis: e.target.value}))}
                     placeholder="Diagnóstico o motivo de la consulta" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>{medicLabel}</Label>
              <textarea value={form.medications} onChange={e => setForm(f=>({...f, medications: e.target.value}))}
                        rows={5}
                        placeholder={labels.profesional === 'Fisioterapeuta'
                          ? 'Ej:\n1. Estiramiento de isquiotibiales — 3 series x 30s\n2. Ejercicio de fortalecimiento...'
                          : 'Ej:\n- Ibuprofeno 400mg — 1 comprimido cada 8 horas x 5 días\n- Omeprazol 20mg...'}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Instrucciones adicionales</Label>
              <textarea value={form.instructions} onChange={e => setForm(f=>({...f, instructions: e.target.value}))}
                        rows={2} placeholder="Indicaciones de uso, recomendaciones..."
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PANEL: HISTORIAL MÉDICO — con buscador + expandir
═══════════════════════════════════════════════════════ */
const HISTORY_CATEGORIES = [
  { value: '', label: 'Todas las categorías' },
  { value: 'antecedente', label: 'Antecedente' },
  { value: 'alergia', label: 'Alergia' },
  { value: 'cirugia', label: 'Cirugía' },
  { value: 'enfermedad_cronica', label: 'Enfermedad crónica' },
  { value: 'medicacion_actual', label: 'Medicación actual' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'otro', label: 'Otro' },
];

const CATEGORY_COLORS = {
  antecedente: 'bg-blue-100 text-blue-700',
  alergia: 'bg-red-100 text-red-700',
  cirugia: 'bg-purple-100 text-purple-700',
  enfermedad_cronica: 'bg-orange-100 text-orange-700',
  medicacion_actual: 'bg-green-100 text-green-700',
  consulta: 'bg-cyan-100 text-cyan-700',
  otro: 'bg-gray-100 text-gray-600',
};

const HistorialPanel = ({ patientId }) => {
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [expanded, setExpanded]       = useState({});   // { id: true }
  const [showModal, setShowModal]     = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm]               = useState({ category: 'otro', description: '', date: '' });
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await api.medicalHistory.getByPatient(patientId)) || []); }
    catch { setEntries([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingEntry(null);
    setForm({ category: 'otro', description: '', date: '' });
    setShowModal(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setForm({ category: entry.category || 'otro', description: entry.description || '', date: entry.date || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingEntry) await api.medicalHistory.update(editingEntry.id, form);
      else              await api.medicalHistory.create(patientId, form);
      setShowModal(false); load();
    }
    catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await api.medicalHistory.delete(id); load();
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const PREVIEW_LENGTH = 150;

  // Filtro local
  const filtered = entries.filter(e => {
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Historial médico ({filtered.length}{filtered.length !== entries.length ? ` de ${entries.length}` : ''})</h3>
        <Button onClick={openCreate} size="sm" className="gap-1 rounded-xl">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Buscar en historial..."
                 className="pl-8 rounded-xl text-sm py-1.5 border-border" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="border border-border rounded-xl px-2.5 py-1.5 text-sm bg-background">
            {HISTORY_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(e => {
          const isLong    = (e.description?.length || 0) > PREVIEW_LENGTH;
          const isExpanded = expanded[e.id];
          const displayText = isLong && !isExpanded
            ? e.description.slice(0, PREVIEW_LENGTH) + '…'
            : e.description;
          const catColor = CATEGORY_COLORS[e.category] || 'bg-gray-100 text-gray-600';
          const catLabel = HISTORY_CATEGORIES.find(c => c.value === e.category)?.label || e.category;

          return (
            <div key={e.id} className={`bg-white border border-border rounded-2xl px-4 py-3 transition-all ${isExpanded ? 'shadow-sm' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0 ${catColor}`}>
                      {catLabel}
                    </span>
                    {e.date && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(e.date)}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{displayText}</p>
                  {isLong && (
                    <button
                      onClick={() => toggleExpand(e.id)}
                      className="mt-1.5 text-xs flex items-center gap-1 font-medium"
                      style={{ color: 'var(--empresa-primary)' }}
                    >
                      {isExpanded
                        ? <><ChevronUp className="w-3 h-3" /> Ver menos</>
                        : <><ChevronDown className="w-3 h-3" /> Ver todo ({e.description.length} caracteres)</>}
                    </button>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(e)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(e.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <History className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p>{entries.length === 0 ? 'Sin historial médico registrado' : 'No hay resultados para esta búsqueda'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editingEntry ? 'Editar registro' : 'Nuevo registro en historial'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <Label>Categoría</Label>
              <select value={form.category} onChange={e => setForm(f=>({...f, category: e.target.value}))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
                {HISTORY_CATEGORIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Fecha (opcional)</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f=>({...f, date: e.target.value}))}
                     className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Descripción *</Label>
              <textarea value={form.description} onChange={e => setForm(f=>({...f, description: e.target.value}))}
                        rows={4} required placeholder="Describe el antecedente, alergia, cirugía, etc..."
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'Guardando...' : editingEntry ? 'Guardar cambios' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PANEL: ARCHIVOS
═══════════════════════════════════════════════════════ */
const ArchivosPanel = ({ patientId }) => {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFiles((await api.files.getByPatient(patientId)) || []); }
    catch { setFiles([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { await api.files.upload(patientId, file); load(); }
    catch { alert('Error al subir archivo'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar archivo?')) return;
    await api.files.delete(id); load();
  };

  const getIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📄'; if (['doc','docx'].includes(ext)) return '📝';
    return '📎';
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Archivos ({files.length})</h3>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--empresa-primary)' }}>
            {uploading
              ? <><div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" /> Subiendo...</>
              : <><Plus className="w-3.5 h-3.5" /> Subir archivo</>}
          </span>
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <div className="grid gap-2">
        {files.map(f => (
          <div key={f.id} className="bg-white border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getIcon(f.filename || f.file_url)}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{f.filename || 'Archivo'}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(f.created_at)}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <a href={`${BACKEND_URL}${f.file_url}`} target="_blank" rel="noopener noreferrer"
                 className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-500">
                <Download className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => handleDelete(f.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {files.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mx-auto opacity-30 mb-2" /><p>Sin archivos adjuntos</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PANEL: CITAS
═══════════════════════════════════════════════════════ */
const CitasPanel = ({ patientId }) => {
  const [citas, setCitas]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ date: '', time: '', reason: '', status: 'scheduled' });
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCitas((await api.appointments.getByPatient(patientId)) || []); }
    catch { setCitas([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.appointments.create({ ...form, patient_id: patientId }); setShowModal(false); load(); }
    catch { alert('Error al guardar cita'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar cita?')) return;
    await api.appointments.delete(id); load();
  };

  const statusMap = {
    scheduled: { label: 'Programada', cls: 'bg-blue-100 text-blue-700' },
    completed:  { label: 'Realizada',  cls: 'bg-green-100 text-green-700' },
    cancelled:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700' },
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Citas ({citas.length})</h3>
        <Button onClick={() => { setForm({ date: '', time: '', reason: '', status: 'scheduled' }); setShowModal(true); }}
                size="sm" className="gap-1 rounded-xl">
          <Plus className="w-3.5 h-3.5" /> Nueva cita
        </Button>
      </div>
      <div className="space-y-2">
        {citas.map(c => {
          const st = statusMap[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-600' };
          return (
            <div key={c.id} className="bg-white border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(c.date)}{c.time ? ` — ${c.time}` : ''}
                  </span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                </div>
                {c.reason && <p className="text-xs text-muted-foreground mt-1 ml-6">{c.reason}</p>}
              </div>
              <button onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {citas.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto opacity-30 mb-2" /><p>Sin citas registradas</p>
          </div>
        )}
      </div>
      {showModal && (
        <Modal title="Nueva Cita" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="rounded-xl" required /></div>
              <div className="space-y-1"><Label>Hora</Label><Input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label>Motivo</Label><Input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Motivo..." className="rounded-xl" /></div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background">
                <option value="scheduled">Programada</option>
                <option value="completed">Realizada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={()=>setShowModal(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl">{saving?'Guardando...':'Guardar'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════ */
const TABS = [
  { id: 'indicaciones', label: null /* dinámico */ },
  { id: 'historial',    label: 'Historial' },
  { id: 'archivos',     label: 'Archivos' },
  { id: 'citas',        label: 'Citas' },
];

const PatientDetail = () => {
  const { patientId } = useParams();
  const navigate      = useNavigate();
  const { labels }    = useEmpresa();
  const [patient,  setPatient]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('indicaciones');
  const [exporting, setExporting] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusValue,   setStatusValue]   = useState('');
  const [savingStatus,  setSavingStatus]  = useState(false);

  const loadPatient = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.patients.getById(patientId);
      setPatient(data);
      setStatusValue(data.current_status || '');
    }
    catch { navigate('/patients'); }
    finally { setLoading(false); }
  }, [patientId, navigate]);

  useEffect(() => { loadPatient(); }, [loadPatient]);

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    try {
      await api.patients.update(patientId, { current_status: statusValue });
      setPatient(p => ({ ...p, current_status: statusValue }));
      setEditingStatus(false);
    } catch { alert('Error al guardar estado'); }
    finally { setSavingStatus(false); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await api.export.patientPDF(patientId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `paciente-${patient?.name?.replace(/\s/g,'-')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar PDF'); }
    finally { setExporting(false); }
  };

  const tabLabel = (id) => {
    if (id === 'indicaciones') return labels.indicaciones || 'Indicaciones';
    return TABS.find(t => t.id === id)?.label || id;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin w-8 h-8 border-2 border-gray-300 rounded-full"
           style={{ borderTopColor: 'var(--empresa-primary)' }} />
    </div>
  );
  if (!patient) return null;

  const p = patient;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/patients" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Pacientes
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{p.name}</span>
      </div>

      {/* ── Ficha del paciente ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-2xl font-bold"
                 style={{ backgroundColor: 'var(--empresa-primary)' }}>
              {p.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading text-foreground">{p.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {p.cedula    && <span className="text-sm text-muted-foreground">CI: {p.cedula}</span>}
                {p.ci_ruc    && <span className="text-sm text-muted-foreground">RUC: {p.ci_ruc}{p.ci_dv ? `-${p.ci_dv}` : ''}</span>}
                {p.age       && <span className="text-sm text-muted-foreground">{p.age} años</span>}
                {p.nationality && <span className="text-sm text-muted-foreground">{p.nationality}</span>}
                {p.phone     && <span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.phone}</span>}
                {p.address   && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
                {p.occupation && <span className="text-sm text-muted-foreground flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{p.occupation}</span>}
              </div>

              {/* Seguro */}
              {p.insurance_name && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-sm text-blue-600 font-medium">{p.insurance_name}</span>
                  {p.insurance_number && <span className="text-xs text-muted-foreground">#{p.insurance_number}</span>}
                </div>
              )}

              {/* Campos extendidos (Equilibrio) */}
              {labels.extendedPatient && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {p.sexo              && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/>{p.sexo.charAt(0).toUpperCase()+p.sexo.slice(1)}</span>}
                  {p.peso              && <span className="text-xs text-muted-foreground flex items-center gap-1"><Weight className="w-3 h-3"/>{p.peso} kg</span>}
                  {p.estado_civil      && <span className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3"/>{p.estado_civil.replace('_',' ')}</span>}
                  {p.contacto_emergencia && <span className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{p.contacto_emergencia}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}
                    className="gap-2 rounded-xl">
              {exporting
                ? <><div className="w-3.5 h-3.5 border border-gray-300 border-t-gray-600 rounded-full animate-spin"/>PDF...</>
                : <><Download className="w-3.5 h-3.5"/>Exportar PDF</>}
            </Button>
          </div>
        </div>

        {/* Antecedentes médicos de la ficha */}
        {p.medical_history && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" /> Antecedentes generales
            </p>
            <p className="text-sm text-foreground whitespace-pre-line">{p.medical_history}</p>
          </div>
        )}

        {/* Estado actual / evolución */}
        <div className={`mt-4 pt-4 border-t border-border`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Estado actual / Evolución
            </p>
            {!editingStatus && (
              <button onClick={() => { setStatusValue(p.current_status || ''); setEditingStatus(true); }}
                      className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <Edit2 className="w-3 h-3" /> Editar
              </button>
            )}
          </div>
          {editingStatus ? (
            <div className="space-y-2">
              <textarea
                value={statusValue}
                onChange={e => setStatusValue(e.target.value)}
                rows={3}
                placeholder="Describe el estado actual del paciente, evolución del tratamiento..."
                className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingStatus(false)} className="rounded-xl">Cancelar</Button>
                <Button size="sm" onClick={handleSaveStatus} disabled={savingStatus} className="rounded-xl gap-1">
                  {savingStatus ? 'Guardando...' : <><Check className="w-3.5 h-3.5" /> Guardar</>}
                </Button>
              </div>
            </div>
          ) : (
            p.current_status
              ? <p className="text-sm text-foreground whitespace-pre-line">{p.current_status}</p>
              : <p className="text-sm text-muted-foreground italic">Sin estado actual registrado. Haz clic en "Editar" para agregar.</p>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted p-1 rounded-2xl overflow-x-auto">
        {TABS.map(({ id }) => (
          <button key={id} onClick={() => setTab(id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    tab === id ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
            {tabLabel(id)}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      <div className="bg-muted/30 rounded-2xl p-4 min-h-[300px]">
        {tab === 'indicaciones' && <IndicacionesPanel patientId={patientId} labels={labels} />}
        {tab === 'historial'    && <HistorialPanel    patientId={patientId} />}
        {tab === 'archivos'     && <ArchivosPanel     patientId={patientId} />}
        {tab === 'citas'        && <CitasPanel        patientId={patientId} />}
      </div>
    </div>
  );
};

export default PatientDetail;
