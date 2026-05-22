# Trade Pricing Challenge — Sandbox

This is the sandbox monorepo for the coding challenge. Read the task description in **[`CHALLENGE.en.md`](./CHALLENGE.en.md)** (English) or **[`CHALLENGE.de.md`](./CHALLENGE.de.md)** (Deutsch). Then read **[`CONVENTIONS.md`](./CONVENTIONS.md)** for the coding conventions you must follow.

---

## 1. Prerequisites

- **Node.js 20+** (`.nvmrc` provided — `nvm use`)
- **Yarn 1.x** (classic)
- **Docker + Docker Compose**

That's it. PostgreSQL runs inside Docker.

---

## 2. Quickstart

Pick **one** of the two paths below.

### 2.1 Path A — Everything in Docker (simplest)

```bash
docker compose up --build
```

That's it. Each service's container runs its migrations and seed before starting, so on first boot you get a fully initialized database without any manual steps. Subsequent restarts are no-ops (migrations and seed are idempotent).

- Auth service: <http://localhost:3001/api/v1> — Swagger at <http://localhost:3001/api/docs>
- Pricing service: <http://localhost:3000/api/v1> — Swagger at <http://localhost:3000/api/docs>
- Partner portal (craftsmen): <http://localhost:4200>
- Admin portal: <http://localhost:4201>

### 2.2 Path B — Services on host, Postgres in Docker (faster hot-reload)

```bash
nvm use
yarn install
docker compose up -d postgres
yarn nx run auth-service:migration:run
yarn nx run pricing-service:migration:run
yarn nx run auth-service:seed
yarn nx run pricing-service:seed
```

In four terminals:

```bash
# Terminal 1
yarn nx serve auth-service          # port 3001
```

```bash
# Terminal 2
yarn nx serve pricing-service       # port 3000
```

```bash
# Terminal 3
yarn nx serve partner-portal        # port 4200
```

```bash
# Terminal 4
yarn nx serve admin-portal          # port 4201
```

Use Path B if you want NestJS hot-reload to be snappier — running outside Docker avoids the volume-mount filesystem overhead.

---

## 3. Architecture (sandbox)

```
   admin-portal              partner-portal
   (port 4201)               (port 4200)
        │   │                     │   │
        │   │  login   ┌──────────┘   │
        │   └──────┐   │              │  login
        │  data    │   │              │
        │          ▼   ▼              ▼
        │     ┌──────────────────────────────┐
        │     │   auth-service  (port 3001)  │
        │     │   schema: auth_service       │
        │     │   POST /auth/login,          │
        │     │   GET  /auth/me              │
        │     └──────────────────────────────┘
        │                       data
        │                ┌──────────────┘
        ▼                ▼
   ┌──────────────────────────────────┐
   │   pricing-service  (port 3000)   │
   │   schema: pricing_service        │
   │   craftsmen, trades, catalog,    │
   │   quote, …                       │
   └──────────────────────────────────┘

   shared JWT_SECRET — each service validates the JWT locally;
   no live call from pricing-service back to auth-service.
```

- **auth-service** issues JWTs at `POST /auth/login` and exposes `/auth/me`. It owns the `users` table.
- **pricing-service** owns craftsmen, trades, and (your work) the pricing catalog. It validates JWTs **locally** using the same `JWT_SECRET` — there is no live call from pricing-service to auth-service during request handling.
- **partner-portal** (`/4200`) is the craftsman-facing UI: my profile, my pricing catalog.
- **admin-portal** (`/4201`) is the admin-facing UI: configure trades and their pricing schemas. Rejects login by anyone who is not an `ADMIN`.
- Both portals store the token in `localStorage` and attach `Authorization: Bearer <jwt>` to every request, regardless of which service it goes to.

This mirrors the production pattern: each service owns its schema, JWTs are verified locally, and inter-service identity travels in the token claims.

---

## 4. Seeded credentials

