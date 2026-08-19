# DESIGN.md — SeleShop POS Design System
# Fuente Única de la Verdad — Cerâmica Wabi-Sabi Edition

> **IMPORTANTE**: Todo componente o pantalla nueva en SeleShop DEBE adherirse a los tokens y reglas definidas en este documento. Prohibido usar colores, tamaños o radios no definidos aquí.

---

## 1. Filosofía de Diseño

**Wabi-Sabi Cerâmica** — Belleza en la imperfección, la sobriedad y lo contemplativo.

- **Minimalismo radical**: Cada elemento visual debe justificar su presencia. Si se puede quitar sin perder contexto, se quita.
- **Whitespace generoso**: El espacio vacío es parte del diseño, no un error.
- **Jerarquía por peso tipográfico**: La jerarquía se comunica con `font-weight` y `font-size`, no con colores distintos.
- **Flat-first**: Sin sombras pesadas. Profundidad solo mediante cambios sutiles de fondo o borde de 1px.
- **Accesibilidad táctil**: Todos los elementos interactivos tienen mínimo 56×56px para usuarios mayores y dispositivos móviles.

---

## 1b. Regla del 60/30/10 (Distribución Matemática de Color)

> Toda interfaz generada debe adherirse a esta distribución para eliminar saturación y fatiga visual.

| Proporción | Rol | Tokens |
|---|---|---|
| **60%** | Fondos y lienzo — la interfaz respira | `#181614` (dark) · `#FBF8F3` (light) |
| **30%** | Superficies, tarjetas, textos — estructuran sin llamar la atención | `#1E1B18`/`#FFFFFF` para cards · neutros de texto |
| **10%** | Acentos y CTAs — solo donde el ojo debe actuar | `#D4AF37` Gold (CTA dark) · `#9E5C10` Arcilla (CTA light) · `#C0392B` solo alertas críticas |

```
Si todo resalta, nada resalta.
Reserva el acento para un único CTA por pantalla.
```

---

## 2. Tokens de Color

```yaml
# Sistema bimodal: Oscuro (default) / Claro

dark_mode:
  bg_base:        "#181614"   # Fondo principal — Negro Carbón Orgánico
  bg_elevated:    "#1E1B18"   # Superficie elevada (cards, panels)
  bg_surface:     "#252219"   # Superficies secundarias
  text_primary:   "#FAF0E6"   # Texto principal — Crema Wabi
  text_secondary: "#8B8680"   # Texto secundario — Gris Piedra
  text_muted:     "#55504C"   # Texto atenuado / placeholders
  border_subtle:  "rgba(139,134,128,0.3)"   # Bordes sutiles
  border_strong:  "rgba(139,134,128,0.6)"   # Bordes definidos

light_mode:
  bg_base:        "#FBF8F3"   # Fondo principal — Crema Cálida
  bg_elevated:    "#FFFFFF"   # Superficie elevada (cards, panels)
  bg_surface:     "#F3ECE2"   # Superficies secundarias — Lino
  text_primary:   "#1F1C1A"   # Texto principal — Carbón Oscuro
  text_secondary: "#59524C"   # Texto secundario — Café Tierra
  text_muted:     "#9E9590"   # Texto atenuado / placeholders
  border_subtle:  "#E4DAD0"   # Bordes sutiles — Beige Arena
  border_strong:  "#C4B9AF"   # Bordes definidos

accent:
  kintsugi_gold:  "#D4AF37"   # Dorado Kintsugi — CTA Principal (dark)
  clay_brown:     "#9E5C10"   # Arcilla Oscura — CTA Principal (light)
  amber_warm:     "#B8751A"   # Ámbar Cálido — Hover / Active states
  rose_alert:     "#C0392B"   # Rojo Terra — Estados de error / alertas
  rose_alert_bg:  "rgba(192,57,43,0.12)"  # Fondo de alerta
```

---

## 3. Tipografía

```yaml
fonts:
  heading:   "'Cormorant Garamond', serif"   # Títulos contemplativos (class: font-wabi)
  body:      "system-ui, -apple-system, sans-serif"   # Cuerpo de texto

scale:
  xs:   "11px / 0.6875rem"   # Etiquetas micro, badges
  sm:   "13px / 0.8125rem"   # Texto secundario, helpers
  base: "16px / 1rem"        # Texto base de UI
  lg:   "18px / 1.125rem"    # Texto de accesibilidad (body global)
  xl:   "20px / 1.25rem"     # Subtítulos
  2xl:  "24px / 1.5rem"      # Títulos de módulo (font-wabi)
  3xl:  "30px / 1.875rem"    # Títulos grandes (totales, montos)

weights:
  regular:    400
  semibold:   600
  bold:       700
  extrabold:  800
  black:      900

line_height:
  tight:      1.2   # Títulos
  normal:     1.5   # Texto cuerpo
  relaxed:    1.7   # Párrafos largos
```

---

## 4. Espaciado (Grid 4pt/8pt)

```yaml
# Usar múltiplos de 4px. NO usar valores arbitrarios.
spacing:
  0.5: "2px"
  1:   "4px"
  2:   "8px"
  3:   "12px"
  4:   "16px"
  5:   "20px"
  6:   "24px"
  8:   "32px"
  10:  "40px"
  12:  "48px"
  16:  "64px"

padding_internal:
  card:    "16px / p-4"
  section: "24px / p-6"
  modal:   "24px / p-6"

gap:
  compact:  "8px / gap-2"
  default:  "12px / gap-3"
  relaxed:  "16px / gap-4"
  spacious: "24px / gap-6"
```

