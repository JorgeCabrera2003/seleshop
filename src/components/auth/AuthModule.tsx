'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, KeyRound, UserPlus, ArrowRight, AlertTriangle, Check, Delete } from 'lucide-react';
import { User as UserType, AuthSession } from '../../lib/types';
import { putToStore, addToSyncQueue, setActiveSession } from '../../lib/db/indexeddb';

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
  const [selectedUser, setSelectedUser] = useState<UserType | null>(() => {
    return users.length === 1 ? users[0] : null;
  });
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initial Admin Registration Form (when database has 0 users)
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminPinConfirm, setAdminPinConfirm] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const activeUsers = users.filter((u) => u.is_active);

  // Keypad numbers
  const handleKeypadPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg(null);

      // Auto-submit if pin reaches selectedUser pin length
      if (selectedUser && nextPin === selectedUser.pin) {
        performLogin(selectedUser);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const performLogin = (userToLogin: UserType) => {
    const session: AuthSession = {
      user: userToLogin,
      logged_at: new Date().toISOString(),
    };
    setActiveSession(session);
    onLoginSuccess(session);
  };

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

  const handleRegisterFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      setErrorMsg('Ingresa tu nombre.');
      return;
    }
    if (adminPin.length < 4 || adminPin.length > 6) {
      setErrorMsg('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    if (adminPin !== adminPinConfirm) {
      setErrorMsg('Los PIN ingresados no coinciden.');
      return;
    }

    const newAdmin: UserType = {
      id: 'usr-' + Date.now(),
      name: adminName.trim(),
      username: adminName.trim().toLowerCase().replace(/\s+/g, '_'),
      role: 'ADMIN',
      pin: adminPin,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await putToStore('users', newAdmin);
    await addToSyncQueue({ table_name: 'users', action: 'INSERT', data: newAdmin });
    onRefreshUsers();
    performLogin(newAdmin);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#181614' }}>
      <div className="w-full max-w-md space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-amber-800 border-2 border-[#D4AF37] flex items-center justify-center font-bold text-stone-100 text-3xl shadow-2xl mx-auto">
            S
          </div>
          <h1 className="text-3xl font-black text-stone-100 font-wabi tracking-tight">SeleShop POS</h1>
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

        {/* ── CASE 1: First-time setup (0 Users) ────────────────── */}
        {activeUsers.length === 0 ? (
          <div className="wabi-card bg-stone-900 p-6 sm:p-7 space-y-5 border-2 border-[#D4AF37]/50 shadow-2xl">
            <div className="border-b border-stone-800 pb-3">
              <h2 className="text-lg font-bold text-stone-100 flex items-center gap-2 font-wabi">
                <UserPlus className="w-5 h-5 text-stone-400" />
                Bienvenido · Configuración Inicial
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Crea la cuenta del <strong>Dueño / Administrador</strong> para comenzar a operar.
              </p>
            </div>

            <form onSubmit={handleRegisterFirstAdmin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Nombre o Apodo *</label>
                <input
                  type="text"
                  placeholder="Ej. Jorge Cabrera"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">PIN de Acceso (4-6 dígitos) *</label>
                  <input
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="••••"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-black text-center text-xl tracking-widest focus:outline-none focus:border-amber-500"
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
                    value={adminPinConfirm}
                    onChange={(e) => setAdminPinConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-stone-100 font-black text-center text-xl tracking-widest focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all touch-target-lg shadow-xl"
              >
                <span>Crear Cuenta & Comenzar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* ── CASE 2: Regular Login Flow ───────────────────────── */
          <div className="wabi-card bg-stone-900 p-6 sm:p-7 space-y-5 border border-stone-800 shadow-2xl">
            
            {/* User Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                Selecciona tu usuario
              </label>

              <div className="grid grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
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
                      className={`p-3 rounded-2xl border-2 flex flex-col items-start justify-between text-left transition-all touch-target-lg ${
                        isSelected
                          ? 'bg-amber-900/30 border-[#D4AF37] text-stone-100'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-xs text-stone-200">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isAdmin ? 'text-amber-400' : 'text-stone-400'}`}>
                          {isAdmin ? 'Dueño' : 'Cajero'}
                        </span>
                      </div>
                      <span className="font-extrabold text-sm text-stone-100 truncate w-full">{u.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN Display & Keypad */}
            {selectedUser && (
              <div className="space-y-4 pt-2 border-t border-stone-800">
                <div className="text-center space-y-1">
                  <span className="text-xs font-bold text-stone-400">
                    Ingresa el PIN de <strong className="text-stone-100">{selectedUser.name}</strong>
                  </span>

                  {/* PIN Dots Display */}
                  <div className="flex justify-center items-center gap-3 py-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div
                        key={index}
                        className={`w-3.5 h-3.5 rounded-full transition-all ${
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
                      className="py-3.5 bg-stone-950 hover:bg-stone-800 active:bg-amber-800 active:text-stone-100 text-stone-100 font-extrabold text-xl rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center shadow-sm"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="py-3.5 bg-stone-950 hover:bg-stone-800 text-stone-500 font-bold text-xs rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-3.5 bg-stone-950 hover:bg-stone-800 active:bg-amber-800 active:text-stone-100 text-stone-100 font-extrabold text-xl rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-3.5 bg-stone-950 hover:bg-stone-800 text-stone-400 font-bold text-sm rounded-xl border border-stone-800 transition-all touch-target-lg flex items-center justify-center"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                {/* Submit Action */}
                <button
                  type="button"
                  onClick={() => handleVerifyPin()}
                  disabled={pin.length < 4}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all touch-target-lg border-2 ${
                    pin.length >= 4
                      ? 'bg-amber-800 hover:bg-amber-700 text-stone-100 border-[#D4AF37] shadow-xl'
                      : 'bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Entrar a SeleShop
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
