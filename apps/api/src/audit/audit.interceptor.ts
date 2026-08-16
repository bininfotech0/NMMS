import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { AuthUser } from "@nmms/shared";
import type { FastifyRequest } from "fastify";
import { Observable, tap } from "rxjs";
import { AuditService } from "./audit.service";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
// Known action-style suffixes on otherwise POST routes (e.g. /applications/:id/verify).
const KNOWN_VERBS = new Set([
  "submit",
  "verify",
  "approve",
  "reject",
  "import",
  "reset-password",
  "mark-paid",
  "reveal-bank-account",
]);

function deriveAction(method: string, path: string): string {
  const lastSegment = path.split("/").filter(Boolean).pop() ?? "";
  if (KNOWN_VERBS.has(lastSegment)) {
    return lastSegment.toUpperCase().replace(/-/g, "_");
  }
  if (method === "POST") return "CREATE";
  if (method === "PATCH" || method === "PUT") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return method;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & { user?: AuthUser; params?: Record<string, string> }
    >();
    const method = request.method;

    // AuthController writes its own LOGIN_SUCCESS/LOGIN_FAILED entries, so
    // skip it here to avoid a redundant generic CREATE row per login —
    // matched against the prefixed path since app.setGlobalPrefix makes
    // every route "/api/v1/...", not just "/auth/...".
    if (!MUTATION_METHODS.has(method) || request.url.startsWith("/api/v1/auth")) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const entity = context.getClass().name.replace(/Controller$/, "");
        const entityId = Object.values(request.params ?? {})[0] ?? null;

        void this.auditService.log({
          organizationId: request.user?.organizationId ?? null,
          actorId: request.user?.id ?? null,
          actorEmail: request.user?.email ?? null,
          action: deriveAction(method, request.url),
          entity,
          entityId,
          ipAddress: request.ip,
        });
      }),
    );
  }
}
