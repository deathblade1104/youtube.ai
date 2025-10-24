import { Request } from 'express';
import { ParsedTokenData } from '../../modules/auth/interface/jwtpayload.interface';

export interface CustomExpressRequest extends Request {
  user?: ParsedTokenData;
}
