import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { CustomExpressRequest } from '../interfaces/express-request.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CustomExpressRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;

    let message: string | object = 'Internal server error';
    if (isHttpException) {
      const resp = exception.getResponse();
      message =
        typeof resp === 'string' ? resp : ((resp as any).message ?? resp);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const logData = {
      statusCode: status,
      log_type: 'ACCESS',
      path: request.url,
      user_id: request?.user?.sub,
      error: {
        message: message,
        stack: exception instanceof Error ? exception.stack : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.error(JSON.stringify(logData));

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
