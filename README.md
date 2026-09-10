# Fahmin — Full-Stack Real Estate CRM

A complete full-stack rebuild of the Fahmin CRM: a real Express + SQLite
backend with JWT authentication, and a redesigned React frontend with
sign-in/sign-up and a new "Midnight Emerald" theme (deep charcoal-green
with jade and gold accents).

## What changed from the original

- **Real backend** — Node.js + Express API backed by a SQLite database
  (via `better-sqlite3`), replacing the old `localStorage`-only version.
- **Authentication** — email/password sign-up and sign-in, passwords
  hashed with bcrypt, sessions handled with JWTs. Every account gets its
  own private, seeded workspace (leads, listings, deals, tasks).
- **Multi-user & data isolation** — every record is scoped to the signed-in
  user; one account can never see or edit another's data.
- **New theme** — "Midnight Emerald": dark charcoal-green surfaces, a
  jade-green primary accent, and warm gold highlights, with a two-panel
  sign-in/sign-up screen.
- **Same feature set** — dashboard, leads, listings, kanban pipeline,
  tasks, and analytics, now all reading and writing through the real API.
- **Profile page** — update your name/agency, change your password, see
  member-since date, sign out.
- **Messages / activity feed** — a notification bell with an unread badge
  logs new leads, new deals, pipeline stage changes, and completed tasks
  in real time; the Messages page lists them with mark-as-read and delete.
- **Calls** — schedule follow-up calls against a lead, see today/pending/
  total stats, and mark calls complete from the "Next calls" queue.
- **Inbox** — a unified, per-lead conversation view (styled like a
  WhatsApp thread) with an unread badge in the sidebar.
- **AI Assistant** — a real, Claude-powered sales copilot. It reads your
  live leads, pipeline, tasks and calls and answers questions or drafts
  follow-ups, grounded in your actual data. Requires an Anthropic API key
  (see below) — without one, the page tells you it isn't configured yet.
- **Settings** — workspace name/currency/timezone, notification and
  reminder preferences, and automation toggles (hot-lead alerts,
  missed-contact alerts, AI assistant on/off).

## Project structure

```
fahmin-crm/
├── server/              Express + SQLite API
│   ├── server.js        App entry point (serves API + frontend)
│   ├── db.js            SQLite schema/connection
│   ├── auth.js          JWT sign/verify middleware
│   ├── seed.js          Sample data for new accounts
│   └── routes/
│       ├── auth.js      /api/auth/signup, /login, /me
│       ├── crm.js       /api/contacts, /properties, /deals, /tasks
│       ├── calls.js     /api/calls
│       ├── inbox.js     /api/conversations
│       ├── settings.js  /api/settings
│       └── assistant.js /api/assistant/ask (calls the Anthropic API)
├── public/
│   └── index.html       Single-page React frontend (Babel in-browser)
└── README.md
```

## Running it locally

Requires Node.js 18+.

```bash
cd server
npm install
npm start
```

Then open **http://localhost:4000** — the same Express server serves
both the API and the frontend, so there's nothing else to configure.

By default it uses port `4000` and a dev JWT secret. To customize,
copy `server/.env.example` to `server/.env` and set your own values:

```
PORT=4000
JWT_SECRET=some-long-random-string
```

The SQLite database file is created automatically at
`server/data/fahmin.db` on first run.

## API overview

All `/api/*` routes except `/api/auth/*` and `/api/health` require a
`Authorization: Bearer <token>` header (the token returned from
signup/login).

| Method | Path                  | Description                     |
|--------|-----------------------|----------------------------------|
| POST   | /api/auth/signup      | Create an account (seeds data)   |
| POST   | /api/auth/login       | Sign in, returns a JWT           |
| GET    | /api/auth/me          | Current user                     |
| PUT    | /api/auth/profile     | Update name / agency             |
| PUT    | /api/auth/password    | Change password                  |
| GET    | /api/all              | All CRM data + activity feed + calls + conversations in one call |
| GET/POST/PUT/DELETE | /api/contacts    | Leads    |
| GET/POST/PUT/DELETE | /api/properties  | Listings |
| GET/POST/PUT/DELETE | /api/deals       | Pipeline |
| GET/POST/PUT/DELETE | /api/tasks       | Tasks    |
| GET    | /api/activities        | Activity/message feed (newest first) |
| PUT    | /api/activities/:id/read | Mark one message read |
| PUT    | /api/activities/read-all | Mark all messages read |
| DELETE | /api/activities/:id    | Delete a message |
| GET/POST/PUT/DELETE | /api/calls       | Scheduled calls |
| GET    | /api/conversations       | One row per lead with a conversation |
| GET/POST | /api/conversations/:contactId | Thread for one lead / send a message |
| GET/PUT  | /api/settings          | Workspace, preference & automation settings |
| POST   | /api/assistant/ask       | Ask the AI sales copilot a question |

## AI Assistant setup

The AI Assistant page calls the real Anthropic API from the server, so it
needs a key:

```
cd server
cp .env.example .env
# then edit .env and set:
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com. Without a key, the Assistant
page still loads — it just replies that it hasn't been configured yet
instead of erroring.

## Notes

- This is a demo-grade auth setup (JWT in `localStorage`) — good for a
  portfolio project, but for production you'd want refresh tokens,
  rate limiting, and HTTPS-only cookies.
- To reset all data, stop the server and delete `server/data/fahmin.db`.
