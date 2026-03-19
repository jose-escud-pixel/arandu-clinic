import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { UserCheck, UserX, Trash2, Key, Shield, ShieldCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const data = await api.admin.getUsers();
      setUsers(data);
    } catch (error) {
      if (error.response?.status === 403) toast.error('No tienes permisos de administrador');
      else toast.error('Error al cargar usuarios');
    } finally { setLoading(false); }
  };

  const handleApprove = async (userId) => {
    try {
      await api.admin.approveUser(userId);
      toast.success('Usuario aprobado');
      loadUsers();
    } catch (error) { toast.error('Error al aprobar usuario'); }
  };

  const handleReject = async (userId) => {
    try {
      await api.admin.rejectUser(userId);
      toast.success('Usuario rechazado');
      loadUsers();
    } catch (error) { toast.error('Error al rechazar usuario'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    try {
      await api.admin.changeUserPassword(selectedUser.id, newPassword);
      toast.success(`Contraseña de ${selectedUser.name} actualizada`);
      setShowPasswordDialog(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) { toast.error('Error al cambiar contraseña'); }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'doctor' : 'admin';
    try {
      await api.admin.changeUserRole(user.id, newRole);
      toast.success(`Rol cambiado a ${newRole}`);
      loadUsers();
    } catch (error) { toast.error('Error al cambiar rol'); }
  };

  const handleDeleteUser = async () => {
    try {
      await api.admin.deleteUser(selectedUser.id);
      toast.success('Usuario eliminado');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Error al eliminar usuario'); }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return u.status === 'pending';
    if (filter === 'active') return u.status === 'active';
    if (filter === 'rejected') return u.status === 'rejected';
    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

  if (loading) return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Cargando...</div></div>;

  return (
    <div data-testid="admin-page" className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">Panel de Administrador</h1>
        <p className="text-sm sm:text-base text-charcoal-600 mt-1 sm:mt-2">Gestiona usuarios y permisos del sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-card rounded-2xl cursor-pointer hover:shadow-hover transition-all" onClick={() => setFilter('all')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Total Usuarios</p></div>
          </CardContent>
        </Card>
        <Card className={`border-border shadow-card rounded-2xl cursor-pointer hover:shadow-hover transition-all ${filter === 'pending' ? 'ring-2 ring-amber-400' : ''}`} onClick={() => setFilter('pending')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-sm text-muted-foreground">Pendientes</p></div>
          </CardContent>
        </Card>
        <Card className={`border-border shadow-card rounded-2xl cursor-pointer hover:shadow-hover transition-all ${filter === 'active' ? 'ring-2 ring-green-400' : ''}`} onClick={() => setFilter('active')}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div><p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p><p className="text-sm text-muted-foreground">Activos</p></div>
          </CardContent>
        </Card>
        <Card className={`border-border shadow-card rounded-2xl cursor-pointer hover:shadow-hover transition-all ${filter === 'rejected' ? 'ring-2 ring-red-400' : ''}`} onClick={() => setFilter('rejected')}>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div><p className="text-2xl font-bold">{users.filter(u => u.status === 'rejected').length}</p><p className="text-sm text-muted-foreground">Rechazados</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-heading">
            {filter === 'all' ? 'Todos los Usuarios' : filter === 'pending' ? 'Usuarios Pendientes' : filter === 'active' ? 'Usuarios Activos' : 'Usuarios Rechazados'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay usuarios en esta categoria</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} data-testid={`user-card-${user.id}`} className="p-4 bg-muted rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-charcoal-800">{user.name}</p>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="rounded-full text-xs">
                        {user.role === 'admin' ? 'Admin' : 'Doctor'}
                      </Badge>
                      <Badge variant={user.status === 'active' ? 'default' : user.status === 'pending' ? 'outline' : 'destructive'} className={`rounded-full text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-red-100 text-red-700'}`}>
                        {user.status === 'active' ? 'Activo' : user.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.specialty && <p className="text-sm text-charcoal-600">Especialidad: {user.specialty}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Registrado: {format(new Date(user.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {user.status === 'pending' && (
                      <>
                        <Button size="sm" data-testid={`approve-${user.id}`} onClick={() => handleApprove(user.id)} className="rounded-full bg-green-500 text-white hover:bg-green-600 text-xs">
                          <UserCheck className="w-4 h-4 mr-1" />Aprobar
                        </Button>
                        <Button size="sm" data-testid={`reject-${user.id}`} onClick={() => handleReject(user.id)} variant="outline" className="rounded-full border-red-400 text-red-500 hover:bg-red-50 text-xs">
                          <UserX className="w-4 h-4 mr-1" />Rechazar
                        </Button>
                      </>
                    )}
                    {user.status === 'rejected' && (
                      <Button size="sm" onClick={() => handleApprove(user.id)} className="rounded-full bg-green-500 text-white hover:bg-green-600 text-xs">
                        <UserCheck className="w-4 h-4 mr-1" />Aprobar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => handleToggleRole(user)}>
                      <ShieldCheck className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{user.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}</span><span className="sm:hidden">{user.role === 'admin' ? 'No Admin' : 'Admin'}</span>
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => { setSelectedUser(user); setShowPasswordDialog(true); }}>
                      <Key className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Contraseña</span>
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full border-red-400 text-red-500 hover:bg-red-50" onClick={() => { setSelectedUser(user); setShowDeleteConfirm(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading">Cambiar Contraseña</DialogTitle>
            <DialogDescription>Nueva contraseña para {selectedUser?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <Button type="submit" className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">Cambiar Contraseña</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-red-600">Eliminar Usuario</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer</DialogDescription>
          </DialogHeader>
          <p className="text-charcoal-700 mt-2">Estas seguro de eliminar a <strong>{selectedUser?.name}</strong>?</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-full">Cancelar</Button>
            <Button onClick={handleDeleteUser} className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600">Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
