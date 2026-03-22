# CapableCare Portal

Supabase-managed care coordination app built from the `capablecare_vision_doc`.

## Architecture

This repo is primarily Supabase-managed with one minimal local helper service for signed ElevenLabs voice sessions:

- `frontend/`: React + TypeScript + Vite + `@supabase/supabase-js`
- `server/`: lightweight Node server for signed ElevenLabs conversation tokens
- `supabase/schema.sql`: base schema, auth trigger, RLS, plans, storage buckets
- `supabase/mvp-extension.sql`: trust, confidence, coordination, and proactive-risk additions
- `supabase/seed-demo.sql`: demo users' linked care data

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
npm run dev:server
npm run dev:frontend
```

## Environment

The repo includes a checked-in `frontend/.env` with the Supabase project URL and publishable client key so new clones can run immediately.

If you need to override that locally, create `frontend/.env.local` with:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GEMINI_MODEL=gemini-2.5-flash
```

Create `server/.env.local` with:

```bash
HOST=127.0.0.1
PORT=8787
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ELEVENLABS_AGENTS=Jack-english:agent_8901km9v6qmnfz4rmb2yqkqe6kwe,turkish-Deniz:agent_4501km9vd5r4e0yv2v7da4w9smej
ELEVENLABS_DEFAULT_AGENT_ID=agent_8901km9v6qmnfz4rmb2yqkqe6kwe
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

If you only want one voice agent, the server still supports the older single-agent env vars:

```bash
ELEVENLABS_AGENT_NAME=Jack-english
ELEVENLABS_AGENT_ID=agent_8901km9v6qmnfz4rmb2yqkqe6kwe
```

Do not add privileged credentials to the frontend:

- `SUPABASE_SERVICE_ROLE_KEY`
- database passwords
- direct Postgres connection strings

The chat flow now runs through `server/index.mjs`, which retrieves the signed-in user's permitted care data from Supabase before calling Gemini. The server can fall back to `frontend/.env` for the public Supabase URL/key, but the Gemini API key should live in `server/.env.local`.

## Persistent Document RAG

CapableCare now supports persistent document retrieval through Supabase-backed `document_sources` and `document_chunks` tables. The chat server retrieves those chunks with row-level security, ranks them with Gemini embeddings, and adds the best matches to the prompt.

Run the schema SQL so the new document tables and policies exist, then ingest documents with:

```bash
npm run rag:ingest -- --file ./CapableCare/docs/capablecare-community-guide.md --title "CapableCare Community Guide" --scope global --source-kind guide
```

To ingest a client-specific PDF:

```bash
npm run rag:ingest -- --file /absolute/path/to/elder-plan.pdf --title "Discharge Plan" --scope client --client-id your-elderly-client-uuid --source-kind pdf
```

Notes:

- The ingestion script uses `SUPABASE_SERVICE_ROLE_KEY` because it writes indexed chunks to Supabase.
- On this machine, PDF extraction uses macOS metadata via `mdls`. If the PDF does not expose extractable text there, export it to `.txt` or `.md` and ingest that file instead.
- The bundled `docs/capablecare-community-guide.md` remains as a local fallback if the persistent RAG tables have not been populated yet.

## Important files

- App UI: [`frontend/src/App.tsx`](./frontend/src/App.tsx)
- Supabase client: [`frontend/src/lib/supabase.ts`](./frontend/src/lib/supabase.ts)
- Portal data layer: [`frontend/src/lib/portal.ts`](./frontend/src/lib/portal.ts)
- App guide for retrieval: [`docs/capablecare-community-guide.md`](./docs/capablecare-community-guide.md)
- RAG ingestion script: [`scripts/ingest-document-rag.mjs`](./scripts/ingest-document-rag.mjs)

## Notes

- Row-level security is part of the product model, not an optional add-on.
- If you change care access rules, update both SQL policies and the frontend query assumptions together.
- The old FastAPI prototype has been removed so the repo matches the deployed architecture.
- ECareAI now uses both structured retrieval from Supabase and vector retrieval over the CapableCare guide document for app-specific tab and product-theme questions.
