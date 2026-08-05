import { Role, type AuthUser } from "@nmms/shared";
import { buildJurisdictionWhere } from "./scope.util";

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    role: Role.FIELD_EXECUTIVE,
    organizationId: "org-1",
    ...overrides,
  };
}

describe("buildJurisdictionWhere", () => {
  it("gives SUPER_ADMIN unrestricted access", () => {
    expect(buildJurisdictionWhere(user({ role: Role.SUPER_ADMIN }))).toEqual({});
  });

  it("gives ADMIN unrestricted access", () => {
    expect(buildJurisdictionWhere(user({ role: Role.ADMIN }))).toEqual({});
  });

  it("scopes FIELD_EXECUTIVE to only members they created", () => {
    const result = buildJurisdictionWhere(user({ role: Role.FIELD_EXECUTIVE, id: "fe-1" }));
    expect(result).toEqual({ createdById: "fe-1" });
  });
});
