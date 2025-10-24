import { Request } from 'express';
import { ParsedTokenData } from '../auth/interface/jwtpayload.interface';

export interface CustomExpressRequest extends Request {
  user?: ParsedTokenData;
}
