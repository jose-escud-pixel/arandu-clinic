import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home, Users, Calendar, LogOut, BarChart3, Shield, User,
  Menu, X, Activity, Bell, Building2, ChevronDown, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { useEmpresa } from '../context/EmpresaContext';
import { api } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const Layout = ({ doctor, onLogout, empresasList = [], onSwitchEmpresa }) => {
  const location = useLocation();
  const isAdmin = doctor?.role === 'admin' || doctor?.role === 'super_admin';
  const isSuperAdmin = doctor?.role === 'super_admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEmpresaMenu, setShowEmpresaMenu] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { empresa, labels, switchEmpresa } = useEmpresa();

  useEffect(() => {
    api.notifications.getAll().then(setNotifs).catch(() => {});
  }, []);

  const unreadNotifs = notifs.filter(n => !n.read).length;

  const handleSwitchEmpresa = async (empresaId) => {
    if (switching) return;
    setSwitching(true);
    try {
      const result = await switchEmpresa(empresaId);
      // Recargar datos del usuario con la nueva empresa
      const freshUser = await api.auth.me();
      onSwitchEmpresa(result.token, freshUser, result.empresa);
      setShowEmpresaMenu(false);
      window.location.reload(); // recarga para refrescar todos los datos
    } catch (e) {
      console.error('Error al cambiar empresa', e);
    } finally {
      setSwitching(false);
    }
  };

  // Helper: check a granular permission for the current user.
  // Admins/super_admins always pass; doctors must have the flag explicitly set.
  const hasPerm = (perm) => {
    if (isAdmin) return true;
    return doctor?.permissions?.[perm] === true;
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Panel Principal', testId: 'nav-dashboard' },
    ...(hasPerm('pacientes.ver') ? [{ to: '/patients', icon: Users, label: 'Pacientes', testId: 'nav-patients' }] : []),
    ...(hasPerm('citas.ver') ? [{ to: '/appointments', icon: Calendar, label: 'Citas', testId: 'nav-appointments' }] : []),
    ...(hasPerm('estadisticas.ver') ? [{ to: '/statistics', icon: BarChart3, label: 'Estadísticas', testId: 'nav-statistics' }] : []),
    ...(isAdmin ? [
      { to: '/admin', icon: Shield, label: 'Administrador', testId: 'nav-admin' },
      { to: '/activity-log', icon: Activity, label: 'Log Actividad', testId: 'nav-activity-log' },
    ] : []),
    { to: '/profile', icon: User, label: 'Mi Perfil', testId: 'nav-profile' },
  ];

  const handleNavClick = () => setSidebarOpen(false);

  const currentEmpresaName = empresa?.nombre || labels.nombreEmpresa || 'Arandu Clinic';
  const currentEmpresaLogo = empresa?.logo_url || null;
  const canSwitchEmpresa = isSuperAdmin;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-muted border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-button">
          <Menu className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          {currentEmpresaLogo ? (
            <img src={`${BACKEND_URL}${currentEmpresaLogo}`} alt={currentEmpresaName}
                 className="h-8 object-contain" />
          ) : (
            <h1 className="text-lg font-bold font-heading text-primary">{currentEmpresaName}</h1>
          )}
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-muted border-r border-border p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {/* Logo de la empresa */}
            {currentEmpresaLogo ? (
              <img
                src={`${BACKEND_URL}${currentEmpresaLogo}`}
                alt={currentEmpresaName}
                className="h-10 max-w-[160px] object-contain mb-1"
              />
            ) : (
              <h1 className="text-xl font-bold font-heading text-primary tracking-tight truncate">
                {currentEmpresaName}
              </h1>
            )}
            <p className="text-xs text-muted-foreground mt-1">Portal Médico</p>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Selector de empresa (si tiene múltiples) */}
        {canSwitchEmpresa && (
          <div className="mb-4 relative empresa-selector">
            <button
              onClick={() => setShowEmpresaMenu(!showEmpresaMenu)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-sm font-medium"
              disabled={switching}
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="truncate">{currentEmpresaName}</span>
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showEmpresaMenu ? 'rotate-180' : ''}`} />
            </button>

            {showEmpresaMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                {empresasList.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleSwitchEmpresa(emp.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    disabled={switching}
                  >
                    <span className="flex items-center gap-2">
                      {emp.logo_url ? (
                        <img src={`${BACKEND_URL}${emp.logo_url}`} alt={emp.nombre}
                             className="h-5 object-contain" />
                      ) : (
                        <span className="font-medium text-foreground">{emp.nombre}</span>
                      )}
                    </span>
                    {empresa?.id === emp.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} onClick={handleNavClick}>
                <Button
                  data-testid={item.testId}
                  variant="ghost"
                  className={`w-full justify-start gap-3 rounded-xl transition-colors ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-foreground hover:text-foreground'
                  }`}
                  style={isActive
                    ? { backgroundColor: 'var(--empresa-primary)', color: '#fff' }
                    : {
                        backgroundColor: 'transparent',
                        '--tw-ring-shadow': 'none',
                      }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.07)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Usuario info */}
        <div className="border-t border-border pt-4 mt-4">
          {/* Notificaciones */}
          <div className="mb-2 relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-white/50 text-muted-foreground hover:text-foreground transition-all text-sm"
            >
              <Bell className="w-4 h-4" />
              <span>Notificaciones</span>
              {unreadNotifs > 0 && (
                <span className="ml-auto bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: 'var(--empresa-primary)' }}>
                  {unreadNotifs}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto z-50">
                {notifs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">Sin notificaciones</p>
                ) : (
                  notifs.slice(0, 10).map(n => (
                    <div key={n.id} className={`px-3 py-2 border-b border-border text-sm ${n.read ? 'opacity-60' : ''}`}>
                      <p className="font-medium text-foreground">{n.title}</p>
                      <p className="text-muted-foreground text-xs">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="mb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
              {doctor?.photo_url ? (
                <img src={`${BACKEND_URL}${doctor.photo_url}`} alt={doctor?.name}
                     className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-primary" style={{ color: 'var(--empresa-primary)' }} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-charcoal-800 truncate">{doctor?.name || 'Usuario'}</p>
              <p className="text-xs text-muted-foreground truncate">{doctor?.email}</p>
              <span className="inline-block text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 mt-0.5"
                    style={{ backgroundColor: 'var(--empresa-primary-10)', color: 'var(--empresa-primary)' }}>
                {doctor?.role === 'super_admin' ? 'Super Admin'
                 : doctor?.role === 'admin' ? 'Admin'
                 : labels.profesional}
              </span>
            </div>
          </div>

          <Button
            data-testid="logout-button"
            onClick={onLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      <main className="lg:ml-64 p-4 md:p-8 pt-20 lg:pt-8">
        <Outlet />
      </main>

      {/* Click outside to close empresa menu */}
      {showEmpresaMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowEmpresaMenu(false)} />
      )}
    </div>
  );
};

export default Layout;
