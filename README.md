# BitScopeRey30

BitScopeRey30 is a Next.js estimating workspace for construction bid intake, internal review, professional estimate packaging, and tracked estimate delivery.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma
- OpenAI Responses API
- Resend-ready email delivery
- SQLite for local workstation development
- Neon / Netlify-ready schema for hosted deployments

## Estimate workflow

The app now separates estimate work into two professional document tracks:

### Client estimate version

Use this version for the client or GC.

Included:

- company header and contact details
- estimate number, date, version, validity
- project, client / GC, location, trade, bid due date
- executive summary
- scope of work
- inclusions
- exclusions
- clarifications
- qualifications
- proposal notes
- cost breakdown
- pricing summary
- prepared by / reviewed by
- optional acceptance area
- single final disclaimer

Removed from client output:

- AI inference wording
- confidence percentages
- inferred quantity language
- internal technical reasoning
- internal review comments
- internal notes

### Internal review version

Use this version for estimator and reviewer workflow.

Included in addition to client content:

- internal assumptions
- inferred data
- technical backing
- analysis notes
- review comments
- risk register
- suggested RFIs
- weather notes
- time estimate notes

## Premium PDF template

The default estimate export now uses a premium proposal layout based on the approved ornamental reference sheet:

- ivory / cream paper tone
- decorative frame and divider flourishes
- centered branding lockup
- fixed estimate metadata card on the upper right
- large centered proposal title
- two-column project information card
- structured material / pricing section
- cost breakdown table
- summary box
- clarifications and qualifications card
- fixed signature area
- generated-via-app footer note

The composition stays fixed. Only estimate data, branding fields, signature, logo, notes, and pricing values change.

## Status model

Operational statuses:

- Draft
- AI Processed
- Needs Human Review
- Review In Progress
- Internal Review Complete
- Client Version Ready
- Sent
- Opened
- Re-opened

Manual approval-only states:

- Approved for Client Export
- Approved for Send

Critical rule:

- The system never marks an estimate as approved automatically.
- Client export approval and send approval must be set manually by a human reviewer.

## Estimate delivery tracking

Every sent estimate creates a delivery record with:

- secure send token
- secure portal view URL
- secure download URL
- optional HTML tracking pixel URL

Tracked open event types:

- `portal_open`: real open inside the secure app viewer
- `pixel_open`: inferred open from email HTML pixel
- `download_open`: tracked secure download
- `re_open`: repeated opening after the first tracked event

### Important tracking limitations

Email open tracking is not 100 percent reliable.

Pixel tracking can be affected by:

- image blocking
- caching
- privacy relays
- client-side privacy tooling

For that reason the app keeps event type labels and treats pixel opens honestly as inferred events, while portal opens and secure download opens are stronger signals.

By default:

- every tracked open creates a separate event
- every tracked open triggers a separate internal notification email
- repeated opens are not grouped unless you add throttling yourself

## Environment

Copy `.env.example` to `.env.local` for local development.

Required:

- `DATABASE_URL`
- `OPENAI_API_KEY`

Recommended:

- `APP_BASE_URL`
- `EMAIL_PROVIDER_NAME`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `ESTIMATE_NOTIFICATION_EMAIL`
- `TRACKING_LINK_EXPIRATION_HOURS`
- `ENABLE_OPEN_TRACKING_PIXEL`
- `ALLOW_LOCAL_DELIVERY_LINKS`
- `TRACKING_RATE_LIMIT_WINDOW_SECONDS`
- `TRACKING_RATE_LIMIT_MAX_EVENTS_PER_SEND`
- `TRACKING_PIXEL_DEDUP_SECONDS`
- `TRACKING_PORTAL_DEDUP_SECONDS`
- `TRACKING_DOWNLOAD_DEDUP_SECONDS`

Hosted / Netlify / Neon:

- `NETLIFY_DATABASE_URL`
- `NETLIFY_DATABASE_URL_UNPOOLED`

Optional company / estimate defaults:

- `ESTIMATE_COMPANY_NAME`
- `ESTIMATE_COMPANY_PHONE`
- `ESTIMATE_COMPANY_ADDRESS`
- `ESTIMATE_PREPARED_BY`
- `ESTIMATE_REVIEWED_BY`
- `ESTIMATE_PREMIUM_SUBTITLE`
- `ESTIMATE_LOGO_URL`
- `ESTIMATE_SIGNATURE_IMAGE_URL`
- `ESTIMATE_SIGNATURE_TEXT`
- `ESTIMATE_FOOTER_GENERATED_BY_TEXT`
- `ESTIMATE_FOOTER_LEGAL_TEXT`
- `ENABLE_TRACKING_IP_ADDRESS`

## Local development

```bash
bun install
bunx prisma generate
bunx prisma db push
bun run dev
```

Production build test:

```bash
bun run build
```

## Clean restart

Run `start-bitscope-clean.bat` from the repo root to:

- stop stale listeners on ports `3000` and `3001`
- remove `.next`, `.turbo`, and local log residue
- regenerate Prisma
- push the local schema to SQLite
- start a clean local app session

## Test package

Sample ZIP:

`BitScopeRey30+Datos/Proyecto para pruebas/Saucy_Frisco.zip`

## Netlify + Neon

The repo includes `netlify.toml` and a Neon-oriented schema at `prisma/schema.neon.prisma`.

Recommended hosted setup:

1. Provision Neon through Netlify or connect an existing Neon project.
2. Set `NETLIFY_DATABASE_URL` and `NETLIFY_DATABASE_URL_UNPOOLED`.
3. Set `OPENAI_API_KEY`.
4. Set the email env vars for sending and notifications.
5. Deploy from the repo root.

## Notification routing

Internal open notifications are sent to:

1. `ESTIMATE_NOTIFICATION_EMAIL`
2. fallback `ESTIMATE_TEST_EMAIL`
3. fallback parsed `EMAIL_FROM`

## Notes

- All estimate PDF exports are now forced through the premium template stack. There is no supported plain or legacy PDF mode.
- The legacy project-level analysis export and email routes still exist for raw bid-analysis output.
- The professional estimate workflow now lives in the estimate workbench and the `/api/estimates/*` routes.
- Client estimate emails should be sent from the deployed app origin or with `APP_BASE_URL` set to the public HTTPS app URL. If the app only resolves to `localhost`, delivery is blocked by default so broken or insecure links are not emailed to clients.
- `ALLOW_LOCAL_DELIVERY_LINKS=true` is available only for deliberate local QA. It is no longer auto-enabled by `ESTIMATE_TEST_EMAIL`, so localhost links will stay blocked unless you explicitly opt in.
- Tracking keeps counting legitimate opens individually, but the delivery endpoints now support configurable burst protection. The default send-window guard is permissive (`30` events per send per `60` seconds) so normal re-opens still register separately.
- Exact duplicate suppression is configurable per source via `TRACKING_PIXEL_DEDUP_SECONDS`, `TRACKING_PORTAL_DEDUP_SECONDS`, and `TRACKING_DOWNLOAD_DEDUP_SECONDS`. Leave them at `0` if you do not want deduplication.
