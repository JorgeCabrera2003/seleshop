'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, KeyRound, UserPlus, ArrowRight, AlertTriangle, Check, Delete, Mail, Lock, Sparkles, RefreshCw } from 'lucide-react';
import { User as UserType, AuthSession } from '../../lib/types';
import { putToStore, addToSyncQueue, setActiveSession } from '../../lib/db/indexeddb';
import { pullAllFromSupabase } from '../../lib/sync/syncEngine';

interface AuthModuleProps {
  users: UserType[];
  onLoginSuccess: (session: AuthSession) => void;
  onRefreshUsers: () => void;
}

export const AuthModule: React.FC<AuthModuleProps> = ({
  users,
  onLoginSuccess,
  onRefreshUsers,
}) => {
  // Login Mode: 'PIN' | 'PASSWORD' | 'REGISTER'
  const [authMode, setAuthMode] = useState<'PIN' | 'PASSWORD' | 'REGISTER'>(() => {
    return users.filter((u) => u.is_active).length === 0 ? 'REGISTER' : 'PIN';
  });

  const [selectedUser, setSelectedUser] = useState<UserType | null>(() => {
    const active = users.filter((u) => u.is_active);
    return active.length > 0 ? active[0] : null;
  });

  const [pin, setPin] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('Sele');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regPinConfirm, setRegPinConfirm] = useState('');

  const activeUsers = users.filter((u) => u.is_active);

  // Keypad numeric press for Fast PIN
  const handleKeypadPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg(null);

      // Auto-submit if pin matches
      if (selectedUser && nextPin === selectedUser.pin) {
        performLogin(selectedUser);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const performLogin = async (userToLogin: UserType) => {
    setIsLoading(true);
    const session: AuthSession = {
      user: userToLogin,
      logged_at: new Date().toISOString(),
    };
    setActiveSession(session);

    // Auto-sync data in background on login
    try {
      await pullAllFromSupabase();
    } catch {
      // Offline-first fallback
    }

    setIsLoading(false);
    onLoginSuccess(session);
  };

  // Submit via Fast PIN
  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setErrorMsg('Selecciona un usuario.');
      return;
    }
    if (pin === selectedUser.pin) {
      performLogin(selectedUser);
    } else {
      setErrorMsg('PIN incorrecto. Intenta nuevamente.');
      setPin('');
    }
  };

  // Submit via Email & Password
  const handleLoginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const emailClean = emailInput.trim().toLowerCase();
    const passClean = passwordInput.trim();

    // 1. Check local IndexedDB users first
    let matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === emailClean) ||
        u.username.toLowerCase() === emailClean ||
        u.name.toLowerCase() === emailClean
    );

    // 2. If not found locally, try pulling latest users from Supabase Cloud
    if (!matchedUser) {
      await pullAllFromSupabase();
      // Re-check after pull
      const updatedUsers = users;
      matchedUser = updatedUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === emailClean) ||
          u.username.toLowerCase() === emailClean ||
          u.name.toLowerCase() === emailClean
      );
    }

    setIsLoading(false);

    if (matchedUser) {
      if (matchedUser.password && matchedUser.password !== passClean) {
        setErrorMsg('Contraseña incorrecta.');
        return;
      }
      performLogin(matchedUser);
    } else {
      setErrorMsg('No se encontró ningún usuario con ese correo o nombre.');
    }
  };

  // Register New Account / Initial Owner Setup
  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = regName.trim() || 'Sele';
    const email = regEmail.trim().toLowerCase();
    const pass = regPassword.trim();

    if (!name) {
      setErrorMsg('Por favor ingresa tu nombre o apodo.');
      return;
    }
    if (regPin.length < 4 || regPin.length > 6) {
      setErrorMsg('El PIN rápido debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    if (regPin !== regPinConfirm) {
      setErrorMsg('Los PIN ingresados no coinciden.');
      return;
    }

    const newUser: UserType = {
      id: 'usr-' + Date.now(),
      name,
      email: email || undefined,
      password: pass || undefined,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      role: 'ADMIN',
      pin: regPin,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await putToStore('users', newUser);
    await addToSyncQueue({ table_name: 'users', action: 'INSERT', data: newUser });
    onRefreshUsers();
    performLogin(newUser);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#181614' }}>
      <div className="w-full max-w-md space-y-5">

        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-amber-800 border-2 border-[#D4AF37] flex items-center justify-center font-bold text-stone-100 text-2xl sm:text-3xl shadow-2xl mx-auto">
            S
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-100 font-wabi tracking-tight">SeleShop POS</h1>
          <p className="text-xs text-stone-400 font-semibold">
            Punto de Venta Bimonetario & Control Multidispositivo
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            className="border border-[#C0392B]/60 text-stone-200 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in"
            style={{ backgroundColor: 'rgba(192,57,43,0.14)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#C0392B]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── CARD PRINCIPAL ────────────────────────────────────── */}
        <div className="wabi-card bg-stone-900 p-5 sm:p-7 space-y-5 border border-stone-800 shadow-2xl">

          {/* Mode Switcher Tabs (when users already exist) */}
          {activeUsers.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 bg-stone-950 p-1 rounded-2xl border border-stone-800">
              <button
                type="button"
                onClick={() => { setAuthMode('PIN'); setErrorMsg(null); }}
                className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'PIN'
                    ? 'bg-amber-800 text-stone-100 border border-[#D4AF37]/50 shadow'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>PIN Rápido</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('PASSWORD'); setErrorMsg(null); }}
                className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'PASSWORD'
                    ? 'bg-amber-800 text-stone-100 border border-[#D4AF37]/50 shadow'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Correo / Clave</span>
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* MODO 1: INICIO RÁPIDO POR PIN                          */}
          {/* ══════════════════════════════════════════════════════ */}
          {authMode === 'PIN' && activeUsers.length > 0 && (
            <div className="space-y-4">
              
              {/* User Avatars */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                  Selecciona tu usuario
                </label>

                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {activeUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    const isAdmin = u.role === 'ADMIN';

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          setPin('');
                          setErrorMsg(null);
                        }}
                        className={`p-2.5 rounded-2xl border-2 flex items-center gap-2.5 text-left transition-all touch-target-lg ${
                          isSelected
                            ? 'bg-amber-900/30 border-[#D4AF37] text-stone-100'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-xs text-stone-200 shrink-0">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-xs text-stone-100 block truncate">{u.name}</span>
                          <span className="text-[10px] text-stone-400 font-semibold block">
                            {u.role === 'SUPERADMIN' ? 'SuperAdmin' : u.role === 'ADMIN' ? 'Admin' : 'Cajero'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIN Keypad & Dots */}
              {selectedUser && (
                <div className="space-y-3 pt-2 border-t border-stone-800">
                  <div className="text-center space-y-1">
                    <span className="text-xs font-bold text-stone-400">
                      PIN de <strong className="text-stone-100">{selectedUser.name}</strong>
                    </span>

                    {/* PIN Dots Display */}
                    <div className="flex justify-center items-center gap-3 py-1.5">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div
                          key={index}
                          className={`w-3 h-3 rounded-full transition-all ${
                            index < pin.length
                              ? 'bg-amber-400 scale-110 shadow-sm'
                              : 'bg-stone-800 border border-stone-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Keypad Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadPress(digit)}
                        className="py-3 bg-stone-950 hover:bg-stone-800 active:bg-amber-800 active:text-stone-100 text-stone-100 font-extrabold text-xl rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center shadow-sm"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPin('')}
                      className="py-3 bg-stone-950 hover:bg-stone-800 text-stone-500 font-bold text-xs rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="py-3 bg-stone-950 hover:bg-stone-800 active:bg-amber-800 active:text-stone-100 text-stone-100 font-extrabold text-xl rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center shadow-sm"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="py-3 bg-stone-950 hover:bg-stone-800 text-stone-400 font-bold text-sm rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleVerifyPin()}
                    disabled={pin.length < 4 || isLoading}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all touch-target-lg border-2 ${
                      pin.length >= 4 && !isLoading
                        ? 'bg-amber-800 hover:bg-amber-700 text-stone-100 border-[#D4AF37] shadow-xl'
                        : 'bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isLoading ? 'Sincronizando...' : 'Entrar a SeleShop'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* MODO 2: ENTRAR CON CORREO Y CONTRASEÑA                 */}
          {/* ══════════════════════════════════════════════════════ */}
          {authMode === 'PASSWORD' && (
            <form onSubmit={handleLoginWithEmail} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Correo Electrónico o Usuario *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="sele@comercio.com o Sele"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-3 text-stone-100 text-sm font-semibold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">
                  Contraseña *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-3 text-stone-100 text-sm font-semibold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all touch-target-lg shadow-xl"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{isLoading ? 'Verificando & Sincronizando...' : 'Iniciar Sesión & Sincronizar'}</span>
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* MODO 3: CREAR CUENTA / PRIMER REGISTRO                  */}
          {/* ══════════════════════════════════════════════════════ */}
          {authMode === 'REGISTER' && (
            <form onSubmit={handleRegisterAccount} className="space-y-3.5">
              <div className="border-b border-stone-800 pb-2.5">
                <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2 font-wabi">
                  <UserPlus className="w-5 h-5 text-stone-400" />
                  Crear Cuenta de Dueño
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Registra tu usuario con correo, contraseña y PIN para acceso rápido.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Nombre o Apodo *</label>
                <input
                  type="text"
                  placeholder="Ej. Sele"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Correo Electrónico (para sincronizar entre dispositivos) *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="email"
                    placeholder="sele@tudominio.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-sm font-semibold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Contraseña Principal *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-sm font-semibold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">PIN Rápido (4-6 dígitos) *</label>
                  <input
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="••••"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-black text-center text-lg tracking-widest focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">Confirmar PIN *</label>
                  <input
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="••••"
                    value={regPinConfirm}
                    onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-100 font-black text-center text-lg tracking-widest focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-5 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all touch-target-lg shadow-xl"
              >
                <span>Guardar Cuenta & Entrar</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {activeUsers.length > 0 && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('PIN'); setErrorMsg(null); }}
                    className="text-xs text-stone-400 hover:text-stone-200 font-bold"
                  >
                    ¿Ya tienes cuenta? <span className="text-amber-400 underline">Iniciar sesión</span>
                  </button>
                </div>
              )}
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
