export interface CustomResponseBodyType<
  T = Record<string, any> | Array<Record<string, any>>,
> {
  message: string;
  data: T;
}

export class CustomResponseBody<
  T = Record<string, any> | Array<Record<string, any>>,
> {
  message: string;
  data: T;

  constructor(message = 'success', body: T = {} as T) {
    this.message = message;
    this.data = body;
  }
}
