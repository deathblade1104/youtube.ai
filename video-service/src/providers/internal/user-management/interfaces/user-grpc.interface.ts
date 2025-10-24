import { Observable } from 'rxjs';

export interface GetUserByIdRequest {
  id: number;
}

export interface GetUserByIdResponse {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface UserServiceClient {
  GetUserById(request: GetUserByIdRequest): Observable<GetUserByIdResponse>;
}
