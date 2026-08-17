-- One portal account per (organization, mobile): the app-level pre-check in
-- MemberAuthService.register finds any existing member with passwordHash and
-- the same mobile, but two concurrent registrations can both pass that read.
-- This partial index makes the invariant a DB-enforced fact.
--
-- Partial on (passwordHash IS NOT NULL AND status <> 'REJECTED') for two
-- deliberate reasons:
--   1. A staff-created member (passwordHash NULL) may later self-register a
--      portal login for the same mobile — only one row ever carries a login.
--   2. A REJECTED member may re-register with the same mobile — the rejection
--      must not block a fresh attempt.
-- Prisma's schema language cannot express filtered indexes, so this lives as
-- raw migration SQL only (the index intentionally has no schema.prisma
-- counterpart; leave it alone when generating future migrations).
CREATE UNIQUE INDEX "members_org_mobile_portal_uniq"
  ON "members"("organizationId", "mobile")
  WHERE "passwordHash" IS NOT NULL AND "status" <> 'REJECTED';
