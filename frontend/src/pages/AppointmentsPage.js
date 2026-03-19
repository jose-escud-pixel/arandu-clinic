import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ patient_id: '', date: '', reason: '', notes: '' });
  const [editData, setEditData] = useState({ date: '', reason: '', notes: '', status: 'scheduled' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctorList, setDoctorList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('doctor');
    if (stored) {
      const doc = JSON.parse(stored);
      setIsAdmin(doc.role === 'admin');
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appointmentsData, patientsData] = await Promise.all([api.appointments.getAll(), api.patients.getAll()]);
      setAppointments(appointmentsData);
      setPatients(patientsData);
      // Extract unique doctors
      const doctors = {};
      appointmentsData.forEach((a) => {
        if (a.doctor_id && !doctors[a.doctor_id]) {
          doctors[a.doctor_id] = a.doctor_name || a.doctor_id;
        }
      });
      setDoctorList(Object.entries(doctors).map(([id, name]) => ({ id, name })));
    } catch (error) { toast.error('Error al cargar citas'); }
    finally { setLoading(false); }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.appointments.create(formData);
      toast.success('Cita agendada exitosamente');
      setShowNewDialog(false);
      setFormData({ patient_id: '', date: '', reason: '', notes: '' });
      loadData();
    } catch (error) { toast.error('Error al agendar cita'); }
  };

  const handleEditAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.appointments.update(editingId, editData);
      toast.success('Cita actualizada');
      setShowEditDialog(false);
      setEditingId(null);
      loadData();
    } catch (error) { toast.error('Error al actualizar cita'); }
  };

  const handleDeleteAppointment = async () => {
    try {
      await api.appointments.delete(deleteTarget.id);
      toast.success('Cita eliminada');
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      loadData();
    } catch (error) { toast.error('Error al eliminar cita'); }
  };

  const getPatientName = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? patient.name : 'Desconocido';
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Cargando...</div></div>;

  let filteredAppointments = [...appointments];
  if (doctorFilter !== 'all') {
    filteredAppointments = filteredAppointments.filter((a) => a.doctor_id === doctorFilter);
  }
  if (searchQuery) {
    filteredAppointments = filteredAppointments.filter((a) => {
      const pName = getPatientName(a.patient_id).toLowerCase();
      return pName.includes(searchQuery.toLowerCase()) || a.reason.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }
  const sortedAppointments = filteredAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div data-testid="appointments-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">Citas</h1>
          <p className="text-sm sm:text-base text-charcoal-600 mt-1 sm:mt-2">{isAdmin ? 'Todas las citas de la clínica' : 'Gestiona las citas de tus pacientes'}</p>
        </div>
        <Button data-testid="new-appointment-button" onClick={() => setShowNewDialog(true)} className="rounded-full bg-primary text-white hover:bg-primary/90 shadow-md w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />Nueva Cita
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            data-testid="search-appointments-input"
            placeholder="Buscar por paciente o motivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 rounded-xl bg-white border-border shadow-card"
          />
        </div>
        {isAdmin && doctorList.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <select
              data-testid="doctor-filter-appointments"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-14 rounded-xl bg-white border border-border px-4 shadow-card text-sm min-w-[200px]"
            >
              <option value="all">Todos los doctores</option>
              {doctorList.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Agendar Nueva Cita</DialogTitle><DialogDescription>Selecciona paciente, fecha y motivo</DialogDescription></DialogHeader>
          <form onSubmit={handleCreateAppointment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <select data-testid="appointment-patient-select" value={formData.patient_id} onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })} required className="w-full h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E0D6] px-3">
                <option value="">Seleccionar paciente</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.cedula}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Fecha y Hora</Label><Input data-testid="appointment-date-input" type="datetime-local" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Motivo</Label><Input data-testid="appointment-reason-input" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea data-testid="appointment-notes-input" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button data-testid="submit-appointment-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Agendar Cita</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-heading">Editar Cita</DialogTitle><DialogDescription>Modifica los datos de la cita</DialogDescription></DialogHeader>
          <form onSubmit={handleEditAppointment} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Fecha y Hora</Label><Input type="datetime-local" value={editData.date} onChange={(e) => setEditData({ ...editData, date: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2"><Label>Motivo</Label><Input value={editData.reason} onChange={(e) => setEditData({ ...editData, reason: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="w-full h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E0D6] px-3">
                <option value="scheduled">Programada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={3} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" /></div>
            <Button type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-heading text-red-600">Confirmar Eliminación</DialogTitle><DialogDescription>Esta acción no se puede deshacer</DialogDescription></DialogHeader>
          <p className="text-charcoal-700 mt-2">Estas seguro de eliminar la cita <strong>{deleteTarget?.label}</strong>?</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-full">Cancelar</Button>
            <Button onClick={handleDeleteAppointment} className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600">Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {sortedAppointments.length === 0 ? (
        <Card className="border-border shadow-card rounded-2xl">
          <CardContent className="py-16 text-center"><CalendarIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">{searchQuery || doctorFilter !== 'all' ? 'No se encontraron citas' : 'No hay citas programadas aun'}</p></CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAppointments.map((appointment) => (
            <Card key={appointment.id} data-testid={`appointment-card-${appointment.id}`} className="border-border shadow-card hover:shadow-hover transition-all rounded-2xl">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-heading text-charcoal-900">{getPatientName(appointment.patient_id)}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{format(new Date(appointment.date), "d 'de' MMMM, yyyy", { locale: es })}</p>
                    {isAdmin && appointment.doctor_name && (
                      <p className="text-xs mt-1 px-2 py-0.5 bg-primary/5 rounded-lg inline-block">{appointment.doctor_name}</p>
                    )}
                  </div>
                  <Badge variant={appointment.status === 'scheduled' ? 'default' : 'secondary'} className="rounded-full">
                    {appointment.status === 'scheduled' ? 'Programada' : appointment.status === 'completed' ? 'Completada' : 'Cancelada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div><p className="text-sm text-muted-foreground">Hora</p><p className="text-base font-medium">{format(new Date(appointment.date), 'HH:mm')}</p></div>
                  <div><p className="text-sm text-muted-foreground">Motivo</p><p className="text-base font-medium">{appointment.reason}</p></div>
                  {appointment.notes && <div><p className="text-sm text-muted-foreground">Notas</p><p className="text-sm text-charcoal-600">{appointment.notes}</p></div>}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 rounded-full text-primary border-primary hover:bg-primary/10" onClick={() => { setEditingId(appointment.id); setEditData({ date: new Date(appointment.date).toISOString().slice(0, 16), reason: appointment.reason, notes: appointment.notes || '', status: appointment.status }); setShowEditDialog(true); }}>
                      <Edit className="w-4 h-4 mr-1" />Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-full text-red-500 border-red-400 hover:bg-red-50" onClick={() => { setDeleteTarget({ id: appointment.id, label: appointment.reason }); setShowDeleteConfirm(true); }}>
                      <Trash2 className="w-4 h-4 mr-1" />Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
