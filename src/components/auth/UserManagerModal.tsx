'use client';

import React, { useState } from 'react';
import { User, UserPlus, ShieldCheck, KeyRound, Edit2, Trash2, X, AlertTriangle, Check, UserCheck } from 'lucide-react';
import { User as UserType, UserRole } from '../../lib/types';
import { putToStore, deleteFromStore, addToSyncQueue } from '../../lib/db/indexeddb';

interface UserManagerModalProps {
  users: UserType[];
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshUsers: () => void;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({
  users,
  currentUserId,
  isOpen,
  onClose,
  onRefreshUsers,
}) => {
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setRole('CASHIER');
    setPin('');
    setErrorMsg(null);
    setShowAddForm(true);
  };

  const handleOpenEdit = (u: UserType) => {
    setEditingUser(u);
    setName(u.name);
    setRole(u.role);
    setPin(u.pin);
    setErrorMsg(null);
    setShowAddForm(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Ingresa el nombre del usuario.');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      setErrorMsg('El PIN debe tener entre 4 y 6 números.');
      return;
    }

    if (editingUser) {
      const updated: UserType = {
        ...editingUser,
        name: name.trim(),
        role,
        pin,
      };
      await putToStore('users', updated);
      await addToSyncQueue({ table_name: 'users', action: 'UPDATE', data: updated });
    } else {
      const newUser: UserType = {
        id: 'usr-' + Date.now(),
        name: name.trim(),
        username: name.trim().toLowerCase().replace(/\s+/g, '_'),
        role,
        pin,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      await putToStore('users', newUser);
      await addToSyncQueue({ table_name: 'users', action: 'INSERT', data: newUser });
    }

    onRefreshUsers();
    setShowAddForm(false);
    setEditingUser(null);
  };

  const handleDeleteUser = async (u: UserType) => {
    if (u.id === currentUserId) {
      alert('No puedes eliminar tu propio usuario activo.');
      return;
    }
    if (window.confirm(`¿Eliminar al usuario ${u.name}?`)) {
      await deleteFromStore('users', u.id);
      await addToSyncQueue({ table_name: 'users', action: 'DELETE', data: { id: u.id } });
      onRefreshUsers();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-stone-400" />
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 font-wabi">
              Gestión de Usuarios & Cajeros
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

        {/* User Form Modal (Inline) */}
        {showAddForm ? (
          <form onSubmit={handleSaveUser} className="space-y-4 bg-stone-950 p-4 rounded-2xl border border-stone-800">
            <h4 className="text-sm font-bold text-stone-200 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-stone-400" />
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario / Cajero'}
            </h4>

            <div>
              <label className="text-xs font-bold text-stone-400 block mb-1">Nombre Completo *</label>
              <input
                type="text"
                placeholder="Ej. Sele o Cajero 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Rol en el Sistema *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="CASHIER">Cajero / Vendedor</option>
                  <option value="ADMIN">Dueño / Administrador</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">PIN Numérico (4-6 dígitos) *</label>
                <input
                  type="password"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-stone-100 font-black text-center text-lg tracking-widest focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingUser(null); }}
                className="px-4 py-2 text-stone-400 hover:text-stone-100 text-xs font-bold rounded-xl border border-stone-700 hover:bg-stone-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-800 hover:bg-amber-700 text-stone-100 font-black text-xs rounded-xl border-2 border-[#D4AF37]"
              >
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Usuarios Registrados ({users.length})
              </span>
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-stone-100 font-bold text-xs rounded-xl border border-[#D4AF37] flex items-center gap-1 touch-target-lg"
              >
                <UserPlus className="w-3.5 h-3.5" /> Agregar Cajero
              </button>
            </div>

            <div className="space-y-2">
              {users.map((u) => {
                const isAdmin = u.role === 'ADMIN';
                const isCurrent = u.id === currentUserId;

                return (
                  <div
                    key={u.id}
                    className="bg-stone-950 border border-stone-800 p-3 rounded-2xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-sm text-stone-200 shrink-0">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-stone-100 text-sm truncate">{u.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.2 rounded border border-stone-700">
                              Tú
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-500 font-semibold block">
                          {isAdmin ? 'Administrador / Acceso Total' : 'Cajero / Punto de Venta'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-2 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                        title="Editar usuario o PIN"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 text-stone-400 hover:text-[#C0392B] hover:bg-stone-800 rounded-lg transition-colors touch-target-lg flex items-center justify-center"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
