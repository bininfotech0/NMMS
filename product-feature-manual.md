# NMMS — Product Feature Manual (Role-Wise)

**Product:** NGO Membership Management System for **Vedvriksha (वेदवृक्ष)**
**Audience:** Everyone who touches the system — Super Admin, Admin, Field
Executive, Member, and the public visitor. Each section below is a
self-contained manual for that role: what they can see, what they can do, and
what's off-limits.

This document describes the system as implemented in [apps/api](apps/api)
and [apps/web](apps/web). For architecture/setup, see [README.md](README.md).
For the original build plan, see [nmms-development-plan.md](nmms-development-plan.md).

---

## 1. Roles at a glance

| Role | Portal | Logs in via | Scope |
| --- | --- | --- | --- |
| **Super Admin** | Admin portal (`/admin`) | Staff login | Full org access, including managing other Super Admins |
| **Admin** | Admin portal (`/admin`) | Staff login | Full org access, except managing Super Admin accounts |
| **Field Executive** | Admin portal (`/admin`), mobile-responsive | Staff login | Only members/applications they created or personally claimed |
| **Member** | Member portal (`/member`) | Member login (separate credentials) | Only their own profile, wallet, referrals, etc. |
| **Public visitor** | Public site (`/`) | No login | Join via referral link, verify an ID card |

Staff (Super Admin / Admin / Field Executive) and Members authenticate with
**separate JWT token pairs** — a member token can never be used against staff
routes, and vice versa.

---

## 2. Super Admin

The highest privilege level. Everything an Admin can do, plus account-level
control over other Super Admins.

### Exclusive to Super Admin
- Create, edit, or reset the password of **another Super Admin** account
  (an Admin cannot touch a Super Admin account at all).
- View **Audit Logs** (`/admin/audit-logs`) — also reachable from the account
  menu — a full trail of who did what across the org.

### Shared with Admin (see §3 for the full list)
Dashboard, Members, Applications, Membership Plans, Referral Rewards, KYC
Review, Payments, Withdrawals, Donations, Events, Documents, Notices,
Reports & Analytics, Settings, Users.

---

## 3. Admin

Runs day-to-day org operations. Has org-wide visibility (not limited to
records they personally created).

### Dashboard
- **Dashboard** (`/admin`, the landing page) — stat cards (total/active
  members, pending approvals, collections), a membership growth chart,
  status and plan-tier breakdowns, recent activity, and quick-action
  shortcuts. Field Executives see the same page scoped to their own
  jurisdiction, titled "Field Executive Dashboard."

### Membership
- **Members** (`/admin/members`) — search, view, create, and edit every
  member in the org; edit active members' details.
- **Applications** (`/admin/applications`) — review registrations that are
  awaiting payment (new and self-registered); **reject** with a reason if
  needed (fraud prevention) — there's no manual approval step, since paying
  the registration fee automatically activates the membership; **suspend**,
  **reactivate**, or **mark deceased** an existing member (lifecycle
  actions).
- **Membership Plans** (`/admin/membership`) — create/edit plans and tiers
  members enroll in.
- **Referral Rewards** (`/admin/referral-rewards`) — track and fulfill the
  physical bonuses/gifts members earn for reaching each volunteer-tier
  milestone (Bronze/Silver/Gold/Platinum), filterable by Pending/Fulfilled/
  All. Point-rule and cap *configuration* lives in Settings → Referral
  Program, not here.
- **KYC Review** (`/admin/kyc`) — review and approve/reject member-submitted
  KYC (Aadhaar, PAN, bank/UPI details), per org-configurable requirements.

### Finance
- **Payments** (`/admin/payments`) — record and track joining/renewal fee
  payments; see who owes money; **upgrade a member's plan**.
- **Withdrawals** (`/admin/withdrawals`) — review and process members'
  wallet withdrawal requests (subject to org-configured min/max amount,
  frequency limit, and charge rules).
- **Donations** (`/admin/donations`) — record and manage donations; issue
  donation receipts; a percentage of each donation can convert to referral
  points per org settings.

### Operations
- **Events** (`/admin/events`) — create events, manage registrations, and
  review event-based rewards.
- **Documents** (`/admin/documents`) — manage member-uploaded documents
  (identity docs, photos, etc.), including AI-assisted OCR auto-fill for
  identity documents.
- **Notices** (`/admin/notices`) — publish and manage announcements shown to
  members (and as in-app notifications to staff).

### Reports
- **Reports & Analytics** (`/admin/reports`) — org-wide dashboards and
  exportable reports across membership, payments, referrals, events, etc.

### Administration
- **Settings** (`/admin/settings`) — a single tabbed page:
  - **Organization** — org profile, branding, bank details, numbering
    formats (membership/receipt/registration).
  - **Referral Program** — points-per-referral, caps, and the
    referrer-tier × referred-tier point rule matrix.
  - **Withdrawals & KYC** — payout min/max/frequency/charge rules and
    KYC requirements.
  - **Integrations** — enable/configure third-party providers: payment
    gateway, payout gateway (RazorpayX), WhatsApp/SMS/Email notifications,
    AI duplicate detection, AI document (OCR) verification.
  - **Lookups** — manage dropdown reference data used across member forms
    (Religion, Caste Category, Business Type, Membership Category, Branch,
    Education, Occupation, Blood Group, Family Type).
