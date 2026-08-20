'use client';

import React, { useState } from 'react';
import { User as UserIcon, Lock, KeyRound, Mail, Eye, EyeOff, Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { User, AuthSession } from '../../lib/types';
import { putToStore, addToSyncQueue, setActiveSession } from '../../lib/db/indexeddb';

interface ProfileSettingsModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: User) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email || '');
  const [pin, setPin] = useState(currentUser.pin);
  const [password, setPassword] = useState(currentUser.password || '');
  
  // Show/Hide password & PIN toggles
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      setErrorMsg('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }

    setIsSaving(true);
    try {
      const updated: User = {
        ...currentUser,
        name: name.trim(),
        email: email.trim() || undefined,
        pin: pin.trim(),
        password: password.trim() || undefined,
      };

      await putToStore('users', updated);
      await addToSyncQueue({ table_name: 'users', action: 'UPDATE', data: updated });

      // Update active session
      const newSession: AuthSession = {
        user: updated,
        logged_at: new Date().toISOString(),
      };
      setActiveSession(newSession);

      setSuccessMsg('¡Datos actualizados y sincronizados con éxito!');
      onProfileUpdated(updated);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 font-wabi">
              Mi Perfil & Seguridad
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            className="border border-[#C0392B]/60 text-stone-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ backgroundColor: 'rgba(192,57,43,0.14)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#C0392B]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-amber-900/30 border border-[#D4AF37]/50 text-stone-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">Nombre de Usuario *</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-sm font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Correo */}
          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-sm font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* PIN con botón Ver/Ocultar */}
          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">PIN de Acceso Rápido (4-6 dígitos) *</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-10 py-2.5 text-stone-100 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-amber-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1"
                title={showPin ? 'Ocultar PIN' : 'Ver PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Contraseña con botón Ver/Ocultar */}
          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">Contraseña Principal</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-10 py-2.5 text-stone-100 text-sm font-mono focus:outline-none focus:border-amber-500"
                placeholder="Escribe tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-400 hover:text-stone-100 text-xs font-bold rounded-xl border border-stone-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black text-xs rounded-xl border-2 border-[#D4AF37] flex items-center gap-1.5 shadow-lg"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
