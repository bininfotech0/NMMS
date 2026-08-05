import type { Prisma } from "@prisma/client";
import { Role, type AuthUser } from "@nmms/shared";

// Row-level filter for Member queries (and anything joined off Member).
// SUPER_ADMIN/ADMIN see the whole org; FIELD_EXECUTIVE only sees members
// they created.
export function buildJurisdictionWhere(user: AuthUser): Prisma.MemberWhereInput {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
    return {};
  }
  return { createdById: user.id };
}
