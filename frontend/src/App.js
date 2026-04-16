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
import { api } from './lib/api';
import { EmpresaProvider, useEmpresa } from './context/EmpresaContext';

function AppRoutes() {
  const [token, setToken] = useState(localStorage.getItem('token'));
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
    const storedToken = localStorage.getItem('token');
    const storedDoctor = localStorage.getItem('doctor');
    if (storedToken && storedDoctor) {
      setToken(storedToken);
      const parsedDoc = JSON.parse(storedDoctor);
      setDoctor(parsedDoc);
      // Refrescar datos del usuario desde el servidor y aplicar tema
      api.auth.me()
        .then(freshData => {
          setDoctor(freshData);
          localStorage.setItem('doctor', JSON.stringify(freshData));
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
    localStorage.setItem('token', newToken);
    localStorage.setItem('doctor', JSON.stringify(doctorData));
    setToken(newToken);
    setDoctor(doctorData);
    // La API de login ya devuelve las empresas del usuario en empresasData
    if (empresasData && empresasData.length > 0) {
      setEmpresasList(empresasData);
    } else {
      // Fallback: cargar desde el endpoint de empresas
      loadEmpresasList();
    }
    applyFromUser(doctorData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('doctor');
    setToken(null);
    setDoctor(null);
    setEmpresasList([]);
    resetTheme();
  };

  // Se llama desde Layout cuando el usuario elige otra empresa en el dropdown
  const handleEmpresaSwitch = (newToken, newDoctor, nuevaEmpresa) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('doctor', JSON.stringify(newDoctor));
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
          <Route path="admin" element={<AdminPage doctor={doctor} />} />
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
