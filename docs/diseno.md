# Sistema de diseño del frontend: «Carbón y piedra»

La tienda se presenta como un comercio en línea moderno y minimalista, no como una farmacia: sin verde dominante, cruces ni símbolos sanitarios. La dirección salió de la skill **UI/UX Pro Max**:

- **Sistema de diseño:** `--design-system "premium minimal ecommerce retail editorial modern"`.
- **Paleta:** perfil «E-commerce Luxury».
- **Tipografía:** pareja «Geometric Modern».

## Fundamentos

| Rol | Valor | Uso |
|---|---|---|
| Primario (`brand-700`, `stone-900`) | `#1C1917` carbón | Botones principales, texto fuerte, estados activos. Contraste 17:1 |
| Fondo (`canvas`) | `#FAFAF9` blanco roto cálido | Fondo de página |
| Superficie (`surface`) | `#FFFFFF` | Resúmenes, menús, diálogos |
| Hundido (`sunken`) | `#F3F2F0` | Fondo de las fotos de producto y de los bloques editoriales |
| Neutros | escala `stone` | Texto secundario (`stone-500` o más oscuro), bordes (`stone-200` y `stone-300`) |
| Acento (`accent-700`) | `#C2410C` naranja quemado | **Solo** ofertas, precio rebajado, contador del carrito y avisos de pocas unidades. Contraste 5.2:1 |
| Estados | `emerald` (éxito), `amber` (aviso), `red` (error), `sky` (información) | Siempre con texto o ícono, nunca solo color |

**Tipografía:**

| Uso | Fuente | Detalle |
|---|---|---|
| Títulos | Outfit (`font-display`) | Peso 400 a 500 y espaciado negativo en los grandes |
| Texto | Work Sans (`font-sans`) | 15 px, interlineado 1.6 |
| Rótulos | Clase `.eyebrow` | 12 px en mayúsculas con espaciado amplio |

**Escala de títulos:**

| Uso | Tamaño |
|---|---|
| Hero | 44 a 72 px |
| Título de página | 36 a 48 px |
| Sección | 30 a 36 px |
| Tarjeta | 15 px |

**Formas:**

- **Radios:** controles de 8 px; tarjetas de 16 a 24 px; botones y chips en píldora.
- **Elevación:** casi plana, con bordes de 1 px. La sombra `shadow-raised` es solo para lo que flota: menús, diálogos y el panel de filtros en móvil.

**Movimiento:**

- **Transiciones:** de 150 a 300 ms, con la curva `ease-out-soft`.
- **Entrada de contenido:** `animate-fade-up`.
- **Carga:** siluetas con `.skeleton`.
- **Preferencia del usuario:** todo se anula con `prefers-reduced-motion`.

**Espaciado:**

- **Escala:** la de Tailwind, en múltiplos de 4 px.
- **Secciones de la portada:** 96 px entre una y otra.
- **Márgenes laterales:** 16 px en móvil y 24 px en escritorio.

## Componentes

| Componente | Dónde |
|---|---|
| Botón (`primary`, `secondary`, `danger`, `ghost`; tamaños `sm`, `md`, `lg`) | `lib/components/ui/Button.svelte`; para enlaces, las clases `.btn .btn-primary` y `.btn .btn-secondary` |
| Campos, selects, casillas y archivos | Estilos base en `src/routes/layout.css`; `TextField` y `SelectField` |
| Selector de cantidad | `ui/QuantityStepper.svelte` (funciona sin JavaScript) |
| Pestañas | `ui/Tabs.svelte` (patrón WAI-ARIA, con flechas) |
| Diálogo de confirmación | `ui/ConfirmButton.svelte` (`<dialog>` nativo) |
| Desplegable | `<details>` (filtros en móvil) y `<select>` (orden) |
| Insignias y alertas | `ui/Badge.svelte`, `ui/Alert.svelte`, `store/AvailabilityBadge.svelte` |
| Tarjeta de producto y su silueta | `store/ProductCard.svelte`, `store/ProductCardSkeleton.svelte` |
| Progreso de compra | `store/CheckoutSteps.svelte` |
| Identidad | `store/BrandMark.svelte` (logotipo configurado o monograma) |
| Íconos | `ui/Icon.svelte`: trazos de Lucide (licencia ISC), sin emojis |

## Páginas de la tienda

- **Portada:**
  - hero editorial con fotos reales de los productos más recientes;
  - beneficios, categorías, novedades y ofertas.
- **Catálogo:**
  - filtros laterales (en móvil, un panel desplegable) y chips de filtros activos;
  - orden y paginación, con siluetas mientras carga.
- **Detalle:**
  - galería con miniaturas, precio con descuento y disponibilidad;
  - selector de cantidad y pestañas «Descripción», «Detalles» y «Uso responsable».
- **Carrito y checkout:** indicador de progreso, opciones como tarjetas seleccionables y resumen fijo.

### Límites conocidos

- **Ofertas:** la API no tiene un filtro de ofertas. La portada toma las vigentes de entre los 48 productos más recientes, que es el máximo por página.
- **Más vendidos:** no hay sección, porque la API no expone un ranking de ventas. Se decidió no ampliar la API.

## Fuentes alojadas en el sitio

La CSP solo permite `font-src 'self'`. Por eso Outfit y Work Sans se sirven desde `static/fonts/`: subconjunto latino, que cubre el español, en formato woff2 variable. Sus licencias OFL están junto a ellas.

## Reglas

- No usar el verde como color de marca ni íconos sanitarios en la interfaz de la tienda. Los textos regulatorios, como la licencia, el regente y el aviso, se mantienen en el pie.
- El acento naranja se reserva para ofertas y señales puntuales. Las acciones usan carbón.
- Los elementos táctiles miden al menos 44 px en pantallas táctiles.
- Todo texto de interfaz tiene un contraste mínimo de 4.5:1.