| Role        | Email                 | Password     | Notes                                                                                                                                                   |
| ----------- | --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`     | `admin@example.com`   | `admin123`   | Full access; no `craftsmanId` claim. Use this in the **admin-portal** (`:4201`).                                                                        |
| `CRAFTSMAN` | `partner@example.com` | `partner123` | Bound to seeded craftsman (`11111111-1111-1111-1111-111111111111`) with `HVAC` and `WINDOWS` assignments. Use this in the **partner-portal** (`:4200`). |

// changed seeded craftsman id to viable v4 UUID
legacy_PARTNER_CRAFTSMAN_ID = '11111111-1111-1111-1111-111111111111';
PARTNER_CRAFTSMAN_ID = '11111111-1111-4111-a111-111111111111';

The admin-portal rejects login by non-admins; the partner-portal accepts both but its _My Profile_ page is craftsman-scoped (empty state for admins).

The partner craftsman's id is deterministic (`11111111-…`) so that auth-service and pricing-service seeds align without needing to read each other's database.

---

## 5. Project layout

```
trade-pricing-challenge/
├── apps/
│   ├── services/
│   │   ├── auth-service/        # NestJS — users, login, JWT issuance (port 3001)
│   │   └── pricing-service/     # NestJS — craftsmen, trades, your pricing catalog (port 3000)
│   ├── partner-portal/          # React + MUI — craftsman-facing UI (port 4200)
│   └── admin-portal/            # React + MUI — admin-facing UI (port 4201)
├── libs/
│   └── shared/
│       ├── auth/                # JWT guard, roles guard, decorators
│       └── types/               # Shared types: UserRole, JwtPayload, TRADE_CODES, etc.
├── infrastructure/
│   ├── postgres-init.sql        # Creates both service schemas on first Postgres boot
│   ├── localstack-compose.yml   # Opt-in LocalStack for the Terraform optional task
│   └── localstack-provider.tf.example
├── docker-compose.yml
├── CHALLENGE.en.md              # The brief (English)
├── CHALLENGE.de.md              # The brief (Deutsch)
├── CONVENTIONS.md               # Coding conventions (mandatory reading)
└── README.md                    # This file
```

### Key reference files

When you need to understand a convention, look at:

| Convention                     | Reference                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Entity shape                   | `apps/services/pricing-service/src/app/craftsmen/entities/craftsman.entity.ts` |
| DTO patterns                   | `apps/services/pricing-service/src/app/craftsmen/dto/`                         |
| Controller                     | `apps/services/pricing-service/src/app/craftsmen/craftsmen.controller.ts`      |
| Service + authz                | `apps/services/pricing-service/src/app/craftsmen/craftsmen.service.ts`         |
| Backend tests                  | `apps/services/pricing-service/src/app/craftsmen/*.spec.ts`                    |
| Migration                      | `apps/services/pricing-service/src/migrations/1704067200000-Init.ts`           |
| Local JWT validation           | `apps/services/pricing-service/src/app/auth/`                                  |
| MUI page with form (craftsman) | `apps/partner-portal/src/pages/ProfilePage.tsx`                                |
| MUI page with table (admin)    | `apps/admin-portal/src/pages/TradesPage.tsx`                                   |
| Admin-only login flow          | `apps/admin-portal/src/contexts/AuthContext.tsx`                               |
| i18n usage                     | `apps/partner-portal/src/i18n/locales/de.json`                                 |
| API clients (auth + main)      | `apps/admin-portal/src/services/api.service.ts`                                |

> Your work goes into `pricing-service`. **Do not** add new endpoints to `auth-service`; user identity belongs there and the challenge does not extend it.

---

## 6. Common commands

```bash
# Run a specific test file
yarn nx test pricing-service --testFile=craftsmen.service.spec.ts

# Run with coverage
yarn nx test pricing-service --coverage

# Lint a changed file
yarn eslint apps/services/pricing-service/src/app/<your-file>.ts

# Generate a new migration in pricing-service
yarn nx run pricing-service:migration:generate --args.name=AddPricingCatalogs

# Run pending migrations
yarn nx run pricing-service:migration:run
yarn nx run auth-service:migration:run

# Revert the last migration
yarn nx run pricing-service:migration:revert

# Reset the database from scratch
docker compose down -v
docker compose up -d postgres
yarn nx run auth-service:migration:run
yarn nx run pricing-service:migration:run
yarn nx run auth-service:seed
yarn nx run pricing-service:seed
```

---

## 7. Troubleshooting

**"relation does not exist" errors** —

- If `auth_service.users` or `pricing_service.craftsmen` does not exist on first boot, migrations did not run. Under Docker the entrypoint runs them automatically; if you skipped that (e.g. went straight to `docker compose up` against an older image), rebuild: `docker compose down && docker compose up --build`. Under Path B, run `yarn nx run auth-service:migration:run` and `yarn nx run pricing-service:migration:run` before starting the services.
- If the error is for one of _your_ tables, you likely forgot the schema prefix in a migration or raw query. Pricing-service tables live under `pricing_service.*`; auth-service tables live under `auth_service.*`. See `CONVENTIONS.md` §3.7.

**"jwt malformed" on every request** — the partner-portal stores the token in `localStorage`. Clear it via DevTools or run `localStorage.clear()` in the console.

**"Invalid credentials" on a valid password** — make sure you ran `yarn nx run auth-service:seed` after spinning up Postgres.

**Postgres won't start** — port 5432 is likely already in use. Override with `POSTGRES_PORT=5433 docker compose up -d postgres`.

**Tests pass locally but the suite is slow** — that's expected; the test database resets between suites. Run a single file with `--testFile=` while iterating.

---

## 8. Submitting

When you're done:

1. Create a **private repository in your own GitHub account** and push your work to it.
2. Invite **`christopher.maeuer@deutsche-sanierungsberatung.de`** as a collaborator on the repo (Settings → Collaborators → Add people, by email).
3. Send a short message letting us know the repo is ready, and include the repository URL.

Make sure that on a clean clone:

- `docker compose up --build` (or `podman-compose up --build`) brings the stack up end-to-end.
- Your `DESIGN.md` is at the repo root.
- `node_modules/`, `dist/`, and editor / OS files are gitignored.

Do not include any secrets, real customer data, or non-public code from previous employers.
