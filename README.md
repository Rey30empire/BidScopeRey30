# BitScopeRey30

BitScopeRey30 is a Next.js estimating workspace for subcontractors who need to turn noisy bid packages into a short, trade-focused review path.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma for persistence
- OpenAI Responses API for classification and scope analysis
- Local file ingestion for MVP, with Netlify-ready build settings

## Environment

Copy `.env.example` to `.env.local` for local app settings. The checked-in `.env` is pointed at the local SQLite file used for workstation testing.

Required values:

- `OPENAI_API_KEY`
- `DATABASE_URL`

Optional values:

- `OPENAI_MODEL`
- `APP_BASE_URL`
- `EMAIL_PROVIDER_NAME`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `ESTIMATE_TEST_EMAIL`

## Local development

```bash
bun install
bunx prisma generate
bunx prisma db push
bun run dev
```

## Test package

Use the sample ZIP at:

`BitScopeRey30+Datos/Proyecto para pruebas/Saucy_Frisco.zip`

## Netlify + Neon

The repo includes `netlify.toml` with a build command that generates Prisma using `prisma/schema.neon.prisma`.

Recommended deploy setup:

1. Create a Neon PostgreSQL database.
2. Set Netlify `DATABASE_URL` to the Neon connection string.
3. Set `OPENAI_API_KEY` and any email settings in Netlify environment variables.
4. Deploy from this repo root.

Local development remains on SQLite so the app can run on a workstation without a hosted database.

## Clean restart

Run `start-bitscope-clean.bat` from the repo root to:

- kill stale listeners on ports `3000` and `3001`
- remove `.next`, `.turbo`, and log residue
- reinstall packages
- regenerate Prisma
- launch a clean dev server
