import React, { useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LogIn, Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * LoginPage — solo email + contraseña.
 * La selección / cambio de empresa ocurre DENTRO del app (sidebar).
 */
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.auth.login(email, password);
      if (data.token) {
        onLogin(data.token, data.doctor, data.empresas || []);
      } else {
        setError('Respuesta inválida del servidor');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Email o contraseña incorrectos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-border">
          {/* Header con barra de color primario */}
          <div className="h-1.5 w-full" style={{ backgroundColor: 'var(--empresa-primary, #D97757)' }} />

          <div className="px-8 pt-8 pb-8">
            {/* Logo / título */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold font-heading text-foreground">
                Portal Médico
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresá con tu cuenta
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoFocus
                  className="rounded-xl border-border"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="rounded-xl border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-xl font-semibold py-2.5 gap-2"
                style={{ backgroundColor: 'var(--empresa-primary, #D97757)', color: '#fff' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    <LogIn className="w-4 h-4" />
                    Ingresar
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Portal Médico · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
