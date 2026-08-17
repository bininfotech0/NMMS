import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { FastifyReply } from "fastify";

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        if (Array.isArray(r.message)) {
          message = (r.message as string[]).join("; ");
        }
        // nestjs-zod's ZodValidationException always sets message to the
        // literal string "Validation failed" — the actual per-field reason
        // (e.g. "Aadhaar number must be 12 digits") only exists in this
        // `errors` array (ZodIssue[]), which every caller of this filter was
        // otherwise silently losing.
        if (message === "Validation failed" && Array.isArray(r.errors)) {
          const details = (r.errors as Array<{ path?: unknown[]; message?: string }>)
            .map((issue) => {
              const field = Array.isArray(issue.path) && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
              return `${field}${issue.message ?? ""}`;
            })
            .filter(Boolean);
          if (details.length > 0) {
            message = details.join("; ");
          }
        }
        error = (r.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if (process.env.NODE_ENV !== "production") {
        error = exception.stack ?? exception.name;
      }
    }

    const body: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).send(body);
  }
}
