# NMMS — Development & Execution Plan

**Project:** NGO Membership Management System for **Vedvriksha (वेदवृक्ष)** — confirmed final org name/logo/brand (previously "Seva Bharat" placeholder); branding stays configurable in code per §2A so a future re-brand needs no rework
**Stack:** React 19 + TypeScript · NestJS (Fastify) · PostgreSQL · Prisma · Docker · Nginx
**Timeline:** 10–12 weeks (MVP) · On-premises deployment
**Client scope:** Responsive web app only — no native mobile app. Mobile mockup screens are delivered as mobile-responsive views of the same web app (mobile-first layouts for Field Executive screens).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy, TLS)       │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
     ┌─────────▼───────── ┐  ┌────────▼────────┐
     │  React 19 SPA      │  │  NestJS API     │
     │  (static, Vite)    │  │  (Fastify)      │
     └────────────────────┘  └───┬──────────┬──┘
                                 │          │
                          ┌──────▼───┐  ┌───▼────────────┐
                          │ PostgreSQ│  │ Local FS / NAS │
                          │ (Prisma) │  │ (uploads)      │
                          └──────────┘  └────────────────┘
```

**Monorepo layout (recommended — pnpm workspaces or Turborepo):**

```
nmms/
├── apps/
│   ├── api/          # NestJS + Fastify
│   └── web/          # React 19 + Vite + TS
├── packages/
│   ├── shared/       # Zod schemas, DTO types, enums, constants
│   └── config/       # ESLint, TS config, Prettier
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
└── prisma/           # schema, migrations, seed
```

**Key architectural decisions:**

| Decision | Choice | Rationale |
|---|---|---|
| API style | REST + OpenAPI (Nest Swagger module) | Per proposal; auto-generated client types for the frontend via openapi-typescript |
| Auth | JWT access (15 min) + refresh token (httpOnly cookie), Argon2 password hashing | Standard, on-prem friendly |
| Authorization | RBAC via Nest guards + CASL (or custom `@Roles()` + jurisdiction scoping) | 5 roles with **geographic scoping** (District Admin sees only their district) |
| File storage | Local disk behind an abstraction (`StorageService`) | Swap to S3/MinIO later without refactor |
| PDF generation | `@react-pdf/renderer` or Puppeteer (server-side) for cards/receipts | QR + branding on membership cards |
| Excel export | `exceljs` | Streaming export for large member registers |
| State (frontend) | TanStack Query + Zustand (minimal client state) | Server-state heavy app |
| Forms | React Hook Form + Zod (shared schemas from `packages/shared`) | The 5-step wizard needs per-step validation + draft persistence |
| UI kit | Tailwind + shadcn/ui, theme driven by CSS design tokens (colors/logo/name from Org Settings) | Matches mockups; org name & branding stay configurable since client name is TBD |

---

## 2. Data Model (Core Entities)

```
Organization ──< OrgSettings
 ├── identity: name, logo, address, contact, bank details (drives all headers, cards, receipts, PDFs)
 ├── formats: membership number pattern, receipt series
 └──< FeatureFlag (key, enabled, configJSON)
      keys: PAYMENT_GATEWAY | WHATSAPP_NOTIFY | AI_DEDUPE | AI_OCR | SMS | EMAIL ...
      (Integration credentials stored encrypted in configJSON; MVP ships all flags OFF
       with no-op providers behind interfaces — flipping a flag requires zero refactor)

User ──── Role (SUPER_ADMIN | ADMIN | DISTRICT_ADMIN | BLOCK_ADMIN | FIELD_EXECUTIVE)
   └── jurisdiction: stateId? districtId? blockId?   ← scoping for RBAC

Geo hierarchy:  State ──< District ──< Block ──< Panchayat ──< Village

MembershipPlan (name, fee, validityMonths|LIFETIME, status)

