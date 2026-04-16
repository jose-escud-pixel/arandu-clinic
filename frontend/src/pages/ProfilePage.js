import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';
import { useEmpresa } from '../context/EmpresaContext';
import { User, Key, Save, Camera, ImageIcon, PenLine } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ProfilePage = ({ doctor: doctorProp, onUpdate }) => {
  const { labels } = useEmpresa();
  const [doctor, setDoctor] = useState(doctorProp || null);
  const [loading, setLoading] = useState(!doctorProp);
  const [profileForm, setProfileForm] = useState({ name: '', specialty: '', license_number: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const profesionalLabel = labels.profesional || 'Doctor/a';
  const isFisio = labels.profesional === 'Fisioterapeuta';

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.auth.me();
        setDoctor(data);
        setProfileForm({
          name: data.name || '',
          specialty: data.specialty || '',
          license_number: data.license_number || '',
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    if (!doctorProp) load();
    else {
      setProfileForm({
        name: doctorProp.name || '',
        specialty: doctorProp.specialty || '',
        license_number: doctorProp.license_number || '',
      });
    }
  }, []); // eslint-disable-line

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await api.auth.updateProfile(profileForm);
      const data = await api.auth.me();
      setDoctor(data);
      localStorage.setItem('doctor', JSON.stringify(data));
      if (onUpdate) onUpdate(data);
      setProfileMsg('✓ Perfil actualizado');
    } catch { setProfileMsg('Error al actualizar perfil'); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMsg('Las contraseñas no coinciden');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPasswordMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      await api.auth.changePassword(passwordForm.current_password, passwordForm.new_password);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMsg('✓ Contraseña actualizada');
    } catch (err) { setPasswordMsg(err?.response?.data?.detail || 'Error al cambiar contraseña'); }
    finally { setSavingPassword(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingPhoto(true);
    try {
      const result = await api.auth.uploadPhoto(file);
      const updated = { ...doctor, photo_url: result.photo_url };
      setDoctor(updated);
      localStorage.setItem('doctor', JSON.stringify(updated));
      if (onUpdate) onUpdate(updated);
    } catch { alert('Error al subir foto'); }
    finally { setUploadingPhoto(false); e.target.value = ''; }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingLogo(true);
    try {
      const result = await api.auth.uploadLogo(file);
      const updated = { ...doctor, logo_url: result.logo_url };
      setDoctor(updated);
      localStorage.setItem('doctor', JSON.stringify(updated));
      if (onUpdate) onUpdate(updated);
    } catch { alert('Error al subir logo'); }
    finally { setUploadingLogo(false); e.target.value = ''; }
  };

  const handleFirmaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingFirma(true);
    try {
      const result = await api.auth.uploadFirma(file);
      const updated = { ...doctor, firma_url: result.firma_url };
      setDoctor(updated);
      localStorage.setItem('doctor', JSON.stringify(updated));
      if (onUpdate) onUpdate(updated);
    } catch { alert('Error al subir firma'); }
    finally { setUploadingFirma(false); e.target.value = ''; }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-2 border-gray-300 rounded-full"
           style={{ borderTopColor: 'var(--empresa-primary)' }} />
    </div>
  );

  const photoSrc  = doctor?.photo_url  ? `${BACKEND_URL}${doctor.photo_url}`  : null;
  const logoSrc   = doctor?.logo_url   ? `${BACKEND_URL}${doctor.logo_url}`   : null;
  const firmaSrc  = doctor?.firma_url  ? `${BACKEND_URL}${doctor.firma_url}`  : null;

  const roleLabel = doctor?.role === 'super_admin' ? 'Super Admin'
                  : doctor?.role === 'admin'        ? 'Administrador'
                  : profesionalLabel;

  return (
    <div data-testid="profile-page" className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold font-heading tracking-tight text-foreground">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona tu información personal y configuración</p>
      </div>

      {/* ── Foto + info ── */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-2"
                 style={{ borderColor: 'var(--empresa-primary)' }}>
              {photoSrc ? (
                <img src={photoSrc} alt={doctor?.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8" style={{ color: 'var(--empresa-primary)' }} />
              )}
            </div>
            <button
              onClick={() => document.getElementById('photo-upload').click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
            <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl font-heading truncate">{doctor?.name}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">{doctor?.email}</p>
            {uploadingPhoto && <p className="text-xs mt-1" style={{ color: 'var(--empresa-primary)' }}>Subiendo foto...</p>}
          </div>
          <span className="text-xs font-medium px-3 py-1 rounded-full"
                style={{ backgroundColor: 'var(--empresa-primary-10, rgba(0,0,0,0.08))', color: 'var(--empresa-primary)' }}>
            {roleLabel}
          </span>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nombre completo</Label>
                <Input value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                       required className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Especialidad</Label>
                <Input value={profileForm.specialty}
                       onChange={e => setProfileForm({...profileForm, specialty: e.target.value})}
                       placeholder={isFisio ? 'Ej: Fisioterapia deportiva, Neurológica...' : 'Ej: Cardiología, Traumatología...'}
                       className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Matrícula profesional</Label>
                <Input value={profileForm.license_number}
                       onChange={e => setProfileForm({...profileForm, license_number: e.target.value})}
                       placeholder="Ej: MP-12345"
                       className="rounded-xl" />
              </div>
            </div>
            {profileMsg && (
              <p className={`text-sm ${profileMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{profileMsg}</p>
            )}
            <Button type="submit" disabled={savingProfile} className="w-full rounded-xl gap-2">
              <Save className="w-4 h-4" />{savingProfile ? 'Guardando...' : 'Guardar perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Logo para recetas ── */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
               style={{ backgroundColor: 'var(--empresa-primary-10, rgba(0,0,0,0.08))' }}>
            <ImageIcon className="w-5 h-5" style={{ color: 'var(--empresa-primary)' }} />
          </div>
          <div>
            <CardTitle className="text-lg font-heading">Logo para recetas / indicaciones</CardTitle>
            <p className="text-xs text-muted-foreground">Aparece en el encabezado de los PDFs generados</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="w-40 h-20 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <p className="text-xs text-muted-foreground text-center px-2">Sin logo</p>
              )}
            </div>
            <div>
              <Button variant="outline" className="rounded-xl gap-2"
                      onClick={() => document.getElementById('logo-upload').click()} disabled={uploadingLogo}>
                <ImageIcon className="w-4 h-4" />
                {uploadingLogo ? 'Subiendo...' : logoSrc ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <p className="text-xs text-muted-foreground mt-2">PNG o JPG · Recomendado 300×150 px</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Firma / rúbrica (para Fisioterapeuta y cualquier profesional) ── */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
               style={{ backgroundColor: 'var(--empresa-primary-10, rgba(0,0,0,0.08))' }}>
            <PenLine className="w-5 h-5" style={{ color: 'var(--empresa-primary)' }} />
          </div>
          <div>
            <CardTitle className="text-lg font-heading">Firma / Rúbrica</CardTitle>
            <p className="text-xs text-muted-foreground">
              Se inserta al pie de {isFisio ? 'las indicaciones y certificados fisioterapéuticos' : 'las recetas/indicaciones'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="w-48 h-24 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden">
              {firmaSrc ? (
                <img src={firmaSrc} alt="Firma" className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <p className="text-xs text-muted-foreground text-center px-2">Sin firma cargada</p>
              )}
            </div>
            <div>
              <Button variant="outline" className="rounded-xl gap-2"
                      onClick={() => document.getElementById('firma-upload').click()} disabled={uploadingFirma}>
                <PenLine className="w-4 h-4" />
                {uploadingFirma ? 'Subiendo...' : firmaSrc ? 'Cambiar firma' : 'Subir firma'}
              </Button>
              <input id="firma-upload" type="file" accept="image/*" onChange={handleFirmaUpload} className="hidden" />
              <p className="text-xs text-muted-foreground mt-2">PNG con fondo transparente · Recomendado 400×150 px</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Cambiar contraseña ── */}
      <Card className="border-border shadow-card rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-600" />
          </div>
          <CardTitle className="text-lg font-heading">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1">
              <Label>Contraseña actual</Label>
              <Input type="password" value={passwordForm.current_password}
                     onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})}
                     required className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={passwordForm.new_password}
                     onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})}
                     required minLength={6} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={passwordForm.confirm_password}
                     onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                     required minLength={6} className="rounded-xl" />
            </div>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{passwordMsg}</p>
            )}
            <Button type="submit" disabled={savingPassword} className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Key className="w-4 h-4" />{savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
