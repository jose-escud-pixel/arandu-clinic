import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Activity, Search, X, RefreshCw, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ACTION_COLORS = {
  create:   'bg-green-100 text-green-700',
  update:   'bg-blue-100 text-blue-700',
  delete:   'bg-red-100 text-red-700',
  approve:  'bg-emerald-100 text-emerald-700',
  reject:   'bg-orange-100 text-orange-700',
  login:    'bg-purple-100 text-purple-700',
  logout:   'bg-gray-100 text-gray-600',
  switch:   'bg-indigo-100 text-indigo-700',
  upload:   'bg-cyan-100 text-cyan-700',
  download: 'bg-yellow-100 text-yellow-700',
};

const formatDateTime = (str) => {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('es-PY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
};

const ActivityLogPage = ({ doctor }) => {
  const isSuperAdmin = doctor?.role === 'super_admin';
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.getActivityLogs(200, 0);
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtrar localmente
  const filtered = logs.filter(log => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      log.user_name?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.details?.toLowerCase().includes(q);
    const matchAction = !filterAction || log.action === filterAction;
    return matchSearch && matchAction;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Acciones únicas para el filtro
  const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))].sort();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6" style={{ color: 'var(--empresa-primary)' }} />
            Log de Actividad
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSuperAdmin ? 'Actividad global de todas las empresas' : 'Actividad de tu empresa'}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2 rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por usuario, acción, detalles..."
            className="pl-10 pr-8 rounded-xl border-border"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            className="border border-border rounded-xl px-3 py-2 text-sm bg-background"
          >
            <option value="">Todas las acciones</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length === logs.length
            ? `${logs.length} registro${logs.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${logs.length} registros`}
        </p>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-2 border-gray-300 rounded-full mx-auto mb-3 animate-spin"
               style={{ borderTopColor: 'var(--empresa-primary)' }} />
          <p className="text-muted-foreground text-sm">Cargando registros...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto opacity-30 mb-3" />
          <p>{logs.length === 0 ? 'Sin registros de actividad aún' : 'No hay resultados para esta búsqueda'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">Fecha y hora</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Acción</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Detalles</th>
                  {isSuperAdmin && (
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Empresa</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((log, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-foreground">{log.user_name || '—'}</p>
                      {log.user_id && (
                        <p className="text-xs text-muted-foreground font-mono">{log.user_id.slice(0, 8)}…</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{log.details || '—'}</span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {log.empresa_id ? log.empresa_id.slice(0, 8) + '…' : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)}
                        disabled={page === 0} className="rounded-xl">
                  ← Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages - 1} className="rounded-xl">
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityLogPage;
