import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { User, Key, Save, Camera, ImageIcon } from 'lucide-react';

const ProfilePage = () => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ name: '', specialty: '', license_number: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.auth.me();
        setDoctor(data);
        setProfileForm({ name: data.name || '', specialty: data.specialty || '', license_number: data.license_number || '' });
      } catch (error) { toast.error('Error al cargar perfil'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.auth.updateProfile(profileForm);
      toast.success('Perfil actualizado');
      const data = await api.auth.me();
      setDoctor(data);
      localStorage.setItem('doctor', JSON.stringify(data));
    } catch (error) { toast.error('Error al actualizar perfil'); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      await api.auth.changePassword(passwordForm.current_password, passwordForm.new_password);
      toast.success('Contraseña actualizada');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) { toast.error(error.response?.data?.detail || 'Error al cambiar contraseña'); }
    finally { setSavingPassword(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await api.auth.uploadPhoto(file);
      const updated = { ...doctor, photo_url: result.photo_url };
      setDoctor(updated);
      localStorage.setItem('doctor', JSON.stringify(updated));
      toast.success('Foto de perfil actualizada');
    } catch (error) { toast.error('Error al subir foto'); }
    finally { setUploadingPhoto(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    setUploadingLogo(true);
    try {
      const result = await api.auth.uploadLogo(file);
      const updated = { ...doctor, logo_url: result.logo_url };
      setDoctor(updated);
      localStorage.setItem('doctor', JSON.stringify(updated));
      toast.success('Logo de receta actualizado');
    } catch (error) { toast.error('Error al subir logo'); }
    finally { setUploadingLogo(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Cargando...</div></div>;

  const photoSrc = doctor?.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${doctor.photo_url}` : null;
  const logoSrc = doctor?.logo_url ? `${process.env.REACT_APP_BACKEND_URL}${doctor.logo_url}` : null;

  return (
    <div data-testid="profile-page" className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-charcoal-900">Mi Perfil</h1>
        <p className="text-sm sm:text-base text-charcoal-600 mt-1 sm:mt-2">Gestiona tu información personal</p>
      </div>

      {/* Profile Info */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-4">
          {/* Profile Photo */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-2 border-primary/20">
              {photoSrc ? (
                <img src={photoSrc} alt={doctor?.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            <button
              onClick={() => document.getElementById('photo-upload').click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
            <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} data-testid="photo-upload-input" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl font-heading truncate">{doctor?.name}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">{doctor?.email}</p>
            {uploadingPhoto && <p className="text-xs text-primary mt-1">Subiendo foto...</p>}
          </div>
          <Badge variant={doctor?.role === 'admin' ? 'default' : 'secondary'} className="rounded-full">
            {doctor?.role === 'admin' ? 'Administrador' : 'Doctor'}
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input data-testid="profile-name-input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Input data-testid="profile-specialty-input" value={profileForm.specialty} onChange={(e) => setProfileForm({ ...profileForm, specialty: e.target.value })} placeholder="Ej: Cardiología, Traumatología, Pediatría..." className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <div className="space-y-2">
              <Label>Matrícula Profesional</Label>
              <Input data-testid="profile-license-input" value={profileForm.license_number} onChange={(e) => setProfileForm({ ...profileForm, license_number: e.target.value })} placeholder="Ej: MP-12345" className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <Button data-testid="save-profile-button" type="submit" disabled={savingProfile} className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90">
              <Save className="w-5 h-5 mr-2" />{savingProfile ? 'Guardando...' : 'Guardar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logo for Prescriptions */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-heading">Logo para Recetas</CardTitle>
            <p className="text-sm text-muted-foreground">Este logo aparecerá en el encabezado de tus recetas PDF</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-40 h-20 rounded-xl border-2 border-dashed border-border bg-[#FAF9F6] flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <p className="text-xs text-muted-foreground text-center px-2">Sin logo configurado</p>
              )}
            </div>
            <div className="flex-1">
              <Button
                data-testid="upload-logo-button"
                variant="outline"
                className="rounded-full"
                onClick={() => document.getElementById('logo-upload').click()}
                disabled={uploadingLogo}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                {uploadingLogo ? 'Subiendo...' : logoSrc ? 'Cambiar Logo' : 'Subir Logo'}
              </Button>
              <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} data-testid="logo-upload-input" />
              <p className="text-xs text-muted-foreground mt-2">Formatos: PNG, JPG. Recomendado: 300x150px</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <Key className="w-6 h-6 text-amber-600" />
          </div>
          <CardTitle className="text-xl font-heading">Cambiar Contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Contraseña Actual</Label>
              <Input data-testid="current-password-input" type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <Input data-testid="new-password-input" type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required minLength={6} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nueva Contraseña</Label>
              <Input data-testid="confirm-password-input" type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required minLength={6} className="rounded-xl h-12 bg-[#FAF9F6] border-[#E5E0D6]" />
            </div>
            <Button data-testid="change-password-button" type="submit" disabled={savingPassword} className="w-full h-12 rounded-full bg-amber-500 text-white hover:bg-amber-600">
              <Key className="w-5 h-5 mr-2" />{savingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
