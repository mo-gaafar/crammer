# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Server-only API keys are runtime-only and don't need to be set here.
# NEXT_PUBLIC_* vars are the exception: Next.js inlines them into the client
# bundle at build time, so they must be supplied as build args (see
# docker-compose.yml's `build.args` for the crammer service).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# The standalone output self-contains the Node server.
RUN npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install ffmpeg for video audio extraction
RUN apk add --no-cache ffmpeg

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone build artifacts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Create the upload directory with correct permissions
RUN mkdir -p /tmp/crammer-uploads && chown nextjs:nodejs /tmp/crammer-uploads

USER nextjs

EXPOSE 3000

# DEEPGRAM_API_KEY and GEMINI_API_KEY must be supplied at runtime
# (via Coolify environment variables, docker-compose env, or --env flags).
CMD ["node", "server.js"]
