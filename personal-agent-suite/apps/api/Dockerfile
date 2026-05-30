FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --filter @agent-suite/api... --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @agent-suite/config build
RUN pnpm --filter @agent-suite/shared-types build
RUN pnpm --filter @agent-suite/api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
CMD ["node", "apps/api/dist/apps/api/src/server.js"]
