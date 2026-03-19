import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Plus, Calendar, FileText, Image as ImageIcon, Download, Upload, Printer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PatientDetail = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [files, setFiles] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showEditConsultation, setShowEditConsultation] = useState(false);
  const [showEditAppointment, setShowEditAppointment] = useState(false);
  const [showEditPrescription, setShowEditPrescription] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [editForm, setEditForm] = useState({});
  const [consultationForm, setConsultationForm] = useState({ diagnosis: '', treatment: '', notes: '' });
  const [appointmentForm, setAppointmentForm] = useState({ date: '', reason: '', notes: '' });
  const [prescriptionForm, setPrescriptionForm] = useState({ medications: '', instructions: '', diagnosis: '' });
  const [editingId, setEditingId] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [patientId]);

  const loadData = async () => {
    try {
      const [patientData, consultationsData, appointmentsData, filesData, prescriptionsData] = await Promise.all([
        api.patients.getById(patientId),
        api.consultations.getByPatient(patientId),
        api.appointments.getByPatient(patientId),
        api.files.getByPatient(patientId),
        api.prescriptions.getByPatient(patientId),
      ]);
      setPatient(patientData);
      setEditForm(patientData);
      setConsultations(consultationsData);
      setAppointments(appointmentsData);
      setFiles(filesData);
      setPrescriptions(prescriptionsData);
    } catch (error) {
      toast.error('Error al cargar datos del paciente');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    try {
      await api.patients.update(patientId, editForm);
      toast.success('Paciente actualizado');
      setShowEditDialog(false);
      loadData();
    } catch (error) { toast.error('Error al actualizar paciente'); }
  };

  const handleDeletePatient = async () => {
    try {
      await api.patients.delete(patientId);
      toast.success('Paciente eliminado');
      navigate('/patients');
    } catch (error) { toast.error('Error al eliminar paciente'); }
  };

  const handleCreateConsultation = async (e) => {
    e.preventDefault();
    try {
      await api.consultations.create({ ...consultationForm, patient_id: patientId });
      toast.success('Consulta registrada');
      setShowConsultationDialog(false);
      setConsultationForm({ diagnosis: '', treatment: '', notes: '' });
      loadData();
    } catch (error) { toast.error('Error al registrar consulta'); }
  };

  const handleEditConsultation = async (e) => {
    e.preventDefault();
    try {
      await api.consultations.update(editingId, consultationForm);
      toast.success('Consulta actualizada');
      setShowEditConsultation(false);
      setEditingId(null);
      setConsultationForm({ diagnosis: '', treatment: '', notes: '' });
      loadData();
    } catch (error) { toast.error('Error al actualizar consulta'); }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.appointments.create({ ...appointmentForm, patient_id: patientId });
      toast.success('Cita agendada');
      setShowAppointmentDialog(false);
      setAppointmentForm({ date: '', reason: '', notes: '' });
      loadData();
    } catch (error) { toast.error('Error al agendar cita'); }
  };

  const handleEditAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.appointments.update(editingId, appointmentForm);
      toast.success('Cita actualizada');
      setShowEditAppointment(false);
      setEditingId(null);
      setAppointmentForm({ date: '', reason: '', notes: '' });
      loadData();
    } catch (error) { toast.error('Error al actualizar cita'); }
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    try {
      await api.prescriptions.create({ ...prescriptionForm, patient_id: patientId });
      toast.success('Receta creada');
      setShowPrescriptionDialog(false);
      setPrescriptionForm({ medications: '', instructions: '', diagnosis: '' });
      loadData();
    } catch (error) { toast.error('Error al crear receta'); }
  };

  const handleEditPrescription = async (e) => {
    e.preventDefault();
    try {
      await api.prescriptions.update(editingId, prescriptionForm);
      toast.success('Receta actualizada');
      setShowEditPrescription(false);
      setEditingId(null);
      setPrescriptionForm({ medications: '', instructions: '', diagnosis: '' });
      loadData();
    } catch (error) { toast.error('Error al actualizar receta'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.files.upload(patientId, file);
      toast.success('Archivo subido exitosamente');
      loadData();
    } catch (error) { toast.error('Error al subir archivo'); }
    finally { setUploading(false); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await api.export.patientPDF(patientId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial_${patient.name.replace(/ /g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Historial exportado');
    } catch (error) { toast.error('Error al exportar historial'); }
    finally { setExporting(false); }
  };

  const handlePrintPrescription = async (prescriptionId) => {
    try {
      const blob = await api.prescriptions.getPDF(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receta_${patient.name.replace(/ /g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Receta descargada');
    } catch (error) { toast.error('Error al descargar receta'); }
  };

  const confirmDelete = (type, id, label) => {
    setDeleteTarget({ type, id, label });
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'patient') await handleDeletePatient();
      else if (deleteTarget.type === 'consultation') await api.consultations.delete(deleteTarget.id);
      else if (deleteTarget.type === 'appointment') await api.appointments.delete(deleteTarget.id);
      else if (deleteTarget.type === 'prescription') await api.prescriptions.delete(deleteTarget.id);
      else if (deleteTarget.type === 'file') await api.files.delete(deleteTarget.id);

      if (deleteTarget.type !== 'patient') {
        toast.success('Eliminado correctamente');
        loadData();
      }
    } catch (error) { toast.error('Error al eliminar'); }
    finally { setShowDeleteConfirm(false); setDeleteTarget(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Cargando...</div></div>;
  if (!patient) return <div>Paciente no encontrado</div>;

  return (
    <div data-testid="patient-detail-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button data-testid="back-button" variant="ghost" onClick={() => navigate('/patients')} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900 truncate">{patient.name}</h1>
          <p className="text-sm sm:text-base text-charcoal-600 mt-1">Cedula: {patient.cedula}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button data-testid="export-pdf-button" onClick={handleExportPDF} disabled={exporting} variant="outline" size="sm" className="rounded-full border-secondary text-secondary hover:bg-secondary/10">
            <Download className="w-4 h-4 mr-1" />{exporting ? 'Exportando...' : 'PDF'}
          </Button>
          <Button data-testid="edit-patient-button" onClick={() => setShowEditDialog(true)} size="sm" className="rounded-full bg-primary text-white hover:bg-primary/90">
            <Edit className="w-4 h-4 mr-1" />Editar
          </Button>
          <Button data-testid="delete-patient-button" onClick={() => confirmDelete('patient', patientId, patient.name)} variant="outline" size="sm" className="rounded-full border-red-400 text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-1" />Eliminar
          </Button>
        </div>
      </div>

      {/* Edit Patient Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading">Editar Paciente</DialogTitle>
            <DialogDescription>Modifica los datos del paciente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePatient} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input data-testid="edit-name-input" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <div className="space-y-2">
                <Label>Edad</Label>
                <Input data-testid="edit-age-input" type="number" value={editForm.age || ''} onChange={(e) => setEditForm({ ...editForm, age: parseInt(e.target.value) })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cédula</Label>
                <Input value={editForm.cedula || ''} onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <div className="space-y-2">
                <Label>Nacionalidad</Label>
                <Input data-testid="edit-nationality-input" value={editForm.nationality || ''} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} placeholder="Ej: Paraguaya" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input data-testid="edit-phone-input" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <div className="space-y-2">
                <Label>Ocupación</Label>
                <Input value={editForm.occupation || ''} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Domicilio</Label>
              <Input data-testid="edit-address-input" value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del Seguro</Label>
                <Input data-testid="edit-insurance-name-input" value={editForm.insurance_name || ''} onChange={(e) => setEditForm({ ...editForm, insurance_name: e.target.value })} placeholder="Ej: IPS, Asismed" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <div className="space-y-2">
                <Label>Nro. Carnet Seguro</Label>
                <Input data-testid="edit-insurance-number-input" value={editForm.insurance_number || ''} onChange={(e) => setEditForm({ ...editForm, insurance_number: e.target.value })} placeholder="Número de carnet" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Historial Médico</Label>
              <Textarea data-testid="edit-history-input" value={editForm.medical_history || ''} onChange={(e) => setEditForm({ ...editForm, medical_history: e.target.value })} rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <Button data-testid="save-patient-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-red-600">Confirmar Eliminación</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer</DialogDescription>
          </DialogHeader>
          <p className="text-charcoal-700 mt-2">Estas seguro de que deseas eliminar <strong>{deleteTarget?.label}</strong>?</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-full">Cancelar</Button>
            <Button data-testid="confirm-delete-button" onClick={executeDelete} className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600">Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border shadow-card rounded-2xl" data-testid="patient-info-card">
          <CardHeader><CardTitle className="text-xl font-heading">Información Personal</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-sm text-muted-foreground">Edad</p><p className="text-base font-medium">{patient.age} años</p></div>
            <div><p className="text-sm text-muted-foreground">Nacionalidad</p><p className="text-base font-medium">{patient.nationality || 'No especificada'}</p></div>
            <div><p className="text-sm text-muted-foreground">Teléfono</p><p className="text-base font-medium">{patient.phone}</p></div>
            <div><p className="text-sm text-muted-foreground">Domicilio</p><p className="text-base font-medium">{patient.address}</p></div>
            <div><p className="text-sm text-muted-foreground">Ocupación</p><p className="text-base font-medium">{patient.occupation}</p></div>
            <div><p className="text-sm text-muted-foreground">Seguro Médico</p><p className="text-base font-medium">{patient.insurance_name || 'Sin seguro'}</p></div>
            {patient.insurance_number && <div><p className="text-sm text-muted-foreground">Nro. Carnet Seguro</p><p className="text-base font-medium">{patient.insurance_number}</p></div>}
            <div><p className="text-sm text-muted-foreground">Estado</p><Badge variant={patient.status === 'active' ? 'default' : 'secondary'} className="rounded-full">{patient.status === 'active' ? 'Activo' : 'Inactivo'}</Badge></div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 border-border shadow-card rounded-2xl" data-testid="patient-history-card">
          <CardHeader><CardTitle className="text-xl font-heading">Historial Médico</CardTitle></CardHeader>
          <CardContent><p className="text-base text-charcoal-700 leading-relaxed whitespace-pre-wrap">{patient.medical_history}</p></CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="consultations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted rounded-xl">
          <TabsTrigger value="consultations" data-testid="tab-consultations" className="rounded-lg text-xs sm:text-sm">Consultas</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments" className="rounded-lg text-xs sm:text-sm">Citas</TabsTrigger>
          <TabsTrigger value="prescriptions" data-testid="tab-prescriptions" className="rounded-lg text-xs sm:text-sm">Recetas</TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-files" className="rounded-lg text-xs sm:text-sm">Archivos</TabsTrigger>
        </TabsList>

        {/* CONSULTATIONS TAB */}
        <TabsContent value="consultations" className="mt-6">
          <Card className="border-border shadow-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-heading">Historial de Consultas</CardTitle>
              <Button data-testid="new-consultation-button" onClick={() => { setConsultationForm({ diagnosis: '', treatment: '', notes: '' }); setShowConsultationDialog(true); }} className="rounded-full bg-primary text-white hover:bg-primary/90">
                <Plus className="w-5 h-5 mr-2" />Nueva Consulta
              </Button>
            </CardHeader>
            <CardContent>
              {consultations.length === 0 ? (
                <div className="text-center py-8"><FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay consultas registradas</p></div>
              ) : (
                <div className="space-y-4">
                  {consultations.map((c) => (
                    <div key={c.id} data-testid={`consultation-item-${c.id}`} className="p-4 bg-muted rounded-xl border-l-4 border-primary">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm text-muted-foreground">{format(new Date(c.date), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-primary" onClick={() => { setEditingId(c.id); setConsultationForm({ diagnosis: c.diagnosis, treatment: c.treatment, notes: c.notes }); setShowEditConsultation(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-red-500" onClick={() => confirmDelete('consultation', c.id, `Consulta del ${format(new Date(c.date), "d/MM/yyyy")}`)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-semibold text-charcoal-800 mb-1">Diagnóstico: {c.diagnosis}</h4>
                      <p className="text-sm text-charcoal-600 mb-2">Tratamiento: {c.treatment}</p>
                      <p className="text-sm text-muted-foreground">{c.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPOINTMENTS TAB */}
        <TabsContent value="appointments" className="mt-6">
          <Card className="border-border shadow-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-heading">Citas Programadas</CardTitle>
              <Button data-testid="new-appointment-button" onClick={() => { setAppointmentForm({ date: '', reason: '', notes: '' }); setShowAppointmentDialog(true); }} className="rounded-full bg-primary text-white hover:bg-primary/90">
                <Plus className="w-5 h-5 mr-2" />Nueva Cita
              </Button>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8"><Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay citas programadas</p></div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((a) => (
                    <div key={a.id} data-testid={`appointment-item-${a.id}`} className="p-4 bg-muted rounded-xl flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-charcoal-800">{a.reason}</p>
                        <p className="text-sm text-muted-foreground mt-1">{format(new Date(a.date), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}</p>
                        {a.notes && <p className="text-sm text-charcoal-600 mt-2">{a.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.status === 'scheduled' ? 'default' : 'secondary'} className="rounded-full">{a.status === 'scheduled' ? 'Programada' : 'Completada'}</Badge>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-primary" onClick={() => { setEditingId(a.id); setAppointmentForm({ date: new Date(a.date).toISOString().slice(0, 16), reason: a.reason, notes: a.notes || '', status: a.status }); setShowEditAppointment(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-red-500" onClick={() => confirmDelete('appointment', a.id, `Cita: ${a.reason}`)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRESCRIPTIONS TAB */}
        <TabsContent value="prescriptions" className="mt-6">
          <Card className="border-border shadow-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-heading">Recetas Médicas</CardTitle>
              <Button data-testid="new-prescription-button" onClick={() => { setPrescriptionForm({ medications: '', instructions: '', diagnosis: '' }); setShowPrescriptionDialog(true); }} className="rounded-full bg-primary text-white hover:bg-primary/90">
                <Plus className="w-5 h-5 mr-2" />Nueva Receta
              </Button>
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? (
                <div className="text-center py-8"><FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay recetas registradas</p></div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((p) => (
                    <div key={p.id} data-testid={`prescription-item-${p.id}`} className="p-4 bg-muted rounded-xl border-l-4 border-secondary">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">{format(new Date(p.date), "d 'de' MMMM, yyyy", { locale: es })}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="rounded-full border-secondary text-secondary hover:bg-secondary/10" onClick={() => handlePrintPrescription(p.id)}>
                            <Printer className="w-4 h-4 mr-1" />Imprimir
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-primary" onClick={() => { setEditingId(p.id); setPrescriptionForm({ medications: p.medications, instructions: p.instructions, diagnosis: p.diagnosis }); setShowEditPrescription(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-red-500" onClick={() => confirmDelete('prescription', p.id, `Receta del ${format(new Date(p.date), "d/MM/yyyy")}`)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-semibold text-charcoal-800 mb-1">Diagnóstico: {p.diagnosis}</h4>
                      <p className="text-sm text-charcoal-600 mb-2 whitespace-pre-wrap"><strong>Medicamentos:</strong> {p.medications}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap"><strong>Instrucciones:</strong> {p.instructions}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FILES TAB */}
        <TabsContent value="files" className="mt-6">
          <Card className="border-border shadow-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-heading">Archivos y Estudios</CardTitle>
              <Button data-testid="upload-file-button" onClick={() => document.getElementById('file-upload').click()} disabled={uploading} className="rounded-full bg-primary text-white hover:bg-primary/90">
                <Upload className="w-5 h-5 mr-2" />{uploading ? 'Subiendo...' : 'Subir Archivo'}
              </Button>
              <input id="file-upload" type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} data-testid="file-upload-input" />
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-8"><ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground mb-4">No hay archivos subidos aun</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {files.map((file) => (
                    <div key={file.id} data-testid={`file-item-${file.id}`} className="p-4 bg-muted rounded-xl border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><ImageIcon className="w-5 h-5 text-primary" /></div>
                          <div>
                            <p className="font-medium text-charcoal-800 text-sm">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-charcoal-600 hover:text-red-500" onClick={() => confirmDelete('file', file.id, file.file_name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {file.file_type?.startsWith('image/') && <img src={file.file_url} alt={file.file_name} className="w-full h-40 object-cover rounded-lg" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Consultation Dialog */}
      <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Nueva Consulta</DialogTitle><DialogDescription>Registra diagnóstico, tratamiento y notas</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateConsultation} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Diagnóstico</Label><Input data-testid="consultation-diagnosis-input" value={consultationForm.diagnosis} onChange={(e) => setConsultationForm({ ...consultationForm, diagnosis: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Tratamiento</Label><Input data-testid="consultation-treatment-input" value={consultationForm.treatment} onChange={(e) => setConsultationForm({ ...consultationForm, treatment: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Notas de Evolución</Label><Textarea data-testid="consultation-notes-input" value={consultationForm.notes} onChange={(e) => setConsultationForm({ ...consultationForm, notes: e.target.value })} required rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button data-testid="submit-consultation-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Registrar Consulta</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Consultation Dialog */}
      <Dialog open={showEditConsultation} onOpenChange={setShowEditConsultation}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Editar Consulta</DialogTitle><DialogDescription>Modifica los datos de la consulta</DialogDescription></DialogHeader>
          <form onSubmit={handleEditConsultation} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Diagnóstico</Label><Input value={consultationForm.diagnosis} onChange={(e) => setConsultationForm({ ...consultationForm, diagnosis: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Tratamiento</Label><Input value={consultationForm.treatment} onChange={(e) => setConsultationForm({ ...consultationForm, treatment: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={consultationForm.notes} onChange={(e) => setConsultationForm({ ...consultationForm, notes: e.target.value })} required rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <Dialog open={showAppointmentDialog} onOpenChange={setShowAppointmentDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Agendar Cita</DialogTitle><DialogDescription>Programa una nueva cita para el paciente</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateAppointment} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Fecha y Hora</Label><Input data-testid="appointment-date-input" type="datetime-local" value={appointmentForm.date} onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Motivo</Label><Input data-testid="appointment-reason-input" value={appointmentForm.reason} onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea data-testid="appointment-notes-input" value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} rows={3} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button data-testid="submit-appointment-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Agendar Cita</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={showEditAppointment} onOpenChange={setShowEditAppointment}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Editar Cita</DialogTitle><DialogDescription>Modifica los datos de la cita</DialogDescription></DialogHeader>
          <form onSubmit={handleEditAppointment} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Fecha y Hora</Label><Input type="datetime-local" value={appointmentForm.date} onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Motivo</Label><Input value={appointmentForm.reason} onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select value={appointmentForm.status || 'scheduled'} onChange={(e) => setAppointmentForm({ ...appointmentForm, status: e.target.value })} className="w-full h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E0D6] px-3">
                <option value="scheduled">Programada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} rows={3} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Prescription Dialog */}
      <Dialog open={showPrescriptionDialog} onOpenChange={setShowPrescriptionDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Nueva Receta</DialogTitle><DialogDescription>Crea una receta medica para el paciente</DialogDescription></DialogHeader>
          <form onSubmit={handleCreatePrescription} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Diagnóstico</Label><Input data-testid="prescription-diagnosis-input" value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Medicamentos</Label><Textarea data-testid="prescription-medications-input" value={prescriptionForm.medications} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medications: e.target.value })} required rows={4} placeholder="Ej: Ibuprofeno 600mg - 1 cada 8 horas" className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Instrucciones</Label><Textarea data-testid="prescription-instructions-input" value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })} required rows={4} placeholder="Ej: Tomar con alimentos. Reposo 5 dias." className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button data-testid="submit-prescription-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Crear Receta</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Prescription Dialog */}
      <Dialog open={showEditPrescription} onOpenChange={setShowEditPrescription}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Editar Receta</DialogTitle><DialogDescription>Modifica los datos de la receta</DialogDescription></DialogHeader>
          <form onSubmit={handleEditPrescription} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Diagnóstico</Label><Input value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Medicamentos</Label><Textarea value={prescriptionForm.medications} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medications: e.target.value })} required rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Instrucciones</Label><Textarea value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })} required rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientDetail;
