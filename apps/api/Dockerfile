# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY prisma prisma
RUN pnpm --filter @nmms/shared build \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build

FROM base AS dev
RUN corepack prepare pnpm@10.26.0 --activate
COPY --from=deps /repo /repo
COPY . .
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/node_modules /repo/node_modules
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
