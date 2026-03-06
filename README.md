# primecare-api

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

REST API backend for PrimeCare — a laundry e-commerce platform built as the final project for the Purwadhika Full Stack Web Development program. The React frontend lives in a separate repository: [`primecare-web`](https://github.com/briandalpa/primecare-web).

---

## Tech Stack

- Express 5, Node.js 22, TypeScript 5
- Prisma 7 + PostgreSQL 17 (via `pg` adapter)
- better-auth (auth + Google OAuth + email verification)
- Zod v4, bcrypt, uuid
- Nodemailer, Winston
- Midtrans (payment), OpenCage (geocoding), RajaOngkir (region data)
- Jest + Supertest (testing), nodemon + ts-node (dev), tsc-alias (build)

---

## Getting Started

**1. Clone the repository.**

```bash
git clone https://github.com/briandalpa/primecare-api.git
cd primecare-api
```

**2. Install dependencies.**

```bash
npm install
```

**3. Configure environment variables.**

```bash
cp .env.example .env
```

Open `.env` and fill in the values. See [`.env.example`](./.env.example) for the full list of variables with inline comments. The sections are:

- `PORT` and `DATABASE_URL` — server port and PostgreSQL connection string
- `BETTER_AUTH_*` — auth secret and base URL (set to the frontend origin)
- `GOOGLE_CLIENT_*` — Google OAuth credentials (optional for local development)
- `SMTP_*` — outgoing email; [Mailtrap](https://mailtrap.io) works well locally
- `MIDTRANS_*` — payment gateway keys; Sandbox is sufficient for development
- `OPENCAGE_API_KEY` — geocoding, used to assign the nearest outlet on pickup
- `RAJAONGKIR_API_KEY` — Indonesian region dropdowns

**4. Apply database migrations.**

```bash
npx prisma migrate dev
```

This applies all pending migrations and regenerates the Prisma client at `src/generated/prisma/`.

**5. Start the development server.**

```bash
npm run dev
```

The API will be available at `http://localhost:2000`.

---

## Commands

```bash
npm run dev       # development server (nodemon + ts-node)
npm run build     # compile TypeScript → dist/
npm start         # run compiled output
npm test          # Jest test suite
npm test -- path/to/file.test.ts  # single file

npx prisma migrate dev   # apply migrations + regenerate client
npx prisma generate      # regenerate client only
npx prisma studio        # database GUI
```

---

## Project Structure

```
primecare-api/
├── prisma/
│   ├── schema.prisma          # source of truth for all models and enums
│   └── migrations/
└── src/
    ├── main.ts                # entry point — starts Express on PORT (default 2000)
    ├── application/           # app setup, Prisma singleton, Winston logger
    ├── routes/                # public-api.ts (unauthenticated), api.ts (authenticated)
    ├── features/              # <feature>/{model,service,controller}.ts
    ├── middleware/            # auth-middleware, error-middleware
    ├── jobs/                  # auto-confirm cron job
    ├── utils/                 # auth, mailer, response helpers
    ├── error/
    ├── validations/
    ├── types/
    └── generated/prisma/      # do not edit manually
```

Each business domain in `src/features/<feature>/` follows a three-file pattern. The model file defines Zod schemas and infers TypeScript types from them. The service file holds all business logic and throws `ResponseError` for known failure states. The controller parses the request with `Validation.validate()`, delegates to the service, and writes the HTTP response.

---

## API Routes

```
/api/auth/*                              — sign-up, sign-in, email verification, Google OAuth (better-auth)
/api/v1/users/*                          — profile and saved address management
/api/v1/outlets/*                        — outlet CRUD (admin only)
/api/v1/pickup-requests                  — customer creates pickup; nearest outlet assigned via Haversine
/api/v1/pickup-requests/:id              — driver accepts a pending pickup
/api/v1/orders/*                         — order lifecycle management
/api/v1/orders/:id/payments              — payment initiation (Midtrans)
/api/v1/payments/webhook                 — Midtrans webhook (public, no auth)
/api/v1/orders/:id/stations/:station     — worker station processing
/api/v1/bypass-requests                  — worker submits; admin approves or rejects
/api/v1/deliveries/*                     — driver delivery flow
/api/v1/complaints                       — customer complaints
```

> `POST /api/v1/payments/webhook` is on the public router with no auth middleware. Midtrans authenticates requests with a server-key hash, not a session cookie.

---

## Key Business Rules

- **Nearest outlet** — assigned via Haversine formula on pickup request creation; rejects if no outlet is within its configured service radius
- **Station quantity gate** — workers re-enter item quantities at every station; mismatches block the order from advancing
- **Bypass flow** — worker requests bypass → outlet admin re-authenticates with password (session alone is not enough) + writes a problem description → approves or rejects
- **One-task driver** — a driver can only hold one active pickup or delivery at a time; a second accept returns `409 Conflict`
- **Payment gate** — delivery is only dispatched to drivers after payment status is `PAID`
- **Auto-confirm** — cron job marks orders `COMPLETED` 48 hours after `LAUNDRY_DELIVERED_TO_CUSTOMER` if the customer has not confirmed
