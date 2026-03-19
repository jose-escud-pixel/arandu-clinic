import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Search, User, Filter, Stethoscope } from 'lucide-react';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('basic'); // 'basic' or 'advanced'
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showNewPatientDialog, setShowNewPatientDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctorList, setDoctorList] = useState([]);
  const [insuranceFilter, setInsuranceFilter] = useState('all');
  const [insuranceList, setInsuranceList] = useState([]);
  const [formData, setFormData] = useState({
    name: '', age: '', cedula: '', nationality: '', address: '', occupation: '', phone: '', insurance_name: '', insurance_number: '', medical_history: '',
  });

  useEffect(() => {
    const stored = localStorage.getItem('doctor');
    if (stored) {
      const doc = JSON.parse(stored);
      setIsAdmin(doc.role === 'admin');
    }
    loadPatients();
  }, []);

  // Basic filtering (name/cedula - client side)
  useEffect(() => {
    if (searchMode === 'advanced') return;
    let result = patients;
    if (doctorFilter !== 'all') {
      result = result.filter((p) => p.doctor_id === doctorFilter);
    }
    if (insuranceFilter !== 'all') {
      if (insuranceFilter === 'none') {
        result = result.filter((p) => !p.insurance_name);
      } else {
        result = result.filter((p) => p.insurance_name === insuranceFilter);
      }
    }
    if (searchQuery) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.cedula.includes(searchQuery)
      );
    }
    setFilteredPatients(result);
  }, [searchQuery, patients, doctorFilter, insuranceFilter, searchMode]);

  // Advanced search (diagnosis/consultation - server side) with debounce
  const doAdvancedSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setFilteredPatients(patients);
      return;
    }
    setSearching(true);
    try {
      const results = await api.patients.advancedSearch(query);
      let filtered = results;
      if (doctorFilter !== 'all') {
        filtered = filtered.filter((p) => p.doctor_id === doctorFilter);
      }
      if (insuranceFilter !== 'all') {
        if (insuranceFilter === 'none') {
          filtered = filtered.filter((p) => !p.insurance_name);
        } else {
          filtered = filtered.filter((p) => p.insurance_name === insuranceFilter);
        }
      }
      setFilteredPatients(filtered);
    } catch (error) {
      toast.error('Error en la búsqueda');
    } finally {
      setSearching(false);
    }
  }, [patients, doctorFilter]);

  useEffect(() => {
    if (searchMode !== 'advanced') return;
    const timer = setTimeout(() => {
      doAdvancedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, doAdvancedSearch]);

  const loadPatients = async () => {
    try {
      const data = await api.patients.getAll();
      setPatients(data);
      setFilteredPatients(data);
      // Extract unique doctors for the filter
      const doctors = {};
      data.forEach((p) => {
        if (p.doctor_id && !doctors[p.doctor_id]) {
          doctors[p.doctor_id] = p.doctor_name || p.doctor_id;
        }
      });
      setDoctorList(Object.entries(doctors).map(([id, name]) => ({ id, name })));
      // Extract unique insurance providers for the filter
      const insurances = new Set();
      data.forEach((p) => {
        if (p.insurance_name) {
          insurances.add(p.insurance_name);
        }
      });
      setInsuranceList(Array.from(insurances).sort());
    } catch (error) {
      toast.error('Error al cargar pacientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      await api.patients.create({ ...formData, age: parseInt(formData.age) });
      toast.success('Paciente creado exitosamente');
      setShowNewPatientDialog(false);
      setFormData({ name: '', age: '', cedula: '', nationality: '', address: '', occupation: '', phone: '', insurance_name: '', insurance_number: '', medical_history: '' });
      loadPatients();
    } catch (error) {
      toast.error('Error al crear paciente');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="patients-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">
            Pacientes
          </h1>
          <p className="text-sm sm:text-base text-charcoal-600 mt-1 sm:mt-2">
            {isAdmin ? 'Todos los pacientes de la clínica' : 'Gestiona la información de tus pacientes'}
          </p>
        </div>
        <Button
          data-testid="new-patient-button"
          onClick={() => setShowNewPatientDialog(true)}
          className="rounded-full bg-primary text-white hover:bg-primary/90 shadow-md w-full sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Paciente
        </Button>
        <Dialog open={showNewPatientDialog} onOpenChange={setShowNewPatientDialog}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl" data-testid="new-patient-dialog">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">Nuevo Paciente</DialogTitle>
              <DialogDescription>Completa los datos del nuevo paciente</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePatient} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input id="name" data-testid="patient-name-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Edad *</Label>
                  <Input id="age" data-testid="patient-age-input" type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula">Cédula de Identidad *</Label>
                  <Input id="cedula" data-testid="patient-cedula-input" value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nacionalidad</Label>
                  <Input id="nationality" data-testid="patient-nationality-input" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} placeholder="Ej: Paraguaya" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input id="phone" data-testid="patient-phone-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Ocupación *</Label>
                  <Input id="occupation" data-testid="patient-occupation-input" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Domicilio *</Label>
                <Input id="address" data-testid="patient-address-input" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insurance_name">Nombre del Seguro</Label>
                  <Input id="insurance_name" data-testid="patient-insurance-name-input" value={formData.insurance_name} onChange={(e) => setFormData({ ...formData, insurance_name: e.target.value })} placeholder="Ej: IPS, Asismed, etc." className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurance_number">Nro. Carnet del Seguro</Label>
                  <Input id="insurance_number" data-testid="patient-insurance-number-input" value={formData.insurance_number} onChange={(e) => setFormData({ ...formData, insurance_number: e.target.value })} placeholder="Número de carnet" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical_history">Historial Médico (operaciones, lesiones) *</Label>
                <Textarea id="medical_history" data-testid="patient-history-input" value={formData.medical_history} onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })} required rows={4} className="rounded-xl bg-[#FAF9F6] border-[#E5E0D6]" />
              </div>
              <Button data-testid="submit-patient-button" type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">
                Crear Paciente
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            data-testid="search-mode-basic"
            variant={searchMode === 'basic' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full text-xs"
            onClick={() => { setSearchMode('basic'); setSearchQuery(''); }}
          >
            <Search className="w-3.5 h-3.5 mr-1" />Nombre / Cédula
          </Button>
          <Button
            data-testid="search-mode-advanced"
            variant={searchMode === 'advanced' ? 'default' : 'outline'}
            size="sm"
            className="rounded-full text-xs"
            onClick={() => { setSearchMode('advanced'); setSearchQuery(''); }}
          >
            <Stethoscope className="w-3.5 h-3.5 mr-1" />Diagnóstico / Consulta
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              data-testid="search-patients-input"
              placeholder={searchMode === 'basic' ? 'Buscar por nombre o cédula...' : 'Buscar por diagnóstico, tratamiento, historial...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 rounded-xl bg-white border-border shadow-card"
            />
            {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-primary">Buscando...</span>}
          </div>
          {isAdmin && doctorList.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <select
                data-testid="doctor-filter-select"
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
          <div className="flex items-center gap-2">
            <select
              data-testid="insurance-filter-select"
              value={insuranceFilter}
              onChange={(e) => setInsuranceFilter(e.target.value)}
              className="h-14 rounded-xl bg-white border border-border px-4 shadow-card text-sm min-w-[180px]"
            >
              <option value="all">Todos los seguros</option>
              <option value="none">Sin seguro</option>
              {insuranceList.map((ins) => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <Card className="border-border shadow-card rounded-2xl">
          <CardContent className="py-16 text-center">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || doctorFilter !== 'all' || insuranceFilter !== 'all' ? 'No se encontraron pacientes' : 'No hay pacientes aún'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <Link key={patient.id} to={`/patients/${patient.id}`}>
              <Card
                data-testid={`patient-card-${patient.id}`}
                className="border-border shadow-card hover:shadow-hover transition-all rounded-2xl cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-semibold text-lg">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <Badge
                      variant={patient.status === 'active' ? 'default' : 'secondary'}
                      className="rounded-full px-3 py-1"
                    >
                      {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-semibold font-heading text-charcoal-900 mb-2">
                    {patient.name}
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Cédula: {patient.cedula}</p>
                    <p>Edad: {patient.age} años</p>
                    <p>Teléfono: {patient.phone}</p>
                    {patient.insurance_name && (
                      <p className="text-xs mt-2 px-2 py-1 bg-secondary/10 text-secondary rounded-lg inline-block">
                        {patient.insurance_name}
                      </p>
                    )}
                    {isAdmin && patient.doctor_name && (
                      <p className="text-xs mt-2 ml-1 px-2 py-1 bg-primary/5 rounded-lg inline-block">
                        {patient.doctor_name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
