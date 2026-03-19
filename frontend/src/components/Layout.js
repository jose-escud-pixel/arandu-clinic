import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, Calendar, LogOut, BarChart3, Shield, User, Menu, X, Activity } from 'lucide-react';
import { Button } from './ui/button';

const Layout = ({ doctor, onLogout }) => {
  const location = useLocation();
  const isAdmin = doctor?.role === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: '/', icon: Home, label: 'Panel Principal', testId: 'nav-dashboard' },
    { to: '/patients', icon: Users, label: 'Pacientes', testId: 'nav-patients' },
    { to: '/appointments', icon: Calendar, label: 'Citas', testId: 'nav-appointments' },
    { to: '/statistics', icon: BarChart3, label: 'Estadísticas', testId: 'nav-statistics' },
    ...(isAdmin ? [
      { to: '/admin', icon: Shield, label: 'Administrador', testId: 'nav-admin' },
      { to: '/activity-log', icon: Activity, label: 'Log Actividad', testId: 'nav-activity-log' },
    ] : []),
    { to: '/profile', icon: User, label: 'Mi Perfil', testId: 'nav-profile' },
  ];

  const handleNavClick = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-muted border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-button">
          <Menu className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold font-heading text-primary">Arandu Clinic</h1>
        <div className="w-10" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-muted border-r border-border p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-primary tracking-tight">Arandu Clinic</h1>
            <p className="text-sm text-muted-foreground mt-1">Portal Médico</p>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to} onClick={handleNavClick}>
                <Button
                  data-testid={item.testId}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 rounded-xl ${isActive ? 'bg-primary text-white hover:bg-primary/90' : 'hover:bg-white/50'}`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4 mt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
              {doctor?.photo_url ? (
                <img src={`${process.env.REACT_APP_BACKEND_URL}${doctor.photo_url}`} alt={doctor?.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-charcoal-800 truncate">{doctor?.name || 'Doctor'}</p>
              <p className="text-xs text-muted-foreground truncate">{doctor?.email}</p>
              {isAdmin && <span className="inline-block text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 mt-1">Admin</span>}
            </div>
          </div>
          <Button data-testid="logout-button" onClick={onLogout} variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
            <LogOut className="h-5 w-5" />Cerrar Sesión
          </Button>
        </div>
      </aside>

      <main className="lg:ml-64 p-4 md:p-8 pt-20 lg:pt-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