Member
 ├── membershipNumber (auto, per org-configured format e.g. {PREFIX}-{YYYY}-{SEQ})
 ├── personal: name, relations, dob, gender, maritalStatus, bloodGroup
 ├── contact: mobile, whatsapp, email, emergencyContact
 ├── address: FK chain state→village + pincode
 ├── identity: aadhaarLast4 + aadhaarHash (never store raw), pan?, voterId?
 ├── education/occupation/skills
 ├── planId, joiningDate, validUntil, status
 ├── status: DRAFT → SUBMITTED → VERIFIED → APPROVED → ACTIVE
 │           (+ REJECTED, EXPIRED, RENEWED via renewal record)
 ├── createdBy (Field Executive)  ← powers "My Members" + performance report
 └──< MemberDocument (type, filePath, mime, size)
 └──< Payment (amount, mode: CASH|UPI|BANK|CHEQUE, receiptNo, receivedBy, date)
 └──< MembershipCard (qrToken, issuedAt, expiresAt, pdfPath)
 └──< StatusHistory (from, to, actorId, remarks, timestamp)

AuditLog (actorId, action, entity, entityId, before/after JSONB, ip, timestamp)
Notice (title, body, audienceRole?, districtId?, publishedAt)
```

**Notes:**
- **Aadhaar handling:** store only a salted hash for dedupe + last 4 digits for display. Raw Aadhaar images go to encrypted document storage. This is a DPDP Act consideration — flag to the client.
- **Membership number** generated transactionally at APPROVED (not at draft) to avoid gaps/collisions.
- **QR code** on cards encodes a signed token → public verify endpoint `/verify/:token` (no auth) showing name, photo, validity, status.

---

## 2A. Configurability Matrix (nothing hard-coded)

Everything below is admin-editable from **Settings → Organization / Integrations**, stored in `OrgSettings` + `FeatureFlag`, and read at runtime. The MVP codebase contains zero organization-specific values.

| Configurable Item | Where Set | How It's Consumed | MVP Behavior |
|---|---|---|---|
| Org name | Settings → Profile | Topbar, login page, cards, receipts, report headers, page `<title>` | Required at first-run setup wizard |
| Logo | Settings → Profile (upload) | Same surfaces as name; PDF templates pull from StorageService | Placeholder logo until uploaded |
| Address & contact | Settings → Profile | Receipt/card footers, report headers | Editable anytime |
| Bank details | Settings → Profile | Printed on receipts (for bank-transfer payers) | Editable anytime |
| Theme colors | Settings → Branding | CSS design tokens injected at app bootstrap | Default green palette |
| Number formats | Settings → Membership | Numbering service (`{PREFIX}-{YYYY}-{SEQ}`) | Locked after first approval |
| Payment modes | Settings → Payments | Enables/disables Cash / UPI / Bank / Cheque per org | All ON |
| **Payment gateway** | Settings → Integrations (flag + keys) | `PaymentProvider` interface; Razorpay/etc. adapter in Phase 2 | Flag OFF, no-op |
| **WhatsApp** | Settings → Integrations (flag + API creds) | `NotificationService` interface (approval, receipt, expiry alerts) | Flag OFF, no-op |
| **AI features** (dedupe, OCR verify) | Settings → Integrations (flag + provider keys) | Hooks already exist at registration (dedupe check) and document upload (OCR slot) | Flag OFF; rule-based dedupe (mobile/Aadhaar-hash) works without AI |
| SMS / Email | Settings → Integrations | Same `NotificationService` interface | Flag OFF |

**Implementation pattern:** every external capability sits behind a NestJS provider interface resolved from `FeatureFlag` at request time (strategy pattern). MVP registers no-op implementations; enabling a feature later means writing one adapter class + entering credentials in Settings — no schema changes, no redeploy of the frontend.

---

## 2B. UI Plan (Screens, Design System, Components)

### Design System (from mockups, tokenized — branding configurable per §2A)

| Token Group | Values |
|---|---|
| Colors | Vedvriksha brand palette (locked): primary green `#2E7D32` (actions/active), dark green sidebar `#1B4D1F` (admin shell), gold accent `#F9AB25` (highlights/CTAs), brown `#5D4037`, soft bg `#F2FAF1`, neutral gray `#757575`. All overridable via Settings → Branding |
| Typography | Poppins (bold, headings/logo wordmark) + Inter (regular, body), 4-step scale: page title / section / body / caption |
| Layout | Admin shell = dark sidebar + white topbar (global search, notifications, profile menu) + light-gray content with white cards, 12-col grid |
| Base kit | shadcn/ui + Tailwind · Recharts for charts · lucide-react icons |
| Density | Card-based stat tiles, rounded-xl, soft shadows (matches mockup aesthetic) |

