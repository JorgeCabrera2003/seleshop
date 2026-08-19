'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, CloudUpload, CloudDownload, RefreshCw, CheckCircle2, AlertTriangle, Key, Link2, X } from 'lucide-react';
import { getSupabaseConfig, setSupabaseConfig, isSupabaseConfigured } from '../../lib/supabase/client';
import { processSyncQueue, pullAllFromSupabase } from '../../lib/sync/syncEngine';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncQueueCount: number;
  onSyncCompleted: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncQueueCount,
  onSyncCompleted,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const { url, key } = getSupabaseConfig();
      setSupabaseUrl(url);
      setSupabaseKey(key);
      setIsConfigured(Boolean(url && key));
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseConfig(supabaseUrl, supabaseKey);
    setIsConfigured(Boolean(supabaseUrl && supabaseKey));
    setStatusMsg({ type: 'success', text: 'Credenciales de Supabase guardadas exitosamente.' });
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Sincronizando operaciones y descargando datos más recientes...' });

    try {
      // 1. Push pending items
      const pushRes = await processSyncQueue();
      // 2. Pull all cloud updates
      const pullRes = await pullAllFromSupabase();

      onSyncCompleted();
      setIsSyncing(false);

      if (pullRes.success) {
        setStatusMsg({
          type: 'success',
          text: `Sincronización completada. ${pushRes.processed} cambios subidos y ${pullRes.count} registros actualizados.`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Error de conexión con la base de datos Supabase. Verifica tu URL y API Key.',
        });
      }
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
      setStatusMsg({ type: 'error', text: 'Error inesperado durante la sincronización.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border-t-2 sm:border-2 border-[#D4AF37] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-stone-400" />
            <h3 className="text-lg sm:text-xl font-bold text-stone-100 font-wabi">
              Sincronización Multidispositivo
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status indicator */}
        <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Estado de la Nube</span>
            <span className={`text-sm font-black flex items-center gap-1.5 mt-0.5 ${isConfigured ? 'text-amber-400' : 'text-stone-500'}`}>
              {isConfigured ? (
                <><CheckCircle2 className="w-4 h-4 text-amber-400" /> Conectado a Supabase</>
              ) : (
                <><AlertTriangle className="w-4 h-4 text-stone-500" /> Solo Almacenamiento Local</>
              )}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-stone-500 font-bold block">En cola local</span>
            <span className="text-sm font-black text-stone-200">{syncQueueCount} cambios</span>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-amber-900/30 border border-[#D4AF37]/50 text-stone-200'
                : statusMsg.type === 'error'
                ? 'bg-rose-900/30 border border-rose-500/50 text-rose-200'
                : 'bg-stone-800 text-stone-300 border border-stone-700'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Action Button: Sync All Devices */}
        {isConfigured && (
          <button
            onClick={handleFullSync}
            disabled={isSyncing}
            className="w-full py-3.5 px-4 bg-amber-800 hover:bg-amber-700 border-2 border-[#D4AF37] text-stone-100 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all touch-target-lg shadow-xl"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Dispositivos Ahora'}</span>
          </button>
        )}

        {/* Form to enter/update Supabase credentials */}
        <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2 border-t border-stone-800">
          <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Credenciales del Proyecto Supabase
          </h4>

          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">Project URL</label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-400 block mb-1">Anon / Public API Key</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-10 pr-3 py-2.5 text-stone-100 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border border-stone-700"
            >
              Guardar Credenciales
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
