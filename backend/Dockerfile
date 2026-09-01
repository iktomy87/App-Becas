# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including devDependencies)
RUN npm install --legacy-peer-deps

# Copy Prisma schema and config
COPY prisma ./prisma/
COPY prisma7.config.ts ./

# Generate Prisma Client
RUN npx prisma generate

# Copy tsconfig files and source code
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production --legacy-peer-deps

# Copy generated Prisma Client from builder stage
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts

EXPOSE 3000

CMD ["node", "dist/main"]