### Screen Inventory (~35 screens, mapped to sprints)

**Auth & Shell — Sprint 0**
1. Login · 2. Forgot/Reset password · 3. App shell (sidebar + topbar + breadcrumbs) · 4. 403/404/500 states

**Setup & Admin — Sprint 1**
5. First-run setup wizard (org identity) · 6. Org settings (tabs: Profile, Branding, Membership formats, Receipt, Payments) · 7. Integrations (feature-flag toggles + credentials) · 8. Users list · 9. User create/edit (role + jurisdiction picker) · 10. Geo hierarchy tree + CRUD modals · 11. Lookup tables manager · 12. Membership plans list + form

**Members & Applications — Sprint 2**
13. Members list (server-side search/filter/pagination, status chips) · 14. Member profile (tabs: Overview, Documents, Payments, Cards, History) · 15. **5-step application wizard** — per mockup: Personal → Address → Membership → Documents → Review; progress ring, checklist sidebar, help panel, Save-as-Draft, photo upload with preview · 16. Drafts list (resume)

**Workflow & Payments — Sprint 3**
17. Applications queue (status filters, badge count) · 18. Application review (verify/approve/reject + required remarks, side-by-side document viewer) · 19. Record-payment modal · 20. Receipt PDF preview · 21. Payments list · 22. Outstanding payments view

**Cards, Dashboards, Notices — Sprint 4**
23. **Admin dashboard** — per mockup: 4 stat cards with trend %, membership growth line chart, by-type donut, revenue bar chart, recent activity feed, quick-actions panel, bottom summary strip · 24. **Field Executive dashboard** — my members, pending, today's collections; mobile-first with bottom nav · 25. Card generator + preview · 26. Public QR verify page (no auth, mobile-optimized) · 27. Notices list + composer

**Reports & Audit — Sprint 5**
28–33. Six report screens sharing one template: filter bar → data table → PDF/XLSX export · 34. Audit log viewer (login history + activity trail) · 35. Renewal flow

**Public Marketing Site — added scope, outside original "app only" client scope**
36. Public marketing home page (nav, hero, program cards) — public/unauthenticated routes inside `apps/web`, not a separate app; additional pages (About, Our Work, Gallery, News, Contact) are follow-on work, not yet built

