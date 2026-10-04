# A.P Realty Group Inc. — brokerage portal

Next.js 14 (App Router) + PostgreSQL + Prisma. Five screens: Dashboard, Listings & pipeline, Agent roster, Onboarding tracker and a yearly Illinois compliance checklist, with email/password sign-in and role-based access (Managing Broker / Admin / Agent).

The data model is described in [docs/data-models.md](docs/data-models.md).

## Local development

Requirements: Node 20+, and Docker (or any PostgreSQL 14+).

```bash
docker run -d --name ap-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ap_realty -p 5432:5432 postgres:16
cp .env.example .env          # then set AUTH_SECRET to a random 32+ character string
npm install
npx prisma migrate deploy     # create tables
npm run db:seed               # load demo data (refuses to run in production)
npm run dev                   # http://localhost:3000
```

Demo logins (all use the password `Password123!`, demo data only):

| Email | Role |
| --- | --- |
| omar@aprealty.test | Omar Lopez, Managing Broker: sees everything, approves commissions, updates compliance |
| admin@aprealty.test | Office Admin: manages escrows, marks commissions paid, updates compliance |
| adam@aprealty.test | Adam Delort, Broker: sees only his own deals, payouts and compliance items |
| lucy@aprealty.test | Lucy Castillo, Broker: same as Adam |

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (commission math, counters, permissions) plus database tests (close/cancel escrow, one open escrow per home). Needs `DATABASE_URL`. |
| `npm run lint` / `npx tsc --noEmit` | Lint / type check |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Reset and load demo data |

## Project layout

- `prisma/schema.prisma`: data model. `prisma/migrations/`: SQL migrations, including the partial unique index that allows only one open escrow per listing.
- `src/lib/calc.ts`: pure business math (commission splits, days on market, escrow day, contingency countdown, onboarding %, pacing).
- `src/lib/permissions.ts`: who can see and do what. All data queries go through these scopes.
- `src/lib/escrow.ts`: the close-escrow workflow (creates one payout per agent at their current tier) and the cancel-escrow workflow.
- `src/lib/compliance.ts`: the Illinois checklist catalog and yearly checklist generation (renewal-year items only in even years).
- `src/lib/queries.ts`: read models for each screen. `src/lib/actions.ts`: server actions (login, escrows, commissions, onboarding).
- `src/app/(app)/*`: the screens. `src/middleware.ts`: redirects signed-out users to `/login`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for signing session cookies (32+ characters) |
