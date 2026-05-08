FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# --- Build shared ---
FROM deps AS build-shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
RUN pnpm --filter @member-platform/shared build

# --- Build API ---
FROM build-shared AS build-api
COPY apps/api apps/api
RUN pnpm --filter @member-platform/api build

# --- Production image ---
# Inherit from build-api which has all deps and built artifacts.
# pnpm hoists everything to /app/node_modules with workspace symlinks.
FROM build-api AS production
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/apps/api/src/main.js"]
