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

FROM base AS prod
ENV NODE_ENV=production

COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/node_modules /repo/node_modules
# pnpm links this workspace package from the API's node_modules directory.
# Keep the link target (and its production dependency links) in the runtime image.
COPY --from=build /repo/packages/shared /repo/packages/shared
COPY --from=build /repo/prisma/schema.prisma /repo/prisma/schema.prisma
COPY --from=build /repo/prisma/migrations /repo/prisma/migrations

WORKDIR /repo/apps/api

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema /repo/prisma/schema.prisma && exec node dist/main.js"]
