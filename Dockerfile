# ── Stage 1: Build React client ──────────────────────────────────────────────
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Install server production dependencies ───────────────────────────
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Chromium and required font/SSL libraries for PDF generation with Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Non-root user (required by platform)
RUN addgroup -S app && adduser -S app -G app

# Server source
COPY --chown=app:app server/src ./server/src
COPY --chown=app:app server/package.json ./server/package.json

# Server dependencies (installed without devDeps in stage 2)
COPY --from=server-builder --chown=app:app /app/server/node_modules ./server/node_modules

# React build → served as static files by Express
COPY --from=client-builder --chown=app:app /app/client/dist ./server/src/public

USER app

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "server/src/server.js"]
