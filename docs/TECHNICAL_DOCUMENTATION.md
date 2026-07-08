# CompanyGrow — Technical Documentation

**A MERN-Stack Employee Growth, Performance & Bonus-Payout Platform**

Document Type: Technical Reference & System Documentation
Source: Direct analysis of the CompanyGrow codebase
Prepared for: Technical review, portfolio presentation, developer onboarding
July 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Introduction](#2-introduction)
3. [Problem Statement](#3-problem-statement)
4. [Project Objectives](#4-project-objectives)
5. [Project Overview](#5-project-overview)
6. [Core Features](#6-core-features)
7. [Functional Modules](#7-functional-modules)
8. [User Workflow](#8-user-workflow)
9. [Technology Stack](#9-technology-stack)
10. [System Architecture](#10-system-architecture)
11. [Project Structure](#11-project-structure)
12. [Installation & Setup](#12-installation--setup)
13. [Configuration](#13-configuration)
14. [Usage Guide](#14-usage-guide)
15. [API Overview](#15-api-overview)
16. [Database Overview](#16-database-overview)
17. [External Integrations](#17-external-integrations)
18. [Security Features](#18-security-features)
19. [Performance Considerations](#19-performance-considerations)
20. [Known Limitations](#20-known-limitations)
21. [Future Enhancements](#21-future-enhancements)
22. [Conclusion](#22-conclusion)

---

## 1. Executive Summary

CompanyGrow is a MERN-stack (MongoDB, Express, React, Node.js) web platform that connects three user roles — **employee**, **manager**, and **admin** — around a single operational loop: employees complete courses and get assigned to projects, completion of either awards a skill-coded badge, a manager reviews and approves those badges, and approved badges convert into a real (Stripe test-mode) bonus payment. Every step in that loop fires a JWT-authenticated, real-time Socket.IO notification, and two of the four notification events additionally trigger an n8n workflow-automation webhook (email, Slack, and Google Sheets logging, depending on the configured n8n workflow).

This document is produced directly from the CompanyGrow codebase — every feature, endpoint, and schema field described here is backed by a specific file in the repository. Where a detail is not implemented (a formal business model, a role-authorization middleware, a persisted notification history), this is stated explicitly rather than assumed.

The platform is implemented as two processes — a single Express API and a React frontend — backed by a three-collection MongoDB schema, and is **actually deployed**: the frontend on Vercel, the backend on Render. A 17-test Jest/Supertest suite runs against an in-memory MongoDB in GitHub Actions on every push.

## 2. Introduction

CompanyGrow addresses a common internal-tooling need: giving managers and employees one place to track training progress, project involvement, and performance-based rewards, instead of splitting that across a course platform, a project tracker, a spreadsheet of performance ratings, and a separate payroll/bonus process. The system is built using the MERN stack, supplemented by Socket.IO for real-time notifications, Stripe for bonus payments, and n8n for optional workflow automation.

The platform distinguishes between three account roles — **employee**, **manager**, and **admin** — each with a dedicated dashboard. Unlike a system with fine-grained, server-enforced permissions per role, CompanyGrow's role separation is primarily a **frontend concern**: the backend's only authorization check is "is this request authenticated," not "is this authenticated user's role permitted to do this" (see Section 18.2).

## 3. Problem Statement

The codebase does not contain an explicit, standalone problem statement. The following is inferred from the platform's implemented feature set, not a verbatim statement from the source:

> Organizations often manage employee development, project staffing, and performance-based compensation as separate, disconnected processes: a training LMS for courses, a project-management tool for assignments, a spreadsheet or HR system for performance ratings, and a manual, out-of-band process for approving and paying bonuses. This makes it hard for a manager to see, in one place, what an employee has actually accomplished (courses finished, projects delivered) and to convert that directly into a recognized reward.

CompanyGrow's implementation addresses this by co-locating course completion, project completion, badge-based recognition, and Stripe-backed bonus payment inside one application, with real-time notification the moment any of these happen.

## 4. Project Objectives

Based on the implemented feature set:

- Provide a course catalog with per-module progress tracking and completion-triggered badge rewards.
- Provide a project-allocation system where managers assign employees and completion triggers the same badge/skill-reward mechanism as course completion.
- Track performance in bi-monthly periods per employee, aggregating goals (from both courses and projects) and earned badges.
- Let a manager convert approved badges into a real bonus payment via Stripe Checkout.
- Notify the relevant user in real time (Socket.IO) whenever a badge is approved, a project is assigned, a project is completed, or a course is completed.
- Optionally extend two of those four events into external automation (email, Slack, spreadsheet logging) via n8n, without making that automation a hard dependency of the core flow.

## 5. Project Overview

### 5.1 Purpose

CompanyGrow is an employee growth and performance-recognition platform. Its implementation centers on four connected capabilities: course-based training, project allocation, performance/badge tracking, and Stripe-backed bonus payout — enumerated in Section 4.

### 5.2 Target Users

Confirmed directly from the `role` enum on the `User` model (`employee | manager | admin`) and the three dashboard components in the frontend (`EmployeeDashboard`, `ManagerDashboard`, `AdminDashboard`).

| Role | Primary Activities (as implemented) |
|---|---|
| employee | Browses and enrolls in courses, completes modules, browses assigned projects, tracks personal performance/badges, edits own profile. |
| manager | Reviews employee performance and earned badges, approves badges, converts approved badges into a Stripe bonus payout, assigns employees to projects, marks projects complete. |
| admin | Creates/edits/deletes courses and projects, manages user profiles, has the same course/project CRUD access as any authenticated user (see Section 18.2 — this is not server-enforced). |

### 5.3 Core Value Proposition

As implemented: a manager can see an employee's completed courses, completed projects, and earned badges in one performance view, select which badges to reward, and pay a bonus for them through a real Stripe Checkout flow — all inside the same application, with the employee notified the instant it happens.

### 5.4 Business Model

Not applicable / not specified. CompanyGrow has no subscription tiers, pricing, or gated functionality anywhere in the codebase — it is an internal tool, not a monetized SaaS product. The only monetary transaction in the system is the manager-to-employee bonus payment itself.

## 6. Core Features

### 6.1 Course Catalog & Enrollment

Admins create courses (`name`, `description`, `category`, `difficulty`, `preRequisites`, `skillsGained`, `eta`, `content[]`, `badgeReward`) via `addCourse`. Each course's `content[]` is an array of modules (`title`, `description`, `videoUrl[]`, `resourceLink[]`), each with its own Mongoose-generated `_id`. Employees enroll via `enrollCourse`, which both adds them to the course's `enrolledUsers[]` array and creates a corresponding `Training`-mode goal in their `performanceMetrics` for the current bi-monthly period. Completing a module (`completeModule`) marks it in `completedModules[]` and recalculates `progress` as a percentage of total modules; reaching 100% marks the associated goal `completed`, awards the course's `badgeReward` (if any) into `badgesEarned`, merges the course's `skillsGained` into the user's `skills` (case-insensitive de-duplication), and emits a `course:completed` Socket.IO event.

### 6.2 Project Allocation & Completion

Admins/managers create projects (`name`, `description`, `status`, `priority`, `assignedUsers[]`, `deadline`, `budget`, `skillsRequired`, `skillsGained`, `badgeReward`, `managedBy`) via `addProject`. Assigning a user (directly on creation, or later via `modifyProject`/`modifyUsers`) creates a `Project`-mode goal in that user's current-period `performanceMetrics` and emits a `project:assigned` Socket.IO event — and, if `N8N_PROJECT_ASSIGNED_WEBHOOK_URL` is set, a fire-and-forget webhook POST. Marking a project complete (`completeProject`) mirrors the course-completion logic almost exactly: marks the goal completed, awards the project's `badgeReward` to every assigned user, merges `skillsGained` into each user's skills, and emits a `project:completed` event per user. **This is the one endpoint in the entire API with no authentication requirement at all** (see Section 18.2).

### 6.3 Performance Tracking

Each `User` document carries a `performanceMetrics[]` array, one entry per bi-monthly period (e.g. `"Jan-Feb 2026"`, computed from the current date, not user-selectable). Each period entry holds a `rating` (1–5), a `goals[]` array (populated automatically by course enrollment and project assignment, each with a `mode` of `Training` or `Project`, a `status` of `pending`/`in-progress`/`completed`, and a `refId` pointing at the source `Course` or `Project` document — without a Mongoose `ref`, since it can point at either collection), a `feedback` string and `reviewedBy`/`reviewDate`, and a `badgesEarned[]` array. The employee's own **Performance** tab and the manager's **Review** tab both read this same embedded structure; the manager's view additionally computes and renders Chart.js visualizations and supports PDF export (jsPDF + html2canvas).

### 6.4 Badge System

A badge is an embedded subdocument on a `performanceMetrics` period entry: `{ title, type, description, dateEarned, approved }`. `title` is constrained to a fixed enum (`Green | Cyan | Blue | Purple | Red`) shared identically by both the `Course.badgeReward` and `Project.badgeReward` fields — badges are not tiered by difficulty or point value beyond this five-color scheme. `approved` defaults to `false` and is flipped to `true` only via `POST /api/payment/approve-badges`, matched by a synthesized composite key (`period-type-title-dateEarned.toISOString()`) rather than a stored badge-level `_id`.

### 6.5 Stripe-Backed Bonus Payouts

A manager selects one or more approved-eligible badges on the Review tab and triggers `POST /api/payment/create-bonus-session`, which creates a Stripe Checkout Session (test mode) with the total bonus amount, redirects the browser to Stripe's hosted Checkout page, and — on success — redirects back to `/manager/bonus-success?session_id=...`. That page retrieves the session (`GET /api/payment/session/:sessionId`) and **only then** calls `approve-badges` with the badge IDs stored in the session's Stripe metadata. **Badge approval is therefore architecturally a side effect of successful payment, not an independently triggerable manager action** — there is no UI path to approve a badge without also completing a Stripe Checkout flow for it.

### 6.6 Real-Time Notifications

A JWT-authenticated Socket.IO connection (established on dashboard mount, using the same token as the REST API) delivers four event types — `badge:approved`, `project:assigned`, `project:completed`, `course:completed` — to a bell-icon dropdown (`NotificationBell.js`) mounted in all three dashboards. Notifications are held only in the connected client's React state (capped at the 20 most recent) — there is no `Notification` collection in MongoDB, so a page refresh clears the list and there is no way to view notification history from a previous session.

### 6.7 n8n Workflow Automation

Two of the four Socket.IO events above additionally POST a JSON payload to an n8n webhook URL, read from an environment variable, as a fire-and-forget side effect that never blocks or fails the underlying request:

- **Badge approved** → `{ message, employeeName, employeeEmail, badgeName, approvedAt }`
- **Project assigned** → `{ employeeName, employeeEmail, projectName, managerName, assignedAt }`

The n8n workflow itself (built and verified during development, running in a local Docker container) fans the badge-approval event out to an email notification, and the project-assignment event out to email, a Slack message, and a Google Sheets append-row — all configured inside n8n, not in application code, which is what makes the specific downstream actions swappable without touching the backend.

### 6.8 Analytics & PDF Export

The manager's Review tab renders Chart.js visualizations of badge/performance data and supports exporting the current view as a PDF via `jsPDF` + `html2canvas`; the employee's Performance tab has the equivalent export capability for a single employee's own data.

## 7. Functional Modules

The backend is organized into five controllers, each scoped to a single resource:

| Controller | Resource | Notable Logic |
|---|---|---|
| `auth.controller.js` | Login / signup / logout | Issues a 24h JWT; `signupUser` hardcodes `role: 'employee'` regardless of any role field submitted — there is no self-service manager/admin signup path. |
| `user.controller.js` | User CRUD, profile, performance lookups | `modifyProfile` explicitly rejects any request body containing `performanceMetrics`, preventing self-editing of performance data through the profile endpoint. |
| `course.controller.js` | Course CRUD, enrollment, module completion | Computes the current bi-monthly period label inline; awards badges/skills on 100% module completion; emits `course:completed`. |
| `project.controller.js` | Project CRUD, assignment, completion | Contains two internal (non-route) helper functions, `assignProjectToUser`/`deassignProjectFromUser`, reused by three different route handlers (`addProject`, `modifyProject`, `modifyUsers`); emits `project:assigned`/`project:completed` and calls the n8n webhook. |
| `payment.controller.js` | Badge approval, Stripe Checkout | Matches badges to approve via a synthesized composite key, not a stored ID; creates/retrieves Stripe Checkout sessions; emits `badge:approved` and calls the n8n webhook. |

Two supporting, non-route modules exist alongside the controllers:

| Module | Purpose |
|---|---|
| `socket.js` | Initializes the JWT-authenticated Socket.IO server on the shared HTTP server; exports `notifyUser(userId, event, payload)`. |
| `middleware/auth.js` | The single authentication middleware, applied per-route. |

## 8. User Workflow

The codebase does not present workflows as formal diagrams; the following are reconstructed from controller and route behavior.

### 8.1 Course Completion Workflow

- An employee browses the course catalog and enrolls (`POST /api/course/enrollCourse/:userId/:courseId`), creating a `Training` goal.
- The employee completes modules one at a time (`POST /api/course/completeModule/...`); progress recalculates after each.
- On reaching 100%, the goal is marked completed, the course's badge (if any) is awarded, new skills are merged in, and a `course:completed` Socket.IO event is emitted to that employee only.

### 8.2 Project Assignment & Completion Workflow

- A manager or admin assigns an employee to a project (at creation, or via `modifyProject`/`modifyUsers`), creating a `Project` goal and emitting `project:assigned` (plus an n8n webhook call, if configured).
- On project completion (`POST /api/project/completeProject/:id` — the one unauthenticated route in the API), every assigned employee's corresponding goal is marked completed, the project's badge is awarded to each of them, skills are merged, and `project:completed` is emitted per user.

### 8.3 Badge Approval & Bonus Payout Workflow

- A manager reviews an employee's earned badges on the Review tab and selects some for a bonus.
- `POST /api/payment/create-bonus-session` creates a Stripe Checkout session; the browser redirects to Stripe's hosted Checkout page.
- On successful payment, Stripe redirects to `/manager/bonus-success?session_id=...`; that page fetches the session and calls `POST /api/payment/approve-badges`, which flips `approved: true` on the matched badges, emits `badge:approved`, and (if configured) calls the n8n badge-approved webhook.
- On a cancelled/failed payment, Stripe redirects to `/manager/payment-failed` instead — this page attempts to fetch session details from a route that does not exist in the backend (`/api/bonus/session/:id` instead of `/api/payment/session/:id`), so it always falls back to a generic error state (see Section 20).

### 8.4 Real-Time Notification Workflow

- On dashboard mount, the frontend connects to Socket.IO using the JWT already stored in `localStorage`.
- The backend's handshake middleware verifies the token and joins the socket to a room named after the token's `id` claim — never a client-supplied value.
- Any of the four events described in Section 6.6 emits directly to that user's room; `NotificationBell.js` renders it immediately if the relevant dashboard is open, with no polling involved.

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Chart.js / react-chartjs-2, jsPDF, html2canvas, Socket.IO client, lucide-react (icons) |
| Backend | Node.js, Express 5, Socket.IO server, JWT (jsonwebtoken), bcryptjs |
| Database | MongoDB (accessed via Mongoose 8) |
| Payments | Stripe (Checkout Sessions, test mode) |
| Automation | n8n (self-hosted via Docker) |
| Testing | Jest, Supertest, mongodb-memory-server |
| CI/CD | GitHub Actions |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

## 10. System Architecture

A full architectural treatment — component topology, request/data flow, authentication and CORS posture, and a candid strengths/limitations assessment — is provided in the companion document, [`docs/SOFTWARE_ARCHITECTURE.md`](SOFTWARE_ARCHITECTURE.md). In summary: CompanyGrow runs as a single Express API process (hosting both REST routes and a JWT-authenticated Socket.IO server on one HTTP server) and a React SPA, with no API gateway, no microservice split, and no separate worker process. n8n is an independent, optional third process that the backend calls out to but does not depend on.

## 11. Project Structure

### 11.1 Directory Layout

```
CompanyGrow/
├── backend/
│   ├── app.js                    # Express app: middleware + route mounting only
│   ├── server.js                  # Entry point: dotenv, Mongo connect, HTTP server, Socket.io init
│   ├── socket.js                   # JWT-authenticated Socket.io server + notifyUser()
│   ├── controllers/                 # auth, user, course, project, payment
│   ├── models/                       # User, Course, Project (Mongoose schemas)
│   ├── routes/                        # One Express router per resource
│   ├── middleware/auth.js              # JWT verification middleware
│   ├── seeds/                           # user.seed.js, course.seed.js, project.seed.js
│   └── tests/                            # Jest + Supertest suite (5 files, 17 tests)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── admin/ manager/ employee/  # Role-scoped dashboard tab content
│       │   ├── dashboard/dashboardRouter.js # Reads role from localStorage, renders dashboard
│       │   └── login.js                     # Combined login/signup page
│       ├── components/NotificationBell.js   # Socket-driven notification dropdown
│       ├── services/                         # socket.js (used), api.js (dead code)
│       └── utils/api.js                       # The actively-used fetch wrapper
├── docs/                                        # This document + SOFTWARE_ARCHITECTURE.md
└── .github/workflows/ci.yml                      # GitHub Actions CI
```

### 11.2 Directory Purpose Summary

| Directory | Purpose |
|---|---|
| `backend/models` | Three Mongoose schemas: `User` (accounts + embedded performance/badge data), `Course` (content modules + enrollment state), `Project` (allocation + lead/assignment state). |
| `backend/controllers` | Five controllers, one per resource; all business logic (badge matching, bi-month period calculation, Socket.io emission, n8n webhook calls) lives here, not in a separate service layer. |
| `backend/routes` | Thin Express routers mapping HTTP verbs/paths to controller functions; `auth` middleware applied per-route, with one documented exception (Section 18.2). |
| `frontend/src/pages` | The entire application UI, organized by role folder; each role has its own dashboard shell with internally-managed tab state (not distinct URLs). |
| `frontend/src/components` | Currently one shared component — the notification bell — mounted independently in each of the three dashboards. |

## 12. Installation & Setup

### 12.1 Prerequisites

- Node.js 22.x
- A MongoDB connection string (local `mongod` or MongoDB Atlas)
- A Stripe account (test mode)
- Docker, if you want to run n8n locally (optional)

### 12.2 Documented Run Commands

| Component | Command | Purpose |
|---|---|---|
| Backend (production) | `node server.js` | Runs the API + Socket.io server directly. |
| Backend (development) | `npm run dev` (nodemon) | Runs the API with automatic restarts on file changes. |
| Frontend (development) | `npm start` (react-scripts) | Starts the React dev server on port 3000. |
| Frontend (build) | `npm run build` (react-scripts) | Produces a static production bundle. |

### 12.3 Setup Sequence

```bash
git clone https://github.com/Ashmit-A-Rawat/CompanyGrow.git
cd CompanyGrow
cd backend && npm install
cd ../frontend && npm install

cp backend/.env.example backend/.env      # then fill in real values
cp frontend/.env.example frontend/.env

cd backend
node seeds/user.seed.js                    # destructive: wipes users collection first
node seeds/course.seed.js                  # destructive: wipes courses collection first
node seeds/project.seed.js                 # additive: appends, does not wipe

npm run dev                                 # terminal 1, backend on :4000
cd ../frontend && npm start                 # terminal 2, frontend on :3000
```

## 13. Configuration

No `.env` file is committed to the repository (excluded via `.gitignore`); `.env.example` files document every variable at both `backend/` and `frontend/`.

### 13.1 Backend Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Port the Express server listens on. |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Signs/verifies JWTs (hardcoded fallback exists if unset — see Section 18). |
| `STRIPE_SECRET_KEY` | Server-side Stripe API key. |
| `CLIENT_URL` | Frontend origin — used for Stripe redirect URLs **and** Socket.io CORS. |
| `N8N_BADGE_APPROVED_WEBHOOK_URL` | Optional; if unset, the badge-approval automation call is skipped entirely. |
| `N8N_PROJECT_ASSIGNED_WEBHOOK_URL` | Optional; if unset, the project-assignment automation call is skipped entirely. |

### 13.2 Frontend Environment Variables

| Variable | Purpose |
|---|---|
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe key (has a hardcoded fallback test key in `review.js`). |
| `REACT_APP_API_URL` | Base URL of the backend API + Socket.io server, used by `utils/api.js`, `login.js`, and `services/socket.js`. |

## 14. Usage Guide

Reconstructed from the documented pages, roles, and workflows.

### 14.1 For Employees

- Register (always created with role `employee` — see Section 18.1) and browse the course catalog.
- Enroll in courses and complete modules to earn badges and grow the recorded skill list.
- View assigned projects and personal performance history, including badges earned.
- Export a personal performance report as PDF.

### 14.2 For Managers

- Assign employees to projects and mark projects complete.
- Review an employee's performance and earned badges (Chart.js visualizations, PDF export).
- Select approved-eligible badges and trigger a Stripe bonus payout for them.

### 14.3 For Admins

- Create, edit, and delete courses and projects.
- Manage user profiles.
- (Note: nothing server-side actually restricts these actions to the `admin` role — see Section 18.2.)

## 15. API Overview

All paths are mounted under the base path shown. "Auth" indicates whether the `auth` (JWT-required) middleware is applied at the route level.

### 15.1 Auth (`/api/auth`) — no routes require auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/login` | Verifies credentials, issues a 24h JWT. |
| POST | `/signup` | Creates a user (always `role: 'employee'`), issues a JWT. |
| POST | `/logout` | No server-side session to invalidate; effectively a no-op acknowledging the client will clear its own token. |

### 15.2 Users (`/api/user`) — all routes require auth

| Method | Path | Purpose |
|---|---|---|
| GET | `/getAllUsers` | Lists all users (password excluded). |
| GET | `/getProfile/:id` | Single user profile (password excluded). |
| PUT | `/modifyProfile/:id` | Updates profile fields; rejects `performanceMetrics` in the body. |
| GET | `/getUserPerf/:id` | Returns just the `performanceMetrics` array. |
| POST | `/addUser` | Admin-style direct user creation (any role can be set here, unlike signup). |
| DELETE | `/deleteUser/:id` | Deletes a user. |
| GET | `/getUserCourses/:id` | Filters the user's goals to `mode === 'Training'`. |
| GET | `/getCourseStatus/:userId/:courseId` | Returns course content + this user's completed modules/progress. |
| GET | `/getUserProjects/:id` | Filters the user's goals to `mode === 'Project'`, resolves to full `Project` documents. |

### 15.3 Courses (`/api/course`) — all routes require auth

| Method | Path | Purpose |
|---|---|---|
| GET | `/getAllCourses` | Lists all courses. |
| POST | `/addCourse` | Creates a course. |
| PUT | `/modifyCourse/:id` | Updates a course. |
| DELETE | `/deleteCourse/:id` | Deletes a course. |
| POST | `/enrollCourse/:userId/:courseId` | Enrolls a user; creates a `Training` goal. |
| POST | `/completeModule/:userId/:courseId/:contentId` | Marks a module complete; awards badge/skills at 100%; emits `course:completed`. |

### 15.4 Projects (`/api/project`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/getAllProjects` | ✅ | Lists all projects, populated with assigned users and manager. |
| POST | `/addProject` | ✅ | Creates a project; assigns listed users. |
| PUT | `/modifyProject/:id` | ✅ | Updates a project; reconciles assigned-user changes. |
| PUT | `/modifyUsers/:id` | ✅ | Updates only the assigned-user list. |
| DELETE | `/deleteProject/:id` | ✅ | Deletes a project; deassigns all users first. |
| POST | `/completeProject/:id` | ❌ **No auth middleware** | Marks complete; awards badges/skills to all assigned users; emits `project:completed` per user. |

### 15.5 Payments (`/api/payment`) — all routes require auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/approve-badges` | Flips `approved: true` on matched badges; emits `badge:approved`; calls the n8n badge-approved webhook. |
| POST | `/create-bonus-session` | Creates a Stripe Checkout session for a bonus payment. |
| GET | `/session/:sessionId` | Retrieves a Stripe Checkout session's details. |

## 16. Database Overview

CompanyGrow uses MongoDB via Mongoose. There are **three** collections, none using MongoDB transactions — related multi-document writes are sequential, independent operations.

### 16.1 Collections Overview

| Model | Purpose | Key References |
|---|---|---|
| `User` | Core account record for all three roles; embeds the entire performance/badge history. | Referenced by `Project.assignedUsers`, `Project.managedBy`, `Course.enrolledUsers`. |
| `Course` | Course definition, module content, and per-user enrollment/progress state. | `enrolledUsers[].userId → User`. |
| `Project` | Project definition, assignment, and lead/manager state. | `assignedUsers[] → User`, `managedBy → User`. |

### 16.2 Schema Detail

#### 16.2.1 User

| Field | Type | Constraints |
|---|---|---|
| `name`, `email` | String | Required; `email` unique, lowercase. |
| `password` | String | Required, min length 6, bcrypt-hashed in the controller (not a schema hook). |
| `role` | String | Enum: `employee \| manager \| admin`, default `employee`. |
| `department`, `position`, `phone`, `profileImage` | String | Optional; `profileImage` is a plain string, no upload mechanism exists. |
| `experience` | Number | Min 0, default 0. |
| `skills` | [String] | Grown automatically on course/project completion. |
| `address`, `emergencyContact` | Subdocument | Optional structured fields. |
| `performanceMetrics[]` | [Subdocument] | Embedded array, one entry per bi-monthly `period` string; each holds `rating`, `goals[]`, `feedback`, `reviewedBy`/`reviewDate`, `badgesEarned[]`. |
| `performanceMetrics[].goals[]` | [Subdocument] | `title`, `mode` (`Training \| Project`), `description`, `refId` (ObjectId, **no `ref` declaration** — can point at `Course` or `Project`), `status`, `completedAt`. |
| `performanceMetrics[].badgesEarned[]` | [Subdocument] | `title` (enum `Green\|Cyan\|Blue\|Purple\|Red`), `type` (`course\|project`), `description`, `dateEarned`, `approved` (default `false`). |
| `isActive`, `lastLogin`, `joinDate` | Boolean / Date | System fields. |

Indexes: `{department}`, `{role}`, `{skills}`, `{isActive}`.

#### 16.2.2 Course

| Field | Type | Constraints |
|---|---|---|
| `name` | String | Required. |
| `description`, `category`, `eta` | String | Optional. |
| `difficulty` | String | Enum: `Beginner \| Intermediate \| Advanced`. |
| `preRequisites[]`, `skillsGained[]` | [String] | Optional. |
| `content[]` | [Subdocument] | `title`, `description`, `videoUrl[]`, `resourceLink[]`; each auto-gets an `_id` used as the module identifier for `completeModule`. |
| `enrolledUsers[]` | [Subdocument] | `userId → User`, `progress` (%), `completedModules[]` (ObjectIds referencing `content[]._id`), `enrolledAt`, `completedAt`. |
| `badgeReward` | String | Enum: `Green\|Cyan\|Blue\|Purple\|Red`. |

Indexes: `{category}`, `{skillsGained}`.

#### 16.2.3 Project

| Field | Type | Constraints |
|---|---|---|
| `name`, `description` | String | Required, length-capped. |
| `skillsRequired[]`, `skillsGained[]` | [String] | Optional. |
| `status` | String | Enum: `planning\|in-progress\|on-hold\|completed`, default `planning`. |
| `priority` | String | Enum: `low\|medium\|high`, default `medium`. |
| `assignedUsers[]` | [ObjectId → User] | The employees allocated to the project. |
| `managedBy` | ObjectId → User | The project's manager/lead. |
| `deadline`, `budget` | Date / Number | Optional. |
| `badgeReward` | String | Enum: `Green\|Cyan\|Blue\|Purple\|Red`. |

Indexes: `{status, priority}`, `{createdAt: -1}`.

### 16.3 Backend Request Lifecycle

A typical authenticated request flows: `server.js` (HTTP server, Socket.io attached) → `app.js` (Express app, route mounting) → route file (path match, `auth` middleware if applied) → controller function → Mongoose model → MongoDB → JSON response. There is no shared response-formatting utility; error shape varies by controller (Section 18.3).

## 17. External Integrations

| Integration | Purpose | Interaction | Notes |
|---|---|---|---|
| Stripe | Bonus payment | Server creates/retrieves Checkout Sessions; browser redirects to Stripe's hosted page | Test mode; no webhook signature verification (payment confirmation is read back via client-initiated `GET`, not pushed) |
| n8n | Workflow automation | Two controllers POST JSON to a configured webhook URL on badge approval and project assignment | Self-hosted via Docker; not publicly reachable, so silent no-op in the production deployment |
| Socket.IO | Real-time notifications | JWT-authenticated; backend emits to per-user private rooms | See Section 18.4 |
| MongoDB Atlas | Database hosting | `MONGO_URI` connection string | Outside application code |
| Vercel | Frontend hosting | Static build deployment from `frontend/` | Live at [company-grow-rho.vercel.app](https://company-grow-rho.vercel.app) |
| Render | Backend hosting | `node server.js` process deployment from `backend/` | Live at [companygrow-backend-meud.onrender.com](https://companygrow-backend-meud.onrender.com) (free tier — sleeps after inactivity) |
| GitHub Actions | CI | Runs backend tests + frontend build on push/PR to `main` | `.github/workflows/ci.yml` |

## 18. Security Features

### 18.1 Authentication Mechanism

Stateless JWT authentication: `auth.controller.js` issues a token via `jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '24h' })`. The frontend stores it in `localStorage` and manually attaches it as an `Authorization: Bearer` header via `utils/api.js`. Passwords are hashed with `bcryptjs` (`bcrypt.hash(password, 10)`) directly in the controller — there is no Mongoose pre-save hook doing this automatically, so any future code path that saves a `User` document without going through `auth.controller.js` or `user.controller.js`'s `addUser` would persist a plaintext password.

### 18.2 Authorization Model

There is **no role-based authorization middleware** anywhere in the codebase — only the single `auth` middleware, which confirms a request carries a valid JWT and nothing more. `req.user.role` is available on every authenticated request but is never checked against a route-specific allow-list. Concretely: an authenticated `employee`'s token can successfully call `POST /api/course/addCourse` or `POST /api/project/addProject` — role separation exists only in which UI the frontend renders for that role, not in what the backend will accept.

The one route with **no authentication requirement of any kind** is `POST /api/project/completeProject/:id` — any caller can mark any project complete and trigger badge/skill awards to every assigned user.

### 18.3 Error Response Consistency

Error response shape is not uniform: `auth.controller.js` and `user.controller.js` return `{ message }`; `course.controller.js`, `project.controller.js`, and `payment.controller.js` return `{ error }`. There is no shared error-handling middleware to standardize this.

### 18.4 Real-Time Channel Security

The Socket.IO server authenticates every connection: `socket.js` runs an `io.use()` handshake middleware requiring a valid JWT (verified with the same `JWT_SECRET` as the REST API), and joins the socket to a room named after the token's decoded `id` — never a value the client can directly control. `notifyUser()` only ever emits to `io.to(userId)`, so a connected client can only ever receive events addressed to its own authenticated identity.

### 18.5 Input Validation

Ad hoc and controller-specific; no shared validation library (no Joi, Zod, express-validator) is a dependency. Most controllers check only for the presence of required fields, relying on Mongoose schema constraints (`required`, `enum`, `min`) as the last line of defense.

### 18.6 CORS Configuration

`app.use(cors())` in `app.js` is called with no options — the REST API accepts requests from **any** origin. The Socket.IO server, configured separately in `socket.js`, restricts `cors.origin` to exactly `process.env.CLIENT_URL`. The more mutation-capable surface (REST) is therefore the less restricted one.

### 18.7 Payment Security

Relies on Stripe's server-side SDK using the secret key for session creation/retrieval. There is no Stripe webhook endpoint and no signature verification anywhere in the codebase — payment confirmation is established by the frontend making an authenticated `GET` request to retrieve the session after Stripe's redirect, not by Stripe pushing a signed event to the backend.

### 18.8 Secrets & Environment Configuration

`.env` is excluded from git at the repository root; `.env.example` files document every variable (Section 13). `JWT_SECRET` has a hardcoded fallback string (`'companygrow_secret_key'`) used identically in all three places that touch it — `auth.controller.js` (token issuance), `middleware/auth.js` (REST request verification), and `socket.js` (Socket.io handshake verification) — meaning if the environment variable were ever unset in a real deployment, the system would still function (all three call sites use the same fallback), but with a publicly-known secret, which is a materially worse failure mode than the system simply refusing to start.

## 19. Performance Considerations

- No caching layer (Redis or otherwise) exists anywhere in the stack; every read hits MongoDB directly.
- `performanceMetrics` is unboundedly embedded on the `User` document — nothing in the schema archives or caps old periods, so a long-tenured employee's document grows indefinitely.
- Socket.io state (which room a socket belongs to) is held in Socket.io's own in-process room registry with no external adapter (e.g. Redis) — this would not behave correctly if the backend were ever scaled to multiple instances/replicas, since each instance would only know about its own connected sockets.
- The backend runs as a single Node.js process with no clustering or load-balancing configuration.
- The Render free-tier hosting used in the current deployment sleeps after a period of inactivity, adding a 30–60 second cold-start delay to the first request.

## 20. Known Limitations

The following are confirmed, code-verified characteristics — not speculation — so a maintainer can prioritize fixes without rediscovering them.

- **No role-based authorization anywhere in the backend.** Only "authenticated or not" is enforced; any authenticated user's token can call any authenticated endpoint regardless of role.
- **`POST /api/project/completeProject/:id` has no authentication requirement at all** — the single unauthenticated mutating route in the API.
- **`manager/payment-failed.js` calls a route that does not exist**: `GET /api/bonus/session/:sessionId` — the real, mounted path is `/api/payment/session/:sessionId`. Every failed-payment page load therefore fails its own detail fetch and shows a generic fallback instead of the real cancellation reason/amount.
- **n8n automation does not work in the live deployment.** Both webhook URLs point at `localhost:5678`; Render's servers cannot reach a container on a developer's laptop, so both webhook calls fail silently (by design, non-blocking) in production.
- **Inconsistent error response shape** across controllers (`{ message }` vs `{ error }}` — see Section 18.3).
- **CORS asymmetry**: the REST API accepts any origin; Socket.io accepts only one configured origin.
- **No Stripe webhook signature verification** — payment confirmation is read back client-side rather than pushed server-to-server.
- **Dead code**: `frontend/src/services/api.js` (an axios-based API wrapper duplicating what `utils/api.js` does) is never imported anywhere in the frontend.
- **Unused dependencies**: `backend/package.json` lists `bcrypt` (never imported — only `bcryptjs` is used) and `react-scripts` (a frontend build tool with no purpose in a Node API). `frontend/package.json` lists three `@tailwindcss/*` packages and `bcryptjs`, none of which are used anywhere in frontend source — all styling is inline `style={}` objects, and there is no legitimate client-side use for a password-hashing library.
- **Duplicated badge/skill-award logic** between `course.controller.js`'s `completeModule` and `project.controller.js`'s `completeProject` — independently implemented rather than shared, and could silently drift out of sync.
- **No persisted notification history** — Socket.io-delivered notifications live only in client-side React state and are lost on refresh.
- **No MongoDB transactions** — multi-user updates (e.g. badge-awarding on project completion) are sequential and non-atomic; a mid-loop failure leaves a partially-updated state with no rollback.
- **The stock Create React App test file (`App.test.js`) is stale** — it asserts on a "learn react" link that no longer exists in the customized `App.js`, and would fail if run. It is not currently executed by CI (the frontend CI job only runs `npm run build`), so this never surfaces.

## 21. Future Enhancements

Not a stated product roadmap — these are reasonable remediation directions inferred directly from Section 20, not confirmed plans:

- Introduce a role-based `authorize(...roles)` middleware and apply it to admin/manager-only routes, closing the gap described in Section 18.2.
- Add authentication to the one unprotected route, `completeProject`.
- Fix `manager/payment-failed.js`'s incorrect API path.
- Standardize the error-response envelope across all five controllers.
- Deploy n8n publicly (or migrate to n8n Cloud) so the built automation workflows actually fire against the production deployment.
- Add a Stripe webhook endpoint with signature verification as the source of truth for payment completion, rather than relying solely on the client-initiated session-retrieval call.
- Persist notifications to a `Notification` collection so history survives a page refresh and is available across sessions/devices.
- Remove the confirmed-dead `services/api.js` file and the unused `bcrypt`, `react-scripts` (backend), and `@tailwindcss/*`, `bcryptjs` (frontend) dependencies.
- Extract the duplicated badge/skill-award logic in `course.controller.js` and `project.controller.js` into a single shared function.
- Cap or archive old `performanceMetrics` periods to bound `User` document growth over long employee tenures.

## 22. Conclusion

CompanyGrow, as implemented, is a functioning MERN-stack platform that genuinely integrates course-based training, project allocation, performance/badge tracking, real Stripe bonus payments, JWT-authenticated real-time notifications, and optional n8n workflow automation — and, unlike many portfolio-stage projects, is actually deployed and reachable, with a real CI pipeline exercising a real (if backend-only) automated test suite on every push.

The same direct inspection that surfaces those strengths also surfaces a specific, concrete set of gaps: no server-side role authorization, one fully unauthenticated mutating route, a broken frontend API path, dead code and unused dependencies, and an n8n integration that is built and verified but not reachable from the live deployment. These are presented in Sections 18 and 20 without embellishment, alongside the platform's documented capabilities, so this document can serve equally as a technical reference, an onboarding aid, and a prioritized list of remediation work.

All content in this document is drawn directly from the CompanyGrow codebase as it exists at the time of writing. Where information was not available — a formal business model, a named architectural pattern, a product roadmap — this has been stated explicitly rather than inferred or fabricated.
