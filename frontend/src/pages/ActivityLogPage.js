import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Activity, UserPlus, Edit, Trash2, FileText, Calendar, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACTION_ICONS = {
  create: UserPlus,
  update: Edit,
  delete: Trash2,
  approve: Users,
  reject: Users,
};

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-amber-100 text-amber-700',
};

const TARGET_LABELS = {
  patient: 'Paciente',
  appointment: 'Cita',
  consultation: 'Consulta',
  prescription: 'Receta',
  file: 'Archivo',
  user: 'Usuario',
};

const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => { loadLogs(); }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getActivityLogs(pageSize, page * pageSize);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      if (error.response?.status === 403) toast.error('No tienes permisos de administrador');
      else toast.error('Error al cargar registros de actividad');
    } finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading && logs.length === 0) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Cargando...</div></div>;
  }

  return (
    <div data-testid="activity-log-page" className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">
          Registro de Actividad
        </h1>
        <p className="text-sm sm:text-base text-charcoal-600 mt-1 sm:mt-2">
          Historial de todas las acciones realizadas en el sistema
        </p>
      </div>

      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-heading">{total} acciones registradas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No hay registros de actividad aún</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const ActionIcon = ACTION_ICONS[log.action] || FileText;
                const colorClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
                const targetLabel = TARGET_LABELS[log.target_type] || log.target_type;
                const ts = log.timestamp ? new Date(log.timestamp) : null;

                return (
                  <div key={log.id} data-testid={`log-entry-${log.id}`} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal-800">
                        <span className="font-medium">{log.user_name}</span>
                        {' '}
                        <span className="text-muted-foreground">{log.details}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="rounded-full text-xs px-2 py-0">
                          {targetLabel}
                        </Badge>
                        {ts && (
                          <span className="text-xs text-muted-foreground">
                            {format(ts, "d MMM yyyy, HH:mm", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                data-testid="prev-page-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                data-testid="next-page-btn"
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogPage;
