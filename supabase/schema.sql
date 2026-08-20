-- =============================================================================
-- SELESHOP POS - ESQUEMA DE BASE DE DATOS SUPABASE (MULTI-DISPOSITIVO)
-- =============================================================================

-- 0. TABLA: USUARIOS Y CAJEROS
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    password TEXT,
    username TEXT NOT NULL,
    role TEXT CHECK (role IN ('SUPERADMIN', 'ADMIN', 'CASHIER')) DEFAULT 'CASHIER',
    pin TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actualizar restricción de roles si la tabla ya existía
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('SUPERADMIN', 'ADMIN', 'CASHIER'));

-- 1. TABLA: PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Chucherías',
    price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    notes TEXT,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: TASAS DE CAMBIO
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id TEXT PRIMARY KEY,
    rate_ves NUMERIC(12,4) NOT NULL CHECK (rate_ves > 0),
    source_api TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: VENTAS
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    total_usd NUMERIC(12,2) NOT NULL CHECK (total_usd >= 0),
    rate_at_time NUMERIC(12,4) NOT NULL CHECK (rate_at_time > 0),
    payment_type TEXT CHECK (payment_type IN ('CONTADO', 'FIADO')) DEFAULT 'CONTADO',
    user_id TEXT,
    user_name TEXT,
    sale_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS public.sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT,
    product_id TEXT,
    product_name TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_usd NUMERIC(12,2) NOT NULL CHECK (unit_price_usd >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: DEUDAS / FIADOS
CREATE TABLE IF NOT EXISTS public.debts (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    whatsapp_number TEXT,
    sale_id TEXT,
    amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'PARTIAL', 'PAID')) DEFAULT 'PENDING',
    notes TEXT,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: GASTOS
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
    category TEXT CHECK (category IN ('MERCANCIA', 'SERVICIOS', 'TRANSPORTE', 'OTROS')) DEFAULT 'OTROS',
    expense_date DATE DEFAULT CURRENT_DATE,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- POLÍTICAS DE ACCESO RLS (IDEMPOTENTES: LECTURA/ESCRITURA CON ANON KEY)
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total a users" ON public.users;
CREATE POLICY "Acceso total a users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a products" ON public.products;
CREATE POLICY "Acceso total a products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a clients" ON public.clients;
CREATE POLICY "Acceso total a clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a sales" ON public.sales;
CREATE POLICY "Acceso total a sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a sale_items" ON public.sale_items;
CREATE POLICY "Acceso total a sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a debts" ON public.debts;
CREATE POLICY "Acceso total a debts" ON public.debts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a expenses" ON public.expenses;
CREATE POLICY "Acceso total a expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a exchange_rates" ON public.exchange_rates;
CREATE POLICY "Acceso total a exchange_rates" ON public.exchange_rates FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- HABILITAR REALTIME PARA SINCRONIZACIÓN EN VIVO MULTIDISPOSITIVO
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =============================================================================
-- INSERCIÓN INICIAL DE USUARIOS AUTORIZADOS
-- =============================================================================

INSERT INTO public.users (id, name, email, password, username, role, pin, is_active)
VALUES 
  ('usr-superadmin-jorge', 'Jorge Cabrera', 'jorge@seleshop.com', 'Jorge#Seleshop2026!', 'jorge', 'SUPERADMIN', '8492', true),
  ('usr-admin-sele', 'Sele', 'sele@seleshop.com', 'Sele*Tienda2026$', 'sele', 'ADMIN', '7361', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  pin = EXCLUDED.pin,
  is_active = EXCLUDED.is_active;
