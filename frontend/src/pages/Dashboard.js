import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { Users, Calendar, Activity, Clock, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentPatients, setRecentPatients] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, patientsData, appointmentsData, remindersData] = await Promise.all([
        api.dashboard.getStats(),
        api.patients.getAll(),
        api.appointments.getAll(),
        api.dashboard.getUpcomingReminders(),
      ]);

      setStats(statsData);
      setRecentPatients(patientsData.slice(0, 5));
      setUpcomingReminders(remindersData);

      const today = new Date();
      const todayAppts = appointmentsData.filter((apt) => {
        const aptDate = new Date(apt.date);
        return aptDate.toDateString() === today.toDateString();
      });
      setTodayAppointments(todayAppts);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Pacientes',
      value: stats?.total_patients || 0,
      icon: Users,
      color: 'bg-primary',
      testId: 'stat-total-patients',
    },
    {
      title: 'Citas Hoy',
      value: stats?.appointments_today || 0,
      icon: Calendar,
      color: 'bg-secondary',
      testId: 'stat-appointments-today',
    },
    {
      title: 'En Tratamiento',
      value: stats?.active_treatments || 0,
      icon: Activity,
      color: 'bg-accent',
      testId: 'stat-active-treatments',
    },
    {
      title: 'Citas Pendientes',
      value: stats?.pending_appointments || 0,
      icon: Clock,
      color: 'bg-muted',
      testId: 'stat-pending-appointments',
    },
  ];

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">
          Panel Principal
        </h1>
        <p className="text-base text-charcoal-600 mt-2">
          Bienvenido a tu panel de gestión médica
        </p>
      </div>

      {upcomingReminders.length > 0 && (
        <Card className="border-l-4 border-accent bg-accent/5 shadow-card rounded-2xl" data-testid="reminders-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-accent" />
              <CardTitle className="text-xl font-heading text-charcoal-900">
                Recordatorios - Citas de Mañana ({upcomingReminders.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  data-testid={`reminder-item-${reminder.id}`}
                  className="p-4 bg-white rounded-xl border border-accent/20 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-charcoal-800">
                      {reminder.patient_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(reminder.date), "d 'de' MMMM - HH:mm", { locale: es })}
                    </p>
                    <p className="text-sm text-charcoal-600 mt-1">{reminder.reason}</p>
                  </div>
                  <Badge className="bg-accent text-accent-foreground rounded-full">
                    Mañana
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.testId}
              data-testid={stat.testId}
              className="border-border shadow-card hover:shadow-hover transition-shadow rounded-2xl"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold font-heading text-charcoal-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="col-span-12 md:col-span-8 border-border shadow-card rounded-2xl" data-testid="recent-patients-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Pacientes Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPatients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay pacientes aún</p>
            ) : (
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <Link
                    key={patient.id}
                    to={`/patients/${patient.id}`}
                    className="block"
                  >
                    <div
                      data-testid={`patient-item-${patient.id}`}
                      className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-white hover:shadow-card transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {patient.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-charcoal-800">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">{patient.cedula}</p>
                        </div>
                      </div>
                      <Badge
                        variant={patient.status === 'active' ? 'default' : 'secondary'}
                        className="rounded-full px-3 py-1"
                      >
                        {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-4 border-border shadow-card rounded-2xl" data-testid="today-appointments-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Citas de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Sin citas hoy</p>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    data-testid={`appointment-item-${appointment.id}`}
                    className="p-3 bg-muted rounded-xl border-l-4 border-primary"
                  >
                    <p className="text-sm font-semibold text-charcoal-800 mb-1">
                      {format(new Date(appointment.date), 'HH:mm', { locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground">{appointment.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;