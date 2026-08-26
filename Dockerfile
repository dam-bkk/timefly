# syntax=docker/dockerfile:1.7
# One image, two entrypoints: web (default) and worker (CMD override).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,id=pnpm-timefly,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_VERSION=0.0.0
ARG GIT_SHA=local
ENV APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter @timefly/core test && pnpm --filter @timefly/web build

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=nonroot:nonroot /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nonroot:nonroot /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nonroot:nonroot /repo/apps/web/public ./apps/web/public
LABEL org.opencontainers.image.title="timefly" org.opencontainers.image.version=$APP_VERSION org.opencontainers.image.revision=$GIT_SHA
EXPOSE 3000
CMD ["apps/web/server.js"]
