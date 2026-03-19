import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, Activity } from 'lucide-react';

const AdvancedStatsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.dashboard.getAdvancedStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando estadísticas...</div>
      </div>
    );
  }

  const COLORS = ['#D97757', '#4B7F52', '#F2C94C', '#E05252', '#6f6e68'];

  return (
    <div data-testid="advanced-stats-page" className="space-y-8">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">
          Estadísticas Avanzadas
        </h1>
        <p className="text-base text-charcoal-600 mt-2">
          Análisis detallado de la evolución de tu consultorio
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-card rounded-2xl" data-testid="appointments-chart">
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Citas por Mes (Últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.appointments_by_month?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.appointments_by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D6" />
                  <XAxis dataKey="month" stroke="#787570" />
                  <YAxis stroke="#787570" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FDFCF8',
                      border: '1px solid #E5E0D6',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#D97757" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No hay datos suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-card rounded-2xl" data-testid="consultations-chart">
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Consultas por Mes (Últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.consultations_by_month?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.consultations_by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D6" />
                  <XAxis dataKey="month" stroke="#787570" />
                  <YAxis stroke="#787570" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FDFCF8',
                      border: '1px solid #E5E0D6',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#4B7F52"
                    strokeWidth={3}
                    dot={{ fill: '#4B7F52', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No hay datos suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-card rounded-2xl" data-testid="patient-growth-chart">
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Crecimiento de Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.patient_growth?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.patient_growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D6" />
                  <XAxis dataKey="month" stroke="#787570" />
                  <YAxis stroke="#787570" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FDFCF8',
                      border: '1px solid #E5E0D6',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#F2C94C"
                    strokeWidth={3}
                    dot={{ fill: '#F2C94C', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No hay datos suficientes</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-card rounded-2xl" data-testid="top-diagnoses-chart">
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Diagnósticos Más Comunes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.top_diagnoses?.length > 0 ? (
              <div className="space-y-4">
                {stats.top_diagnoses.map((diagnosis, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <p className="text-sm font-medium text-charcoal-800">{diagnosis.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                            width: `${(diagnosis.count / stats.top_diagnoses[0].count) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-charcoal-900 w-8 text-right">
                        {diagnosis.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">No hay datos suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedStatsPage;