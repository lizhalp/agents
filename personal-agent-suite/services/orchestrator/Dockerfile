FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY services/orchestrator/package.json services/orchestrator/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --filter @agent-suite/orchestrator... --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @agent-suite/config build
RUN pnpm --filter @agent-suite/orchestrator build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/orchestrator ./services/orchestrator
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
CMD ["node", "services/orchestrator/dist/services/orchestrator/src/worker.js"]
