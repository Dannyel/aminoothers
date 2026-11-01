# ADR-004 · Catálogos y productos

- Fecha: 2026-11-01
- Estado: aprobada (Fase 4)

## Decisiones

1. **Catálogos simples con un solo servicio.** Marcas, fabricantes, presentaciones, concentraciones, principios activos y etiquetas tienen la misma forma (nombre, slug, estado, baja lógica). Siguen siendo tablas separadas, como aprobó la Fase 1, pero comparten `SimpleCatalogService` y la ruta `/admin/catalog/:kind`. Un elemento usado por productos vigentes no se elimina: se desactiva.
2. **Unicidad entre registros vigentes.** El slug de los catálogos y categorías es único solo entre los no eliminados (índices únicos parciales), para que una baja lógica no bloquee un nombre. El duplicado se detecta sin distinguir tildes ni mayúsculas ("Acetaminofén" = "acetaminofen"). El código de barras es único entre productos vigentes; el SKU es único siempre.
3. **Subcategoría coherente con la categoría:** FK compuesta `(subcategory_id, category_id) → subcategories(id, category_id)`. Si un producto cambia de categoría sin indicar subcategoría, la subcategoría se limpia.
4. **Búsqueda sin tildes** por nombre, SKU, código de barras, marca y principio activo, con una función `immutable_unaccent()` e índices de trigramas (`pg_trgm`). Reemplaza la columna `search_vector` del modelo de la Fase 1: con trigramas también hay coincidencias parciales ("acetam"), que son las habituales al buscar medicamentos.
5. **`requires_prescription` se calcula** a partir de `sale_condition` en la API y no se guarda. Prisma no maneja columnas generadas sin marcar diferencias en cada migración, y un dato derivado guardado podría quedar inconsistente.
6. **Venta en línea = verificación regulatoria**, con el permiso propio `products.approve_online_sale` (rol Regente farmacéutico; el Administrador no lo tiene). Queda registrado quién la aprobó y cuándo. En esta versión solo se habilitan productos **activos de venta libre (OTC)** (decisión D2). Cambiar la condición a una con receta, desactivar o dar de baja el producto deshabilita la venta en línea. La base de datos impide los controlados en línea y la habilitación sin aprobador (`CHECK`).
7. **Precio** en `DECIMAL(12,2)`, con IVA incluido (D1), enviado y devuelto como texto ("125.50") para no perder precisión. Debe ser mayor que cero (validado en la API y por `CHECK`).
8. **Imágenes:** JPEG, PNG o WebP validados por su firma binaria (no por el nombre ni el Content-Type), hasta `MAX_IMAGE_UPLOAD_MB` y 8 por producto. Se guardan en disco con nombre aleatorio (`StorageService`, reemplazable por S3) y se sirven en `GET /api/v1/files/:id` con caché inmutable. El frontend las expone en `/media/:id`. Siempre hay una sola imagen principal (índice único parcial). No se reprocesan las imágenes (sin `sharp`): queda pendiente quitar metadatos EXIF si se requiere.
9. **Tasas de impuesto** (`tax_rates`) creadas en esta fase porque el producto las referencia: IVA 12 % (predeterminada) y EXENTO, insertadas por la migración. Su administración llega en la Fase 8.
10. **Permisos nuevos:** `catalog.read`, `catalog.manage`, `products.read`, `products.manage`, `products.approve_online_sale`. Los selectores del formulario de producto (`/options`, categorías, tasas) solo exigen `products.read`.
11. **Enlaces del frontend** con `resolve()`. Cuando el enlace ya llega resuelto (menú, paginación), el archivo desactiva la regla de ESLint con un comentario que explica el motivo; el hook de ECC no permite cambiar la configuración de ESLint.

## Pendiente para fases posteriores

- La tienda (consulta pública del catálogo) es la Fase 6.
- La auditoría de cambios de productos y precios es la Fase 9.
- La disponibilidad (existencias) se mostrará al implementar el inventario en la Fase 5.
