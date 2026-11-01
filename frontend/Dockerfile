# syntax=docker/dockerfile:1
# Tienda y panel (SvelteKit con adapter-node, BFF).
ARG NODE_IMAGE=node:24.18.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN npm install -g pnpm@11.5.2 && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
# src/env.ts valida API_URL también al compilar; el valor real se toma al
# ejecutar (variable de entorno del contenedor).
RUN API_URL=http://backend:3000 pnpm build

FROM base AS deps
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    # Detrás de Caddy: protocolo e IP real del cliente.
    PROTOCOL_HEADER=x-forwarded-proto \
    HOST_HEADER=x-forwarded-host \
    ADDRESS_HEADER=x-forwarded-for \
    XFF_DEPTH=1 \
    # Comprobantes e imágenes de hasta 5 MB más el sobre multipart
    # (el valor por defecto de adapter-node, 512 KB, los rechaza con 413).
    BODY_SIZE_LIMIT=8M
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health',{headers:{'x-forwarded-proto':'https','x-forwarded-for':'127.0.0.1'}}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
