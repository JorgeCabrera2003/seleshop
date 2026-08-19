-- =============================================================================
-- SELESHOP - ESQUEMA DE BASE DE DATOS RELACIONAL POSTGRESQL (SUPABASE)
-- =============================================================================

-- 1. TABLA: PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Abarrotes',
    price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN DEFAULT true,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    notes TEXT,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: TASAS DE CAMBIO (HISTÓRICO INMUTABLE)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_ves NUMERIC(12,4) NOT NULL CHECK (rate_ves > 0),
    source_api TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: VENTAS (CABECERA)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    total_usd NUMERIC(12,2) NOT NULL CHECK (total_usd >= 0),
    rate_at_time NUMERIC(12,4) NOT NULL CHECK (rate_at_time > 0), -- TASA BCV CONGELADA AL SEGUNDO EXACTO
    payment_type TEXT CHECK (payment_type IN ('CONTADO', 'FIADO')) DEFAULT 'CONTADO',
    user_id UUID DEFAULT auth.uid(),
    sale_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: DETALLE DE VENTAS (ITEMS)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_usd NUMERIC(12,2) NOT NULL CHECK (unit_price_usd >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: DEUDAS Y CUENTAS POR COBRAR (FIADO)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'PARTIAL', 'PAID')) DEFAULT 'PENDING',
    notes TEXT,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: GASTOS Y SALIDAS DE EFECTIVO
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
    category TEXT CHECK (category IN ('MERCANCIA', 'SERVICIOS', 'TRANSPORTE', 'OTROS')) DEFAULT 'OTROS',
    expense_date DATE DEFAULT CURRENT_DATE,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================================================
-- LOGICA DE NEGOCIO EN BASE DE DATOS: TRIGGER DE CONTROL DE INVENTARIO
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_and_deduct_stock()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Obtener stock actual del producto en forma transaccional
    SELECT stock_quantity INTO current_stock
    FROM public.products
    WHERE id = NEW.product_id
    FOR UPDATE;

    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Producto no existe en el catálogo.';
    END IF;

    IF current_stock < NEW.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %. Stock actual: %, Solicitado: %',
            NEW.product_id, current_stock, NEW.quantity;
    END IF;

    -- Descontar inventario
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger activado al insertar detalle de venta
DROP TRIGGER IF EXISTS trigger_deduct_stock ON public.sale_items;
CREATE TRIGGER trigger_deduct_stock
BEFORE INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.check_and_deduct_stock();


-- =============================================================================
-- SEGURIDAD DE NIVEL DE FILA (ROW LEVEL SECURITY - RLS)
-- =============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para el usuario autenticado
CREATE POLICY "Acceso total a productos del usuario" ON public.products
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Acceso total a clientes del usuario" ON public.clients
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Acceso total a ventas del usuario" ON public.sales
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Acceso total a detalles de ventas del usuario" ON public.sale_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sales s 
            WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Acceso total a deudas del usuario" ON public.debts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Acceso total a gastos del usuario" ON public.expenses
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Lectura pública de tasas de cambio" ON public.exchange_rates
    FOR SELECT USING (true);


-- =============================================================================
-- INSTRUCCIONES PG_CRON PARA POLING AUTOMATICO DE TASAS BCV EN SUPABASE
-- =============================================================================
/*
  Para habilitar el polling automático de la tasa oficial en Supabase Edge Functions:
  1. Habilitar la extensión pg_cron y pg_net en la consola de Supabase.
  2. Ejecutar la siguiente tarea cron para invocar la Edge Function cada hora:

  SELECT cron.schedule(
    'fetch-bcv-rate-hourly',
    '0 * * * *', -- Cada hora
    $$
    SELECT net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/fetch-bcv-rate',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    );
    $$
  );
*/
