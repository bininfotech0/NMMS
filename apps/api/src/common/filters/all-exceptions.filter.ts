import {
  Logger,
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
  private readonly logger = new Logger(AllExceptionsFilter.name);

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
          // Only the human-readable reason is shown — the field path
          // (e.g. "aadhaarNumber") is a code name members can't read.
          const details = [
            ...new Set(
              (r.errors as Array<{ message?: string }>)
                .map((issue) => issue.message?.trim() ?? "")
                .filter(Boolean),
            ),
          ];
          if (details.length > 0) {
            message = details.join("; ");
          }
        }
        error = (r.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      // Unexpected errors (database, network, bugs) carry internal details
      // that mean nothing to a member — show a plain message in production
      // and keep the real one in the server log.
      if (process.env.NODE_ENV === "production") {
        message = "We couldn't complete your request right now. Please try again in a few minutes.";
        this.logger.error(exception.message, exception.stack);
      } else {
        message = exception.message;
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
