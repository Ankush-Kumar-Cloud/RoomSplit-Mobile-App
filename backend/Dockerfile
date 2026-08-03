# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app
# Copy only package files first to leverage Docker layer caching.
# If package.json doesn't change, npm install won't re-run on rebuild.
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app
# Create non-root user for security — running as root in prod is a vulnerability
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY . .
# Set ownership to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000
# Use node directly (not nodemon) in production
CMD ["node", "server.js"]
