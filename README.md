# NMMS — NGO Membership Management System

A monorepo for managing NGO memberships end-to-end: member onboarding and KYC,
applications, cards, payments and donations, events, referrals, notices, and
reporting — with a staff admin portal and a self-service member portal.

## Stack

- **API** ([apps/api](apps/api)) — NestJS on Fastify, Prisma/PostgreSQL, JWT auth
  (separate staff and member token pairs), Zod validation, Swagger docs.
- **Web** ([apps/web](apps/web)) — React 19 + Vite, TanStack Query, Zustand,
  Tailwind CSS, Radix UI.
- **E2E** ([apps/e2e](apps/e2e)) — end-to-end test suite.
- **Shared packages** ([packages/shared](packages/shared),
  [packages/config](packages/config)) — Zod schemas/types shared between API
  and web, and shared tooling config.

Managed as a [pnpm](https://pnpm.io) workspace with [Turborepo](https://turbo.build).

## Prerequisites

- Node.js >= 20
- pnpm 10 (see `packageManager` in [package.json](package.json))
- PostgreSQL (or Docker, to run it via `docker-compose.yml`)

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in secrets and DATABASE_URL

# start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d postgres

# apply migrations and seed data
pnpm --filter api prisma:migrate
pnpm --filter api db:seed

# run API and web together
pnpm dev
```

The API listens on `PORT` (default `3000`, prefixed with `/api/v1`); the web
app talks to it via `VITE_API_URL`. See [.env.example](.env.example) for all
required environment variables.

## Common scripts

Run from the repo root (Turborepo fans these out to each app):

| Command | Description |
| --- | --- |
| `pnpm dev` | Run API and web in watch mode |
| `pnpm build` | Build all apps/packages |
| `pnpm lint` | Lint all apps/packages |
| `pnpm typecheck` | Type-check all apps/packages |
| `pnpm test` | Run unit tests |

Scope any command to one app with `--filter`, e.g. `pnpm --filter api test`.

## Deployment

`docker-compose.yml` defines a production stack (Postgres, API, web, Nginx,
Traefik with Let's Encrypt). See [docker/](docker) for the Nginx config and
each app's `Dockerfile`.
