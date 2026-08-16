import { of } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";
import type { AuditService } from "./audit.service";

function makeContext(method: string, url: string, params: Record<string, string> = {}) {
  const request = { method, url, params, user: { id: "user-1", email: "a@b.com", organizationId: "org-1" }, ip: "127.0.0.1" };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => ({ name: "MembersController" }),
  } as any;
}

describe("AuditInterceptor", () => {
  function makeInterceptor() {
    const auditService = { log: jest.fn() } as unknown as AuditService;
    const interceptor = new AuditInterceptor(auditService);
    return { interceptor, auditService };
  }

  it("does not audit-log requests under the prefixed /api/v1/auth path", async () => {
    const { interceptor, auditService } = makeInterceptor();
    const next = { handle: () => of("ok") };

    await new Promise((resolve) => {
      interceptor.intercept(makeContext("POST", "/api/v1/auth/login"), next).subscribe(resolve);
    });

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("audit-logs other mutation routes", async () => {
    const { interceptor, auditService } = makeInterceptor();
    const next = { handle: () => of("ok") };

    await new Promise((resolve) => {
      interceptor.intercept(makeContext("PATCH", "/api/v1/members/m1", { id: "m1" }), next).subscribe(resolve);
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "Members", entityId: "m1" }),
    );
  });
});