---

## 5. Bordes y Radio de Borde

```yaml
# FLAT-FIRST: Prefiere sin sombra. Si es necesario, usar shadow-sm.

border_width:   "1px"   # Ancho estándar de borde
border_width_accent: "2px"   # Bordes de CTA o elementos activos

radius:
  sm:   "8px  / rounded-lg"
  md:   "12px / rounded-xl"
  lg:   "16px / rounded-2xl"
  xl:   "24px / rounded-3xl"
  wabi: "18px 6px 20px 8px"   # Asimétrico Wabi-Sabi (class: wabi-card)
  pill: "9999px / rounded-full"

shadows:
  none:   "Preferido en diseño plano"
  subtle: "0 1px 4px rgba(0,0,0,0.06)"   # shadow-sm equivalente
  card:   "2px 6px 18px rgba(0,0,0,0.08)"   # Para .wabi-card
  modal:  "0 20px 60px rgba(0,0,0,0.3)"    # Solo para modales
```

---

## 6. Componentes Canónicos

### 6.1 Botón CTA Principal

```
- Fondo:        accent.kintsugi_gold → amber-800 bg
- Borde:        2px border-[#D4AF37]
- Texto:        text-stone-100 font-black text-sm
- Padding:      py-3 px-5
- Radius:       rounded-2xl
- Altura mín:   56px (touch-target-lg)
- Hover:        bg-amber-700 transition-all
- Disabled:     bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed
```

### 6.2 Botón Secundario / Outline

```
- Fondo:        transparent / bg-stone-900
- Borde:        1px border-stone-700
- Texto:        text-stone-300 font-bold text-xs
- Padding:      py-2 px-3
- Radius:       rounded-xl
- Hover:        bg-stone-800
```

### 6.3 Card de Producto (wabi-card)

```
- Border-radius: wabi asimétrico (18px 6px 20px 8px)
- Borde:         1px border var(--glass-border)
- Fondo:         bg-stone-900 (dark) / bg-white (light)
- Sombra:        2px 6px 18px rgba(0,0,0,0.08)
- Card activa:   border-2 border-[#D4AF37] ring-2 ring-[#D4AF37]/30
- Padding:       p-4
```

### 6.4 Input de Búsqueda

```
- Fondo:         bg-stone-900 (dark) / bg-white (light)
- Borde:         2px border-stone-700 focus:border-amber-500
- Texto:         text-lg font-bold
- Padding:       py-3.5 pl-13 pr-4
- Radius:        rounded-2xl
- Placeholder:   text-stone-400
```

### 6.5 Badge / Chip de Categoría

```
- Inactivo:      bg-stone-900 border-stone-700 text-stone-300
- Activo:        bg-amber-800 border-[#D4AF37]/60 text-stone-100
- Padding:       py-2 px-4
- Radius:        rounded-2xl
- Font:          font-bold text-sm
```

### 6.6 Navbar Inferior (Mobile)

```
- Fondo:         glass-panel
- Item inactivo: text-stone-400 font-bold
- Item activo:   bg-amber-800/90 text-stone-100 border-[#D4AF37]/60
- Icon size:     w-5 h-5
- Label size:    text-[11px]
- Height mín:    56px touch-target-lg
```

### 6.7 Panel / Modal

```
- Fondo:         bg-stone-900 (dark) / bg-white (light)
- Borde:         2px border-[#D4AF37]
- Radius:        rounded-3xl
- Padding:       p-6
- Sombra:        shadow-2xl (solo modales)
- Backdrop:      bg-black/80 backdrop-blur-md
```

---

## 7. Reglas de Accesibilidad

```yaml
touch_targets:
  minimum_size: "56×56px"  # class: touch-target-lg
  apply_to: "botones, tabs de navbar, chips de categoría, selects"

font_size_minimum: "11px"  # NUNCA usar tamaños menores en producción
contrast_ratio: "WCAG AA mínimo (4.5:1)"

focus_visible:
  style: "outline: 2px solid #D4AF37; outline-offset: 2px"
  note: "Visible solo con keyboard navigation"
```

---

## 8. Patrones Prohibidos

```
❌ NO inventar colores fuera de este documento
❌ NO usar sombras pesadas (drop-shadow > shadow-md)
❌ NO usar texto blanco (#fff) sobre fondos claros en modo luz
❌ NO usar emojis en textos de UI (solo en mensajes WhatsApp de cobro)
❌ NO usar fuentes distintas a Cormorant Garamond (heading) y system-ui (body)
❌ NO usar border-radius distintos a los definidos en el token radius
❌ NO duplicar lógica de componentes: abstraer en componentes reutilizables
❌ NO usar animate-pulse o animate-ping para indicadores permanentes
❌ NO usar textos completamente en MAYÚSCULAS salvo en CTAs de venta principal
```

---

## 9. Checklist de QA Visual (Pre-commit)

```
✅ ¿El componente funciona en dark mode y light mode?
✅ ¿Todos los touch targets miden al menos 56px?
✅ ¿Se usaron solo colores de la paleta definida?
✅ ¿El texto es legible en ambos modos? (contraste WCAG AA)
✅ ¿Se eliminó cualquier elemento visual innecesario?
✅ ¿El componente es mobile-first y responsive?
✅ ¿No hay sombras pesadas fuera de modales?
✅ ¿Los estados hover/focus/disabled están definidos?
```
