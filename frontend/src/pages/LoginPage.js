import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.auth.login(email, password);
        toast.success('Bienvenido!');
        onLogin(data.token, data.doctor);
      } else {
        const data = await api.auth.register(email, password, name);
        if (data.pending) {
          toast.success('Registro enviado. El administrador debe aprobar tu cuenta.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setName('');
        } else {
          toast.success('Cuenta creada exitosamente!');
          onLogin(data.token, data.doctor);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en la autenticacion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-charcoal-900 mb-2">
            Arandu Clinic
          </h1>
          <p className="text-muted-foreground">Portal Médico</p>
        </div>

        <Card className="border-border shadow-card" data-testid="login-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">
              {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Ingresa tus credenciales para acceder'
                : 'Completa los datos para registrarte'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    data-testid="register-name-input"
                    type="text"
                    placeholder="Dr. Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="h-12 rounded-xl bg-[#FAF9F6] border-[#E5E0D6] focus:border-primary focus:ring-primary/20"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  placeholder="doctor@clinica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-[#FAF9F6] border-[#E5E0D6] focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-[#FAF9F6] border-[#E5E0D6] focus:border-primary focus:ring-primary/20"
                />
              </div>
              <Button
                data-testid="login-submit-button"
                type="submit"
                className="w-full h-12 rounded-full bg-primary text-white hover:bg-primary/90 shadow-md transform hover:scale-[1.02] transition-transform"
                disabled={loading}
              >
                {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                data-testid="toggle-auth-mode-button"
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;