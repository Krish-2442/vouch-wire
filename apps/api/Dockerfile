# syntax=docker/dockerfile:1

# --- Base stage ---
FROM node:22.16-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# --- Development stage ---
FROM base AS development
RUN npm ci
COPY apps/api ./apps/api
EXPOSE 4000
CMD ["sh", "-c", "if [ ! -d /app/node_modules/express ]; then npm ci; fi && exec npm run dev --workspace=@vouchwire/api"]

# --- Production dependencies ---
FROM base AS production-deps
RUN npm ci --omit=dev

# --- Production stage ---
FROM node:22.16-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=production-deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
USER appuser
EXPOSE 4000
CMD ["npm", "start", "--workspace=@vouchwire/api"]
