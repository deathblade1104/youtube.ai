import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          // Log performance metrics
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms - ${ip} ${userAgent}`,
          );

          // Log slow requests (>1 second)
          if (duration > 1000) {
            this.logger.warn(
              `SLOW REQUEST: ${method} ${url} took ${duration}ms`,
            );
          }

          // Log trading-specific metrics
          if (url.includes('/orders') && method === 'POST') {
            this.logger.log(`ORDER_PLACED: ${url} - ${duration}ms`);
          }

          if (url.includes('/trades')) {
            this.logger.log(`TRADE_QUERY: ${url} - ${duration}ms`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `ERROR: ${method} ${url} ${error.status || 500} ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
