# CompanyGrow

**Employee Growth & Performance Platform** — a full-stack MERN application for role-based training, project allocation, performance tracking, and real-time bonus rewards.

[![CI](https://github.com/Ashmit-A-Rawat/CompanyGrow/actions/workflows/ci.yml/badge.svg)](https://github.com/Ashmit-A-Rawat/CompanyGrow/actions/workflows/ci.yml)

**Live demo:** [company-grow-rho.vercel.app](https://company-grow-rho.vercel.app) &nbsp;|&nbsp; **API:** [companygrow-backend-meud.onrender.com](https://companygrow-backend-meud.onrender.com)

> The backend is hosted on Render's free tier, which sleeps after inactivity — the first request after idle may take 30–60 seconds to respond.

---

## What it does

CompanyGrow connects three roles — **admin**, **manager**, and **employee** — around a single loop: employees take courses and get assigned to projects, completing either earns skill-coded badges, managers review and approve those badges, approved badges convert into real bonus payouts via Stripe, and every step along the way fires a live in-app notification and (optionally) an automated Slack/email/spreadsheet workflow through n8n.

## Features

- **Role-based dashboards** — separate admin, manager, and employee experiences with distinct permitted actions
- **Course catalog** — module-based courses with per-user progress tracking and badge rewards on completion
- **Project allocation** — managers assign employees to projects; completion awards badges and new skills
- **Performance tracking** — bi-monthly performance periods with goals, feedback, and earned badges per employee
- **Real-time notifications** — Socket.io, JWT-authenticated per connection, for badge approvals, project assignments, and completions
- **Stripe-backed bonus payouts** — managers convert approved badges into a real (test-mode) Stripe Checkout bonus payment
- **n8n automation** — badge approvals trigger an email; project assignments fan out to email, Slack, and a Google Sheets log
- **Analytics & PDF export** — Chart.js visualizations of performance/badge data, exportable as PDF via jsPDF + html2canvas
- **Automated tests + CI** — Jest/Supertest backend suite (17 tests, in-memory MongoDB, no external DB needed) running on every push via GitHub Actions

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Chart.js / react-chartjs-2, jsPDF + html2canvas, Socket.io client, lucide-react |
| Backend | Node.js, Express 5, Socket.io server, JWT (jsonwebtoken), bcryptjs |
| Database | MongoDB via Mongoose 8 |
| Payments | Stripe Checkout (test mode) |
| Automation | n8n (self-hosted via Docker), triggered by backend webhooks |
| Testing | Jest, Supertest, mongodb-memory-server |
| CI/CD | GitHub Actions |
| Hosting | Vercel (frontend), Render (backend) |

Full architectural detail — including known limitations and design trade-offs — is in [`docs/SOFTWARE_ARCHITECTURE.md`](docs/SOFTWARE_ARCHITECTURE.md) and [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md).

## Demo credentials

| Email | Password | Role |
|---|---|---|
| emily.johnson@example.com | password123 | employee |
| michael.thompson@example.com | password123 | manager |
| james.walker@example.com | password123 | admin |

> Seeded for development/demo purposes only. Running the seed scripts (see below) **wipes** the `users` and `courses` collections before repopulating them.

## Getting started locally

### Prerequisites

- Node.js 22.x
- A MongoDB connection string (local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- A [Stripe](https://dashboard.stripe.com/apikeys) account (test mode is fine)

### 1. Clone and install

```bash
git clone https://github.com/Ashmit-A-Rawat/CompanyGrow.git
cd CompanyGrow

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Copy each `.env.example` to `.env` and fill in real values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

See [Configuration](#configuration) below for what each variable does.

### 3. Seed demo data (optional, recommended)

```bash
cd backend
node seeds/user.seed.js
node seeds/course.seed.js
node seeds/project.seed.js
```

### 4. Run it

```bash
# terminal 1 — backend on :4000
cd backend && npm run dev

# terminal 2 — frontend on :3000
cd frontend && npm start
```

Log in at `http://localhost:3000` with one of the [demo credentials](#demo-credentials) above.

### 5. (Optional) Run the n8n automation locally

```bash
docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Open `http://localhost:5678`, build a workflow with a Webhook trigger, and point the matching `N8N_*_WEBHOOK_URL` variable in `backend/.env` at its production URL. Without this, badge approvals and project assignments still work — the app just skips the automation call (it's a non-blocking, best-effort `fetch`).

## Configuration

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Port the Express server listens on |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs/verifies JWT auth tokens |
| `STRIPE_SECRET_KEY` | Server-side Stripe key for Checkout session creation |
| `CLIENT_URL` | Frontend origin — used for Stripe redirect URLs **and** Socket.io CORS |
| `N8N_BADGE_APPROVED_WEBHOOK_URL` | Optional — n8n webhook fired when a manager approves a badge |
| `N8N_PROJECT_ASSIGNED_WEBHOOK_URL` | Optional — n8n webhook fired when a user is assigned to a project |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe key for Checkout redirect |
| `REACT_APP_API_URL` | Base URL of the backend API + Socket.io server |

## Testing

```bash
cd backend
npm test
```

17 tests across 5 suites — auth (signup/login), auth middleware, badge-approval + n8n webhook payloads, project-assignment + n8n webhook payloads, and Socket.io connection auth/isolation. Uses `mongodb-memory-server` so no real database is touched and no `.env` is required to run the suite.

The frontend does not currently have a maintained automated test suite beyond the default Create React App boilerplate — see [Known Limitations](docs/TECHNICAL_DOCUMENTATION.md#20-known-limitations) in the technical documentation.

## CI/CD

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request to `main`:

- **backend-tests** — `npm ci && npm test`
- **frontend-build** — `npm ci && npm run build`

Both must pass before merging.

## Project structure

```
CompanyGrow/
├── backend/
│   ├── app.js               # Express app (routes, middleware) — no side effects, testable
│   ├── server.js             # Entry point: Mongo connect, HTTP server, Socket.io init
│   ├── socket.js              # JWT-authenticated Socket.io server + notifyUser() helper
│   ├── controllers/           # Business logic, one file per resource
│   ├── models/                 # Mongoose schemas (User, Course, Project)
│   ├── routes/                  # Express routers
│   ├── middleware/auth.js        # JWT verification middleware
│   ├── seeds/                     # Demo data seed scripts
│   └── tests/                      # Jest + Supertest suite
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/ manager/ employee/   # Role-scoped dashboards and views
        │   └── dashboard/dashboardRouter.js # Routes to the right dashboard by role
        ├── components/NotificationBell.js  # Real-time notification bell (all 3 dashboards)
        ├── services/                       # socket.js (Socket.io client), api.js (unused, see docs)
        └── utils/api.js                    # Fetch wrapper: bearer token injection, 401 handling
```

## Deployment notes

- **Frontend (Vercel)**: root directory `frontend`, framework preset Create React App. Requires `CI=false` as an environment variable — Vercel sets `CI=1` by default, which makes CRA treat pre-existing ESLint warnings as build-breaking errors.
- **Backend (Render)**: root directory `backend`, start command `node server.js`. Set all backend env vars from the table above, with `CLIENT_URL` pointed at the real Vercel domain (required for Socket.io CORS to accept connections from the deployed frontend).
- **n8n**: not deployed publicly — the `N8N_*_WEBHOOK_URL` values point at `localhost:5678`, so automation only fires when running against a local backend with n8n running in Docker. See [Known Limitations](docs/TECHNICAL_DOCUMENTATION.md#20-known-limitations).

## Documentation

- [`docs/SOFTWARE_ARCHITECTURE.md`](docs/SOFTWARE_ARCHITECTURE.md) — system topology, component interaction, data flow, and architectural strengths/limitations
- [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) — full feature reference, API listing, database schema, security model, and known issues
