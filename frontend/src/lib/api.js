import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  auth: {
    login: async (email, password) => {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      return response.data;
    },
    register: async (email, password, name) => {
      const response = await axios.post(`${API}/auth/register`, { email, password, name });
      return response.data;
    },
    me: async () => {
      const response = await axios.get(`${API}/auth/me`, { headers: getAuthHeader() });
      return response.data;
    },
    updateProfile: async (data) => {
      const response = await axios.put(`${API}/auth/profile`, data, { headers: getAuthHeader() });
      return response.data;
    },
    changePassword: async (currentPassword, newPassword) => {
      const response = await axios.put(`${API}/auth/change-password`, { current_password: currentPassword, new_password: newPassword }, { headers: getAuthHeader() });
      return response.data;
    },
    uploadPhoto: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/auth/upload-photo`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    uploadLogo: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/auth/upload-logo`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  },
  admin: {
    getUsers: async () => {
      const response = await axios.get(`${API}/admin/users`, { headers: getAuthHeader() });
      return response.data;
    },
    getPendingUsers: async () => {
      const response = await axios.get(`${API}/admin/pending-users`, { headers: getAuthHeader() });
      return response.data;
    },
    approveUser: async (userId) => {
      const response = await axios.put(`${API}/admin/users/${userId}/approve`, {}, { headers: getAuthHeader() });
      return response.data;
    },
    rejectUser: async (userId) => {
      const response = await axios.put(`${API}/admin/users/${userId}/reject`, {}, { headers: getAuthHeader() });
      return response.data;
    },
    changeUserPassword: async (userId, newPassword) => {
      const response = await axios.put(`${API}/admin/users/${userId}/change-password`, { new_password: newPassword }, { headers: getAuthHeader() });
      return response.data;
    },
    changeUserRole: async (userId, role) => {
      const response = await axios.put(`${API}/admin/users/${userId}/role?role=${role}`, {}, { headers: getAuthHeader() });
      return response.data;
    },
    deleteUser: async (userId) => {
      const response = await axios.delete(`${API}/admin/users/${userId}`, { headers: getAuthHeader() });
      return response.data;
    },
    getActivityLogs: async (limit = 100, skip = 0) => {
      const response = await axios.get(`${API}/admin/activity-logs?limit=${limit}&skip=${skip}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  patients: {
    getAll: async () => {
      const response = await axios.get(`${API}/patients`, { headers: getAuthHeader() });
      return response.data;
    },
    search: async (query) => {
      const response = await axios.get(`${API}/patients/search?q=${query}`, { headers: getAuthHeader() });
      return response.data;
    },
    advancedSearch: async (query) => {
      const response = await axios.get(`${API}/patients/advanced-search?q=${query}`, { headers: getAuthHeader() });
      return response.data;
    },
    getById: async (id) => {
      const response = await axios.get(`${API}/patients/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
    create: async (data) => {
      const response = await axios.post(`${API}/patients`, data, { headers: getAuthHeader() });
      return response.data;
    },
    update: async (id, data) => {
      const response = await axios.put(`${API}/patients/${id}`, data, { headers: getAuthHeader() });
      return response.data;
    },
    delete: async (id) => {
      const response = await axios.delete(`${API}/patients/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  appointments: {
    getAll: async () => {
      const response = await axios.get(`${API}/appointments`, { headers: getAuthHeader() });
      return response.data;
    },
    getByPatient: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/appointments`, { headers: getAuthHeader() });
      return response.data;
    },
    create: async (data) => {
      const response = await axios.post(`${API}/appointments`, data, { headers: getAuthHeader() });
      return response.data;
    },
    update: async (id, data) => {
      const response = await axios.put(`${API}/appointments/${id}`, data, { headers: getAuthHeader() });
      return response.data;
    },
    delete: async (id) => {
      const response = await axios.delete(`${API}/appointments/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  consultations: {
    getByPatient: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/consultations`, { headers: getAuthHeader() });
      return response.data;
    },
    create: async (data) => {
      const response = await axios.post(`${API}/consultations`, data, { headers: getAuthHeader() });
      return response.data;
    },
    update: async (id, data) => {
      const response = await axios.put(`${API}/consultations/${id}`, data, { headers: getAuthHeader() });
      return response.data;
    },
    delete: async (id) => {
      const response = await axios.delete(`${API}/consultations/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  files: {
    getByPatient: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/files`, { headers: getAuthHeader() });
      return response.data;
    },
    upload: async (patientId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/patients/${patientId}/upload-file`, formData, {
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    delete: async (id) => {
      const response = await axios.delete(`${API}/files/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  dashboard: {
    getStats: async () => {
      const response = await axios.get(`${API}/dashboard/stats`, { headers: getAuthHeader() });
      return response.data;
    },
    getUpcomingReminders: async () => {
      const response = await axios.get(`${API}/appointments/upcoming-reminders`, { headers: getAuthHeader() });
      return response.data;
    },
    getAdvancedStats: async () => {
      const response = await axios.get(`${API}/dashboard/advanced-stats`, { headers: getAuthHeader() });
      return response.data;
    },
  },
  prescriptions: {
    getByPatient: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/prescriptions`, { headers: getAuthHeader() });
      return response.data;
    },
    create: async (data) => {
      const response = await axios.post(`${API}/prescriptions`, data, { headers: getAuthHeader() });
      return response.data;
    },
    update: async (id, data) => {
      const response = await axios.put(`${API}/prescriptions/${id}`, data, { headers: getAuthHeader() });
      return response.data;
    },
    delete: async (id) => {
      const response = await axios.delete(`${API}/prescriptions/${id}`, { headers: getAuthHeader() });
      return response.data;
    },
    getPDF: async (prescriptionId) => {
      const response = await axios.get(`${API}/prescriptions/${prescriptionId}/pdf`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      return response.data;
    },
  },
  export: {
    patientPDF: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/export-pdf`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      return response.data;
    },
  },
  medicalHistory: {
    getByPatient: async (patientId) => {
      const response = await axios.get(`${API}/patients/${patientId}/medical-history`, { headers: getAuthHeader() });
      return response.data;
    },
    create: async (patientId, data) => {
      const response = await axios.post(`${API}/patients/${patientId}/medical-history`, data, { headers: getAuthHeader() });
      return response.data;
    },
    update: async (entryId, data) => {
      const response = await axios.put(`${API}/medical-history-entries/${entryId}`, data, { headers: getAuthHeader() });
      return response.data;
    },
    delete: async (entryId) => {
      const response = await axios.delete(`${API}/medical-history-entries/${entryId}`, { headers: getAuthHeader() });
      return response.data;
    },
  },
};
