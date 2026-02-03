# Multi-stage build for Next.js app

ARG NODE_VERSION=20-alpine

# ---------- Builder ----------
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Proxy only for build/install steps (optional)
ARG http_proxy
ARG https_proxy
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV HTTP_PROXY=${http_proxy}
ENV HTTPS_PROXY=${https_proxy}

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---------- Runner ----------
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Data dir inside container (will be bound to host /opt/monitoring/pam)
ENV DATA_DIR=/opt/monitoring/pam

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src

# Prepare data dir
RUN mkdir -p "${DATA_DIR}"

EXPOSE 3000

CMD ["npm", "run", "start"]


