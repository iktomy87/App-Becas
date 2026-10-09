# syntax=docker/dockerfile:1

# ---------- Base: apt + openssl UNA sola vez (compartida por todas las etapas) ----------
FROM node:20-slim AS base
WORKDIR /app
# `procps` es obligatorio, no opcional: `nest start --watch` lanza `ps -o pid
# --no-headers --ppid <n>` para seguir los procesos hijos. node:20-slim no lo
# trae, así que sin esto el watcher compila bien, imprime "Found 0 errors.
# Watching for file changes." y al primer recompilado —que en Docker dispara
# cualquier cambio en el código montado como volumen— muere con
# `Error: spawn ps ENOENT` y el contenedor sale con código 1.
#
# El síntoma es desconcertante: la API y el worker usan el mismo comando sobre la
# misma imagen, así que uno puede llevar minutos vivo y caerse justo cuando se
# toca un archivo. Y si cae el worker, los jobs de importación quedan en Redis
# sin consumir y el frontend —que sondea en `while (true)` sin timeout— queda
# cargando para siempre.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get -o Acquire::Retries=3 update -y && \
    apt-get -o Acquire::Retries=3 install -y --no-install-recommends openssl ca-certificates procps

# ---------- Deps completas (dev incluidas) ----------
FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps && \
    test -f node_modules/.bin/prisma || (echo "ERROR: prisma binary not found after npm ci" && exit 1)

# ---------- Deps de producción (se construye en paralelo con `deps`) ----------
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-peer-deps && \
    test -f node_modules/.bin/prisma || (echo "ERROR: prisma binary not found after npm ci" && exit 1)

# ---------- Build ----------
FROM deps AS builder
COPY prisma ./prisma/
COPY prisma7.config.ts ./
RUN node_modules/.bin/prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime ----------
FROM base AS runner
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts

EXPOSE 3000
CMD ["node", "dist/main"]