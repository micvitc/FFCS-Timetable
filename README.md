# FFCS Timetable Planner

A Next.js app for building and sharing FFCS (Fully Flexible Credit System) timetables. It includes authenticated scheduling, slot browsing, sharing, and feedback workflows.

## Features

- Timetable creation and validation
- Course and slot browsing
- Authenticated sharing and saved timetables
- Feature flags for controlled rollouts
- Telemetry with Sentry and PostHog

## Tech Stack

- Next.js 16 (App Router)
- React 19
- MongoDB with Mongoose
- NextAuth
- Tailwind CSS
- Flagsmith, Sentry, PostHog, Upstash Redis

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create your local environment file

```bash
cp .env.example .env.local
```

3. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Environment Variables

The example file lists all required variables: [.env.example](.env.example).

Minimum local setup typically needs:

- `MONGODB_URI`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional integrations (recommended for full parity):

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Flagsmith: `NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_ID`, `NEXT_PUBLIC_FLAGSMITH_API_URL`
- PostHog: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`
- Sentry: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`

For environment setup details and troubleshooting, see [docs/developer/ENV_SETUP.md](docs/developer/ENV_SETUP.md).

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - build for production
- `npm run start` - run the production server
- `npm run lint` - lint the codebase
- `npm run seed` - seed course data
- `npm run load:public` - load test public pages
- `npm run load:shared` - load test shared timetable pages
- `npm run load:auth` - load test authenticated flows
- `npm run load:all` - load test all scenarios

## Feature Flags

See [docs/feature-flags.md](docs/feature-flags.md) for naming, rollout rules, and cleanup guidance.

## Documentation

- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/agents.md](docs/agents.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

See [LICENSE](LICENSE).