> **Frontend design-system spike (done ahead of schedule):** design tokens, admin app shell (Sidebar/Topbar), the Admin Dashboard (#23) with mock data, a Membership Card preview component (front/back, screen-only — PDF export is still Sprint 4/backend work), and the public home page (#36) were implemented directly against the Vedvriksha brand board to validate the visual language before the rest of Sprint 0–1 backend work lands. Everything runs on mock data in `apps/web/src/lib/mock-data.ts` pending the real API.

### Shared Component Library (`apps/web/src/components`)

| Component | Used By | Notes |
|---|---|---|
| `StatCard` | Both dashboards | icon, value, trend badge (↑/↓ %) |
| `DataTable` | Members, payments, reports, audit | TanStack Table: server pagination, sort, filters, row actions, export trigger |
| `WizardShell` | Application form, setup wizard, renewal | step header, progress ring, checklist sidebar, draft autosave |
| `GeoCascade` | Registration, filters, jurisdiction picker | state→district→block→panchayat→village dependent selects |
| `FileUpload` | Photo, documents, logo | drag-drop, preview, 2 MB cap, type validation |
| `StatusBadge` | Everywhere | single source of truth for lifecycle status colors |
| `ConfirmDialog` / `RemarksDialog` | Approve/reject/delete | remarks required on reject |
| `PdfPreviewModal` | Receipts, cards, reports | iframe over server-rendered PDF |
| `EmptyState` / `ErrorState` / `TableSkeleton` | All lists | consistent loading & empty UX |
| `NotificationBell` | Topbar | pending-approvals count feed |

### Responsive Rules

- **≥ `lg`:** full sidebar layout (desktop mockup)
- **`md`–`lg`:** collapsible icon-only sidebar
- **< `md`:** bottom-nav layout (mobile mockup) — priority screens: FE dashboard, registration wizard, member search, QR verify, collect payment. Data-dense admin reports stay desktop-oriented (usable, not optimized)
- Wizard collapses to single column with sticky Save/Next footer on mobile

### UI Delivery Process

- Week 1 (UI/UX phase): lock design tokens; client signs off on the two mockups as the visual contract
- Storybook for the shared component library — doubles as visual QA and client demo surface
- Accessibility baseline: keyboard-navigable forms, labeled inputs, WCAG AA contrast on status colors

---

## 3. API Surface (Modules)

| Nest Module | Key Endpoints |
|---|---|
| `auth` | login, refresh, logout, forgot/reset password |
| `users` | CRUD, role assignment, activate/deactivate |
| `org` | profile, settings (receipt/membership formats), branding upload |
| `masters` | geo hierarchy CRUD + bulk import (CSV of districts/blocks), lookups (occupation, education, blood group) |
| `plans` | membership plan CRUD |
| `members` | CRUD, draft save, multi-step wizard save-per-step, search/filter, dedupe check (mobile/aadhaarHash) |
| `applications` | submit, verify, approve, reject (guarded transitions + StatusHistory) |
| `payments` | record payment, receipt PDF, payment history, outstanding list |
| `cards` | generate card PDF, regenerate, public QR verify |
| `dashboard` | admin stats, field-executive stats (scoped) |
| `reports` | member register, expiry, collections, executive performance, district-wise, monthly registrations — each with PDF + XLSX export |
| `notices` | CRUD + audience targeting |
| `audit` | login history, activity log (read-only, Super Admin) |

All endpoints jurisdiction-scoped by a global `ScopeGuard` reading the user's role + geo assignment.

---

## 4. Sprint Plan (12 weeks, 6 × 2-week sprints)

### Sprint 0 — Foundations (Week 1)
*Runs alongside requirement analysis + UI design sign-off*
- [ ] Monorepo scaffold, CI (lint + typecheck + test), Docker Compose (api, web, postgres, nginx)
- [ ] Prisma schema v1 + migrations + seed (roles, geo sample, lookups)
- [ ] Auth module: JWT + refresh, Argon2, RBAC guards, ScopeGuard skeleton
- [ ] Frontend shell: routing, layout (sidebar/topbar per mockup), theme tokens, auth flow, protected routes
- **Exit:** login works end-to-end in Docker; roles enforced on a sample endpoint

### Sprint 1 — Org Setup, Users, Masters (Weeks 2–3)
- [ ] Organization profile + settings (name, logo, address, bank, number formats, receipt series → StorageService)
- [ ] First-run setup wizard (org identity must be entered before anything else works)
- [ ] Integrations settings page: feature-flag toggles (payment gateway, WhatsApp, AI, SMS/email) with encrypted credential storage — all no-op in MVP
- [ ] User & role management UI (create, assign role + jurisdiction, reset password)
- [ ] Master data: geo hierarchy CRUD + CSV bulk import, lookup tables
- [ ] Membership plans CRUD
- [ ] Audit log write-path (interceptor logging mutations)
- **Exit:** an admin can fully configure a fresh NGO instance

### Sprint 2 — Member Registration Wizard (Weeks 4–5)
*This is the mockup's 5-step form: Personal → Address → Membership → Documents → Review*
- [ ] Shared Zod schemas per step; RHF wizard with per-step validation + progress ring
- [ ] Save as Draft (partial persistence, resumable), autosave on step change
- [ ] Cascading geo selects (state→district→block→panchayat→village)
- [ ] Photo + document upload (client-side compression, 2 MB cap, preview, delete)
- [ ] Dedupe warning on mobile / Aadhaar-hash match
- [ ] Member list with search/filter/pagination (server-side)
- **Exit:** Field Executive can register a member end-to-end and see it in the list

### Sprint 3 — Approval Workflow + Payments (Weeks 6–7)
- [ ] State machine: Submitted → Verified → Approved (+ Reject with remarks); role-gated transitions; StatusHistory
- [ ] Applications queue UI with badge counts (mockup: "Applications · 18")
- [ ] Membership number generation on approval
- [ ] Payments: record (cash/UPI/bank/cheque), receipt numbering, receipt PDF, payment history, outstanding view
- [ ] Validity computation from plan on payment completion → member becomes ACTIVE
- **Exit:** full lifecycle Draft → Active with receipt PDF

### Sprint 4 — Cards, Dashboards, Notices (Weeks 8–9)
- [ ] Membership card PDF (QR, photo, branding, validity) + digital view; public QR verify page
- [ ] Admin dashboard: stat cards, membership growth chart, membership-by-type donut, revenue overview, recent activity feed, quick actions (per mockup)
- [ ] Field Executive dashboard: my members, pending verification, today's registrations, collection summary
- [ ] Mobile-responsive pass: Field Executive dashboard + registration wizard optimized for phone screens (the "mobile app" mockup is implemented as these responsive views; bottom-nav layout under `md` breakpoint)
- [ ] Notices module
- **Exit:** dashboards match mockup with live data; card scans verify correctly

### Sprint 5 — Reports, Audit, Hardening (Weeks 10–11)
- [ ] All 6 reports with filters + PDF/XLSX export (streamed)
- [ ] Renewal flow + expiry report + "expiring this month" dashboard tile
- [ ] Audit UI: login history, activity trail
- [ ] Security pass: rate limiting, helmet, file-type validation, OWASP checklist, backup scripts (pg_dump cron + uploads rsync)
- [ ] Performance: indexes for search/report queries, load test member list at 50k rows
- **Exit:** feature-complete; internal QA sign-off

### Sprint 6 — UAT + Deployment (Week 12)
- [ ] UAT with client data (real geo import, 2–3 pilot field executives)
- [ ] Bug triage/fix, user manual + admin guide, deployment runbook
- [ ] Production install on client server, TLS, backup verification, training session
- **Exit:** go-live

---

## 5. Definition of Done (per feature)

- API endpoint documented in Swagger with request/response examples
- Zod schema shared between API validation and frontend form
- Jurisdiction scoping tested for at least District Admin + Field Executive
- Mutation writes an AuditLog entry
- E2E happy path covered (Playwright); unit tests on services with business logic (state machine, numbering, validity calc)

---

## 6. Risks & Open Questions (resolve in Week 1)

| # | Question | Why it matters |
|---|---|---|
| 1 | Membership number & receipt number formats — client-defined? Per district series? | Affects schema + numbering service; hard to change post-launch |
| 2 | Aadhaar storage policy — will client accept hash-only + encrypted doc? | DPDP Act compliance; legal exposure otherwise |
| 3 | Can a Block Admin approve, or only verify? Exact role → transition matrix | Drives the state-machine guards |
| 4 | Offline/poor connectivity for Field Executives in rural blocks? | If yes, draft-autosave isn't enough — may need PWA with local queue (scope risk; propose Phase 2) |
| 5 | Renewal = new payment on same member, or new application cycle? | Affects Member vs. Membership-record modelling |
| 6 | On-prem server spec + who owns TLS certs, backups, OS patching? | Deployment week blockers |
| 7 | Expected member volume (10k? 100k?) | Indexing/pagination strategy; report streaming |
| 8 | Multi-language (Hindi) needed in MVP? | i18n is cheap now, expensive later |
| 9 | ~~Final organization name & logo~~ — **resolved:** Vedvriksha (वेदवृक्ष), full brand board delivered | Appears on cards, receipts, PDFs, emails; app reads it from Org Settings, never hard-coded |

**Top delivery risks:** (a) geo master data quality — get the client's district/block/village lists in Week 1; (b) approval-matrix churn — lock the transition table before Sprint 3; (c) on-prem access delays — request server credentials by Week 8.

---

## 7. Phase 2 Architectural Insurance (build MVP so these stay cheap)

- **Multi-tenant:** every table already has `organizationId`; single-tenant deploys just have one row
- **Payment gateway / WhatsApp / SMS / Email / AI:** all behind `FeatureFlag` + provider interfaces from day one (see §2A) — Phase 2 only adds adapter classes, no rework
- **Mobile app (deferred, not planned):** out of scope; the responsive web app covers mobile use. If ever revisited, the REST + OpenAPI backend needs no changes
- **AI dedupe/OCR:** documents stored with structured metadata; the dedupe hook and OCR slot already exist in the registration flow, waiting for a provider
