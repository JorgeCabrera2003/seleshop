export const PRODUCT_CATEGORIES = [
  'Chucherías',
  'Dulces',
  'Chocolates',
  'Galletas',
  'Comida Chatarra',
  'Bebidas',
  'Otros',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number] | string;

export type UserRole = 'ADMIN' | 'CASHIER';

export interface User {
  id: string;
  name: string;
  email?: string;
  password?: string;
  username: string;
  role: UserRole;
  pin: string; // 4-6 digit PIN for fast login
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  user: User;
  token?: string;
  logged_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price_usd: number;
  stock_quantity: number;
  is_active: boolean;
  image_url?: string;
  user_id?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  full_name: string;
  whatsapp_number: string;
  created_at: string;
  notes?: string;
  user_id?: string;
}

export interface Sale {
  id: string;
  client_id: string | null; // null = venta anónima
  client_name?: string;
  total_usd: number;
  rate_at_time: number; // Tasa BCV congelada al milisegundo de la venta
  sale_timestamp: string;
  payment_type: 'CONTADO' | 'FIADO';
  user_id?: string;
  user_name?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price_usd: number;
}

export interface Debt {
  id: string;
  client_id: string;
  client_name?: string;
  whatsapp_number?: string;
  sale_id: string;
  amount_usd: number;
  due_date: string; // YYYY-MM-DD
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  notes?: string;
  user_id?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount_usd: number;
  category: 'MERCANCIA' | 'SERVICIOS' | 'TRANSPORTE' | 'OTROS';
  expense_date: string;
  user_id?: string;
  user_name?: string;
  created_at?: string;
}

export interface ExchangeRate {
  id: string;
  rate_ves: number;
  source_api: string;
  fetched_at: string;
}

export interface HistoricalRate {
  date: string; // YYYY-MM-DD
  rate_bcv: number;
  rate_paralelo?: number;
  source: string;
  fetched_at: string;
}

export interface SyncQueueItem {
  id: string;
  table_name: 'products' | 'clients' | 'sales' | 'sale_items' | 'debts' | 'expenses' | 'users';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  retries: number;
}

export type NavigationTab = 'pos' | 'inventory' | 'clients' | 'debts' | 'dashboard' | 'expenses' | 'dolar';

