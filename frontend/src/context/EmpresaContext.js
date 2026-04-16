import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const EmpresaContext = createContext(null);
export const useEmpresa = () => useContext(EmpresaContext);

// Colores por defecto (arandu-clinic)
const DEFAULT_THEME = {
  primary_color: '#D97757',
  secondary_color: '#4B7F52',
  bg_color: '#FDFCF8',
  text_color: '#2D2A26',
  muted_color: '#F5F2EB',
  border_color: '#E5E0D6',
  profesional_label: 'Doctor',
  indicaciones_label: 'Indicaciones',
  extended_patient: false,
  nombre: 'Arandu Clinic',
  slug: 'arandu-clinic',
};

export function applyEmpresaTheme(empresa) {
  const e = empresa || DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty('--empresa-primary', e.primary_color || DEFAULT_THEME.primary_color);
  root.style.setProperty('--empresa-secondary', e.secondary_color || DEFAULT_THEME.secondary_color);
  root.style.setProperty('--empresa-bg', e.bg_color || DEFAULT_THEME.bg_color);
  root.style.setProperty('--empresa-text', e.text_color || DEFAULT_THEME.text_color);
  root.style.setProperty('--empresa-muted', e.muted_color || DEFAULT_THEME.muted_color);
  root.style.setProperty('--empresa-border', e.border_color || DEFAULT_THEME.border_color);
  root.setAttribute('data-empresa', e.slug || 'arandu-clinic');
  // Fondo del body
  document.body.style.backgroundColor = e.bg_color || DEFAULT_THEME.bg_color;
  document.body.style.color = e.text_color || DEFAULT_THEME.text_color;
}

export const EmpresaProvider = ({ children }) => {
  const [empresa, setEmpresa] = useState(null);
  const [empresas, setEmpresas] = useState([]);  // todas las accesibles
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  const setAndApplyEmpresa = useCallback((emp) => {
    setEmpresa(emp);
    if (emp) applyEmpresaTheme(emp);
    else applyEmpresaTheme(DEFAULT_THEME);
  }, []);

  const loadEmpresas = useCallback(async () => {
    try {
      const list = await api.empresas.getPublic();
      setEmpresas(list);
    } catch {
      // silent
    }
  }, []);

  // Aplicar tema desde empresa en auth/me
  const applyFromUser = useCallback((userWithEmpresa) => {
    if (userWithEmpresa?.empresa) {
      setAndApplyEmpresa(userWithEmpresa.empresa);
    } else {
      applyEmpresaTheme(DEFAULT_THEME);
    }
  }, [setAndApplyEmpresa]);

  // Switch empresa (llama al backend, obtiene nuevo token)
  const switchEmpresa = useCallback(async (empresaId) => {
    setLoadingEmpresa(true);
    try {
      const result = await api.auth.switchEmpresa(empresaId);
      localStorage.setItem('token', result.token);
      setAndApplyEmpresa(result.empresa);
      return result;
    } finally {
      setLoadingEmpresa(false);
    }
  }, [setAndApplyEmpresa]);

  // Labels dinámicos basados en empresa
  const labels = {
    profesional: empresa?.profesional_label || DEFAULT_THEME.profesional_label,
    indicaciones: empresa?.indicaciones_label || DEFAULT_THEME.indicaciones_label,
    extendedPatient: empresa?.extended_patient || false,
    nombreEmpresa: empresa?.nombre || DEFAULT_THEME.nombre,
    logoUrl: empresa?.logo_url || null,
  };

  // Restablecer tema por defecto al hacer logout
  const resetTheme = useCallback(() => {
    applyEmpresaTheme(DEFAULT_THEME);
    setEmpresa(null);
    setEmpresas([]);
  }, []);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  return (
    <EmpresaContext.Provider value={{
      empresa,
      empresas,
      labels,
      loadingEmpresa,
      setEmpresa: setAndApplyEmpresa,
      switchEmpresa,
      applyFromUser,
      resetTheme,
      loadEmpresas,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
};

export default EmpresaContext;
