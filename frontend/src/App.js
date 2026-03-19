import React, { useState, useEffect } from 'react';
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

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedDoctor = localStorage.getItem('doctor');
    if (storedToken && storedDoctor) {
      setToken(storedToken);
      setDoctor(JSON.parse(storedDoctor));
      // Refresh doctor data from server to get latest info (photo, role, etc.)
      api.auth.me().then(freshData => {
        setDoctor(freshData);
        localStorage.setItem('doctor', JSON.stringify(freshData));
      }).catch(() => {});
    }
  }, []);

  const handleLogin = (newToken, doctorData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('doctor', JSON.stringify(doctorData));
    setToken(newToken);
    setDoctor(doctorData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('doctor');
    setToken(null);
    setDoctor(null);
  };

  return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/'}>
      <Routes>
        <Route path="/login" element={
          token ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
        } />
        <Route path="/" element={
          token ? <Layout doctor={doctor} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:patientId" element={<PatientDetail />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="statistics" element={<AdvancedStatsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="activity-log" element={<ActivityLogPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;