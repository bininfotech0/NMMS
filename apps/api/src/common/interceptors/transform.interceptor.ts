import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // Binary/stream responses (e.g. document file downloads) must pass
        // through untouched — wrapping them breaks Fastify's payload handling.
        if (data instanceof StreamableFile) return data;
        const response: ApiResponse<T> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        return response;
      }),
    );
  }
}
