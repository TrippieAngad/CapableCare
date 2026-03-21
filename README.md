<<<<<<< HEAD
# CapableCare
Hackathon project by Sean, Angad, Kerem
=======
# CapableCare Portal

Supabase-managed care coordination app built from the `capablecare_vision_doc`.

## Architecture

This repo is now Supabase-only:

- `frontend/`: React + TypeScript + Vite + `@supabase/supabase-js`
- `supabase/schema.sql`: base schema, auth trigger, RLS, plans, storage buckets
- `supabase/mvp-extension.sql`: trust, confidence, coordination, and proactive-risk additions
- `supabase/seed-demo.sql`: demo users' linked care data

There is no active custom backend service in this project anymore. Auth, database access, storage, and access control are handled by Supabase.

## Product scope in this repo

The current MVP includes:

- Dual-role auth for family members and caretakers
- Verified visit logging with check-in/check-out, checklist items, and structured assessments
- Care confidence and “what changed” summaries
- Weekly family brief
- Care plan and accessibility preferences
- Multi-family collaboration
- Tasks, appointments, and transportation coordination
- Incident reports and proactive alerts
- Messaging, support tickets, and subscription plans

## Demo accounts

- Customer: `family.capablecare@example.com`
- Caretaker: `caretaker.capablecare@example.com`

## Supabase setup

Schema/migrations already created for the app:

1. [`supabase/schema.sql`](./supabase/schema.sql)
2. [`supabase/mvp-extension.sql`](./supabase/mvp-extension.sql)
3. [`supabase/seed-demo.sql`](./supabase/seed-demo.sql)

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Important files

- App UI: [`frontend/src/App.tsx`](./frontend/src/App.tsx)
- Supabase client: [`frontend/src/lib/supabase.ts`](./frontend/src/lib/supabase.ts)
- Portal data layer: [`frontend/src/lib/portal.ts`](./frontend/src/lib/portal.ts)

## Notes

- Row-level security is part of the product model, not an optional add-on.
- If you change care access rules, update both SQL policies and the frontend query assumptions together.
- The old FastAPI prototype has been removed so the repo matches the deployed architecture.
>>>>>>> 6245efa (Initial commit: frontend, supabase schema, and project structure)
