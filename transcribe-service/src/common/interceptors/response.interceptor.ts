import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomResponseBodyType } from '../helpers/custom-response.helper';
import { CustomExpressRequest } from '../interfaces/express-request.interface';

@Injectable()
export class ResponseInterceptor<
  T = Record<string, any> | Array<Record<string, any>>,
> implements NestInterceptor
{
  private readonly logger = new Logger(ResponseInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<CustomExpressRequest>();

    // Skip response formatting for health check endpoints
    if (request.url === '/' || request.url.includes('/health')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((res: CustomResponseBodyType<T>) =>
        this.responseHandler(res, context),
      ),
      //catchError((err: any) => throwError(() => err)),
    );
  }

  responseHandler(
    customResp: CustomResponseBodyType<T>,
    context: ExecutionContext,
  ) {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CustomExpressRequest>();
    const statusCode = response.statusCode || 200; // Default to 200 if status code is not set

    const logData = {
      status_code: statusCode,
      log_type: 'ACCESS',
      user_id: request?.user?.sub,
      response: {
        timestamp: new Date().toISOString(),
        body: {},
      },
    };

    this.logger.log(logData, 'Operation completed successfully');
    return {
      success: true,
      path: request.url,
      status_code: statusCode,
      message: customResp?.message || 'Operation completed successfully',
      data: customResp?.data,
    };
  }
}
