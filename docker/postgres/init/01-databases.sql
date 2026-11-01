-- Se ejecuta solo al crear el volumen por primera vez.
-- farmacia_dev la crea la imagen (POSTGRES_DB); aquí se agregan prueba y sombra.
CREATE DATABASE farmacia_test OWNER farmacia;
CREATE DATABASE farmacia_shadow OWNER farmacia;
