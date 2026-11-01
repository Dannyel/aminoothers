-- Extensiones usadas por el modelo de datos (docs/fase-1/02-modelo-de-datos.md):
--   citext   : correos sin distinción de mayúsculas.
--   pg_trgm  : búsqueda de productos tolerante a errores de escritura.
--   unaccent : búsqueda sin distinción de tildes.
-- Las tres son extensiones "trusted": el dueño de la base de datos puede crearlas.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
