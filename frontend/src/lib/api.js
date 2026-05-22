import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Timeout global: si el backend o el proxy no responden, axios corta a los 30s
// y el formulario muestra un error en vez de quedar el spinner girando para siempre.
axios.defaults.timeout = 30000;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // ── AUTH ──────────────────────────────────────────────────
  auth: {
    login: async (email, password) => {
      const r = await axios.post(`${API}/auth/login`, { email, password });
      return r.data;  // { token, doctor, empresas }
    },
    register: async (email, password, name, empresa_slug) => {
      const r = await axios.post(`${API}/auth/register`, { email, password, name, empresa_slug });
      return r.data;
    },
    me: async () => {
      const r = await axios.get(`${API}/auth/me`, { headers: getAuthHeader() });
      return r.data;
    },
    switchEmpresa: async (empresa_id) => {
      const r = await axios.post(`${API}/auth/switch-empresa`, { empresa_id }, { headers: getAuthHeader() });
      return r.data;  // { token, empresa }
    },
    getMyEmpresas: async () => {
      const r = await axios.get(`${API}/auth/empresas`, { headers: getAuthHeader() });
      return r.data;
    },
    updateProfile: async (data) => {
      const r = await axios.put(`${API}/auth/profile`, data, { headers: getAuthHeader() });
      return r.data;
    },
    changePassword: async (current_password, new_password) => {
      const r = await axios.put(`${API}/auth/change-password`,
        { current_password, new_password }, { headers: getAuthHeader() });
      return r.data;
    },
    uploadPhoto: async (file) => {
      const form = new FormData(); form.append('file', file);
      const r = await axios.post(`${API}/auth/upload-photo`, form,
        { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
    uploadLogo: async (file) => {
      const form = new FormData(); form.append('file', file);
      const r = await axios.post(`${API}/auth/upload-logo`, form,
        { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
    uploadFirma: async (file) => {
      const form = new FormData(); form.append('file', file);
      const r = await axios.post(`${API}/auth/upload-firma`, form,
        { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
  },

  // ── EMPRESAS ─────────────────────────────────────────────
  empresas: {
    getPublic: async () => {
      const r = await axios.get(`${API}/empresas/public`);
      return r.data;
    },
    /** Empresas accesibles para el usuario actual (usa /auth/empresas) */
    getMine: async () => {
      const r = await axios.get(`${API}/auth/empresas`, { headers: getAuthHeader() });
      return r.data;
    },
    getAll: async () => {
      const r = await axios.get(`${API}/empresas`, { headers: getAuthHeader() });
      return r.data;
    },
    getById: async (id) => {
      const r = await axios.get(`${API}/empresas/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/empresas`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (id, data) => {
      const r = await axios.put(`${API}/empresas/${id}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    uploadLogo: async (id, file) => {
      const form = new FormData(); form.append('file', file);
      const r = await axios.post(`${API}/empresas/${id}/upload-logo`, form,
        { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/empresas/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── SUPER ADMIN ──────────────────────────────────────────
  superadmin: {
    getAllUsers: async () => {
      const r = await axios.get(`${API}/superadmin/users`, { headers: getAuthHeader() });
      return r.data;
    },
    createUser: async (data) => {
      const r = await axios.post(`${API}/superadmin/users`, data, { headers: getAuthHeader() });
      return r.data;
    },
    assignEmpresa: async (userId, empresa_id) => {
      const r = await axios.put(`${API}/superadmin/users/${userId}/empresa`,
        { empresa_id }, { headers: getAuthHeader() });
      return r.data;
    },
    setPermissions: async (userId, permissions) => {
      const r = await axios.put(`${API}/superadmin/users/${userId}/permissions`,
        { permissions }, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── ADMIN ────────────────────────────────────────────────
  admin: {
    getUsers: async () => {
      const r = await axios.get(`${API}/admin/users`, { headers: getAuthHeader() });
      return r.data;
    },
    getPendingUsers: async () => {
      const r = await axios.get(`${API}/admin/pending-users`, { headers: getAuthHeader() });
      return r.data;
    },
    approveUser: async (uid) => {
      const r = await axios.put(`${API}/admin/users/${uid}/approve`, {}, { headers: getAuthHeader() });
      return r.data;
    },
    rejectUser: async (uid) => {
      const r = await axios.put(`${API}/admin/users/${uid}/reject`, {}, { headers: getAuthHeader() });
      return r.data;
    },
    changeUserPassword: async (uid, new_password) => {
      const r = await axios.put(`${API}/admin/users/${uid}/change-password`,
        { new_password }, { headers: getAuthHeader() });
      return r.data;
    },
    changeUserRole: async (uid, role) => {
      const r = await axios.put(`${API}/admin/users/${uid}/role?role=${role}`, {},
        { headers: getAuthHeader() });
      return r.data;
    },
    updatePermissions: async (uid, permissions) => {
      const r = await axios.put(`${API}/admin/users/${uid}/permissions`,
        { permissions }, { headers: getAuthHeader() });
      return r.data;
    },
    createUser: async (data) => {
      const r = await axios.post(`${API}/admin/users/create`, data, { headers: getAuthHeader() });
      return r.data;
    },
    toggleUserStatus: async (uid) => {
      const r = await axios.put(`${API}/admin/users/${uid}/toggle-status`, {}, { headers: getAuthHeader() });
      return r.data;
    },
    deleteUser: async (uid) => {
      const r = await axios.delete(`${API}/admin/users/${uid}`, { headers: getAuthHeader() });
      return r.data;
    },
    getActivityLogs: async (limit = 100, skip = 0) => {
      const r = await axios.get(`${API}/admin/activity-logs?limit=${limit}&skip=${skip}`,
        { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── PACIENTES ────────────────────────────────────────────
  patients: {
    getAll: async (doctorId) => {
      const params = doctorId ? `?doctor_id=${encodeURIComponent(doctorId)}` : '';
      const r = await axios.get(`${API}/patients${params}`, { headers: getAuthHeader() });
      return r.data;
    },
    search: async (query) => {
      const r = await axios.get(`${API}/patients/search?q=${encodeURIComponent(query)}`,
        { headers: getAuthHeader() });
      return r.data;
    },
    advancedSearch: async (query) => {
      const r = await axios.get(`${API}/patients/advanced-search?q=${encodeURIComponent(query)}`,
        { headers: getAuthHeader() });
      return r.data;
    },
    getById: async (id) => {
      const r = await axios.get(`${API}/patients/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/patients`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (id, data) => {
      const r = await axios.put(`${API}/patients/${id}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/patients/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── CITAS ────────────────────────────────────────────────
  appointments: {
    getAll: async () => {
      const r = await axios.get(`${API}/appointments`, { headers: getAuthHeader() });
      return r.data;
    },
    getByPatient: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/appointments`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/appointments`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (id, data) => {
      const r = await axios.put(`${API}/appointments/${id}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/appointments/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── CONSULTAS ────────────────────────────────────────────
  consultations: {
    getByPatient: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/consultations`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/consultations`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (id, data) => {
      const r = await axios.put(`${API}/consultations/${id}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/consultations/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── ARCHIVOS ─────────────────────────────────────────────
  files: {
    getByPatient: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/files`, { headers: getAuthHeader() });
      return r.data;
    },
    upload: async (pid, file) => {
      const form = new FormData(); form.append('file', file);
      const r = await axios.post(`${API}/patients/${pid}/upload-file`, form,
        { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/files/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── DASHBOARD ────────────────────────────────────────────
  dashboard: {
    getStats: async () => {
      const r = await axios.get(`${API}/dashboard/stats`, { headers: getAuthHeader() });
      return r.data;
    },
    getUpcomingReminders: async () => {
      const r = await axios.get(`${API}/appointments/upcoming-reminders`, { headers: getAuthHeader() });
      return r.data;
    },
    getAdvancedStats: async () => {
      const r = await axios.get(`${API}/dashboard/advanced-stats`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── INDICACIONES / PRESCRIPCIONES ────────────────────────
  prescriptions: {
    getByPatient: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/prescriptions`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/prescriptions`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (id, data) => {
      const r = await axios.put(`${API}/prescriptions/${id}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    delete: async (id) => {
      const r = await axios.delete(`${API}/prescriptions/${id}`, { headers: getAuthHeader() });
      return r.data;
    },
    getPDF: async (id) => {
      const r = await axios.get(`${API}/prescriptions/${id}/pdf`,
        { headers: getAuthHeader(), responseType: 'blob' });
      return r.data;
    },
    getCertificadoPDF: async (id) => {
      const r = await axios.get(`${API}/prescriptions/${id}/certificado-pdf`,
        { headers: getAuthHeader(), responseType: 'blob' });
      return r.data;
    },
  },

  // ── HISTORIAL ────────────────────────────────────────────
  medicalHistory: {
    getByPatient: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/medical-history`, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (pid, data) => {
      const r = await axios.post(`${API}/patients/${pid}/medical-history`, data, { headers: getAuthHeader() });
      return r.data;
    },
    update: async (entryId, data) => {
      const r = await axios.put(`${API}/medical-history-entries/${entryId}`, data, { headers: getAuthHeader() });
      return r.data;
    },
    delete: async (entryId) => {
      const r = await axios.delete(`${API}/medical-history-entries/${entryId}`, { headers: getAuthHeader() });
      return r.data;
    },
  },

  // ── EXPORTAR ─────────────────────────────────────────────
  export: {
    patientPDF: async (pid) => {
      const r = await axios.get(`${API}/patients/${pid}/export-pdf`,
        { headers: getAuthHeader(), responseType: 'blob' });
      return r.data;
    },
  },

  // ── NOTIFICACIONES ───────────────────────────────────────
  notifications: {
    getAll: async () => {
      const r = await axios.get(`${API}/notifications`, { headers: getAuthHeader() });
      return r.data;
    },
    markRead: async (id) => {
      const r = await axios.post(`${API}/notifications/mark-read/${id}`, {}, { headers: getAuthHeader() });
      return r.data;
    },
    create: async (data) => {
      const r = await axios.post(`${API}/notifications`, data, { headers: getAuthHeader() });
      return r.data;
    },
  },
};
