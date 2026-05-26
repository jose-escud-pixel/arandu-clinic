import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@/App.css';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PatientsPage from './pages/PatientsPage';
import PatientDetail from './pages/PatientDetail';
import AppointmentsPage from './pages/AppointmentsPage';
import AdvancedStatsPage from './pages/AdvancedStatsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ActivityLogPage from './pages/ActivityLogPage';
import Layout from './components/Layout';
import { api, CLINIC_TOKEN_KEY, CLINIC_DOCTOR_KEY } from './lib/api';
import { EmpresaProvider, useEmpresa } from './context/EmpresaContext';

function AppRoutes() {
  const [token, setToken] = useState(localStorage.getItem(CLINIC_TOKEN_KEY));
  const [doctor, setDoctor] = useState(null);
  const [empresasList, setEmpresasList] = useState([]);
  const { applyFromUser, setEmpresa, resetTheme } = useEmpresa();

  // Carga la lista de empresas accesibles para el usuario actual.
  // super_admin → todas las empresas
  // otros       → las empresas asignadas (devueltas por /empresas/mine)
  const loadEmpresasList = useCallback(async () => {
    try {
      const list = await api.empresas.getMine(); // endpoint que devuelve las empresas del usuario
      setEmpresasList(list || []);
    } catch {
      setEmpresasList([]);
    }
  }, []);

  // Al arrancar: restaurar sesión desde localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(CLINIC_TOKEN_KEY);
    const storedDoctor = localStorage.getItem(CLINIC_DOCTOR_KEY);
    if (storedToken && storedDoctor) {
      setToken(storedToken);
      let parsedDoc = null;
      try {
        parsedDoc = JSON.parse(storedDoctor);
      } catch {
        handleLogout();
        return;
      }
      setDoctor(parsedDoc);
      // Refrescar datos del usuario desde el servidor y aplicar tema
      api.auth.me()
        .then(freshData => {
          setDoctor(freshData);
          localStorage.setItem(CLINIC_DOCTOR_KEY, JSON.stringify(freshData));
          applyFromUser(freshData);
          // Cargar la lista de empresas después de conocer el usuario actual
          loadEmpresasList();
        })
        .catch(() => {
          // Token expirado → logout
          handleLogout();
        });
    }
  }, []); // eslint-disable-line

  const handleLogin = (newToken, doctorData, empresasData) => {
  	localStorage.setItem(CLINIC_TOKEN_KEY, newToken);
  	localStorage.setItem(CLINIC_DOCTOR_KEY, JSON.stringify(doctorData));
  	setToken(newToken);
  	setDoctor(doctorData);
  
  	// Guardar lista de empresas
  	if (empresasData && empresasData.length > 0) {
    		setEmpresasList(empresasData);
    		if (doctorData.role !== 'super_admin') {
      			const activeEmpresa = empresasData.find(emp => emp.id === doctorData.empresa_id) || empresasData[0];
      			const doctorWithEmpresa = {
        			...doctorData,
        			empresa: activeEmpresa,
        			current_empresa_id: activeEmpresa.id
      			};
      			setDoctor(doctorWithEmpresa);
      			localStorage.setItem(CLINIC_DOCTOR_KEY, JSON.stringify(doctorWithEmpresa));
      			applyFromUser(doctorWithEmpresa);
    		} else {
      			applyFromUser(doctorData);
    		}
  	} else {
    		loadEmpresasList();
    		applyFromUser(doctorData);
  	}
  };

  const handleLogout = () => {
    localStorage.removeItem(CLINIC_TOKEN_KEY);
    localStorage.removeItem(CLINIC_DOCTOR_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('doctor');
    setToken(null);
    setDoctor(null);
    setEmpresasList([]);
    resetTheme();
  };

  // Se llama desde Layout cuando el usuario elige otra empresa en el dropdown
  const handleEmpresaSwitch = (newToken, newDoctor, nuevaEmpresa) => {
    localStorage.setItem(CLINIC_TOKEN_KEY, newToken);
    localStorage.setItem(CLINIC_DOCTOR_KEY, JSON.stringify(newDoctor));
    setToken(newToken);
    setDoctor({ ...newDoctor, empresa: nuevaEmpresa });
    setEmpresa(nuevaEmpresa);
    // Recargar la lista por si cambió algo
    loadEmpresasList();
  };

  return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/'}>
      <Routes>
        <Route path="/login" element={
          token ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
        } />
        <Route path="/" element={
          token
            ? <Layout
                doctor={doctor}
                onLogout={handleLogout}
                empresasList={empresasList}
                onSwitchEmpresa={handleEmpresaSwitch}
              />
            : <Navigate to="/login" replace />
        }>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientsPage doctor={doctor} />} />
          <Route path="patients/:patientId" element={<PatientDetail />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="statistics" element={<AdvancedStatsPage />} />
          <Route path="users" element={<AdminPage doctor={doctor} mode="users" />} />
          <Route path="my-companies" element={<AdminPage doctor={doctor} mode="empresas" />} />
          <Route path="admin" element={<Navigate to="/users" replace />} />
          <Route path="activity-log" element={<ActivityLogPage doctor={doctor} />} />
          <Route path="profile" element={<ProfilePage doctor={doctor} onUpdate={setDoctor} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <EmpresaProvider>
      <AppRoutes />
    </EmpresaProvider>
  );
}

export default App;