- **Users** (`/admin/users`) — create/edit staff accounts (Admin, Field
  Executive); **cannot** create, edit, or reset a Super Admin's password.

### Not available to Admin
- Managing another Super Admin's account.
- Audit Logs (Super Admin only).

---

## 4. Field Executive

A field-facing role, scoped to **only the members and applications they
personally created or claimed** — every list and record they see is
filtered this way (`buildJurisdictionWhere`), unlike Admin/Super Admin who
see the whole org.

### What they can do
- **Register new members** in the field (create + edit their own members;
  cannot edit members they didn't create/claim once active, except via the
  same claim flow).
- **Claim self-registered members** — when a member self-registers via a
  referral link with no Field Executive attached, any Field Executive (or
  Admin/Super Admin) can claim them into their own jurisdiction
  (`/admin/members` → unclaimed referrals).
- **Reject applications** — but *only* for self-registered members they
  have personally claimed; the API enforces this even though the endpoint is
  open to their role (`ApplicationsService.assertCanApprove`). There's no
  approval step to perform — a member's own registration fee payment
  activates them automatically.
- **Reset a member's portal password** (for members in their jurisdiction).
- **View summary reports** scoped to their own jurisdiction
  (`SUMMARY_ROLES` includes Field Executive; detailed reviewer reports do
  not).
- **Manage donations** for their own members (donations has no strict
  jurisdiction gate on write, but the record set they see is scoped).
- **See their own "wallet" indicator** in the header — not points, but a
  count of members under them with an outstanding fee.

### Not available to Field Executive
- Membership Plans, KYC Review, Withdrawals (all Admin/Super Admin only).
- Reviewer-level Reports, Notices publishing, Events reviewer actions,
  Referral fulfillment, Users, Settings (including its Integrations/Lookups
  tabs), Audit Logs.
- Promoting a member to Field Executive (Admin/Super Admin only).
- Approving/rejecting/suspending/reactivating members outside their own
  claimed jurisdiction.

---

## 5. Member (self-service portal)

Members log in separately at the member portal (`/member`) with their own
credentials (set at registration or via a staff-issued reset). Everything is
scoped to their own record only.

| Page | What it's for |
| --- | --- |
| **Dashboard** | At-a-glance status: membership state, KYC status, wallet balance, recent activity. |
| **My Referrals** | Share their personal referral link/code; track who joined through them and points earned. |
| **Events** | Browse and register for org events. |
| **Wallet** | View referral/donation point balance; request a **withdrawal** (subject to org min/max/frequency rules). |
| **Rewards** | View rewards earned/redeemed from the referral and event reward programs. |
| **Donations** | Make a donation and view past donation receipts. |
| **ID Card** | View/download their digital membership ID card (QR-verifiable, see §6). |
| **Documents** | Upload and manage their own KYC/identity documents. |
| **Payments** | View payment history and receipts; pay outstanding fees. |
| **KYC** | Submit/update Aadhaar, PAN, and bank/UPI details required for KYC completion. |
| **Profile** | View/edit their own personal details. |

### Registration paths
- **Self-registration via referral link** (`/join?ref=<code>`) — a public
  visitor lands with a referrer pre-filled, picks a plan, fills in their
  profile and required documents, and submits — then pays the registration
  fee, which **activates their membership immediately** (no manual staff
  review in between). Staff can still reject a submitted-but-unpaid
  registration from the Applications queue as a fraud-prevention check.
- **Staff-created** — a Field Executive or Admin registers the member
  directly (walking them through the same profile-then-payment order in the
  admin wizard), skipping the public flow.

Either way, the member cannot act as staff, cannot see other members'
records, and every write is scoped to their own `memberId`.

---

## 6. Public visitor (no login)

- **Join via referral** (`/join?ref=<code>`) — resolves the referrer's name,
  lets a new person submit their own membership application.
- **Verify a card** (`/verify/:token`) — scans a member ID card's QR code and
  confirms whether it's a valid, currently-active member (no personal data
  beyond what the card is meant to prove).
- **Public home** — org landing page.

No other read or write access exists for unauthenticated visitors.

---

## 7. Cross-role notes

- **Jurisdiction scoping**: the one structural rule underlying every Field
  Executive permission above — Admin/Super Admin see the whole org, Field
  Executive sees only `createdById = self` (plus claimed self-registrations).
- **Self-registered members** are a special case: they exist before any
  staff member "owns" them, and must be claimed before a Field Executive can
  act on their application.
- **Notifications**: staff see in-app notices/badges (pending applications
  queue, outstanding payments); members receive notices published by
  Admin/Super Admin.
