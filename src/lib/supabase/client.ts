import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'seleshop_supabase_url';
const STORAGE_KEY_KEY = 'seleshop_supabase_anon_key';

const DEFAULT_URL = 'https://msqcgxmwhcodhhkynunq.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Gnx7SS1CZ_L-K9YpdRVQ3g_j-RLKo62';

export function getSupabaseConfig(): { url: string; key: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_URL_KEY);
    const localKey = localStorage.getItem(STORAGE_KEY_KEY);
    if (localUrl && localKey) {
      url = localUrl;
      key = localKey;
    }
  }

  return { url: url.trim(), key: key.trim() };
}

export function setSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url.trim() && key.trim()) {
      localStorage.setItem(STORAGE_URL_KEY, url.trim());
      localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_KEY_KEY);
    }
  }
}

let cachedClient: SupabaseClient | null = null;
let lastConfig = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  const currentConfig = `${url}:${key}`;
  if (cachedClient && lastConfig === currentConfig) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: true },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastConfig = currentConfig;
    return cachedClient;
  } catch (err) {
    console.error('Error instanciando cliente Supabase:', err);
    return null;
  }
}

export const isSupabaseConfigured = Boolean(getSupabaseConfig().url && getSupabaseConfig().key);
export const supabase = getSupabaseClient();
