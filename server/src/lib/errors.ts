import { HttpStatusCode } from 'axios';

export interface IApiError extends Error {
  statusCode: number;
  rawErrors?: string[];
  code?: string;
}

export class ApiError extends Error implements IApiError {
  statusCode: number;
  rawErrors: string[];
  code?: string;
  constructor(statusCode: number, message: string, rawErrors?: string[], code?: string) {
    super(message);
    this.statusCode = statusCode;
    if (rawErrors) {
      this.rawErrors = rawErrors;
    }
    if (code) {
      this.code = code;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export class HttpBadRequestError extends ApiError {
  constructor(message: string, errors: string[], code?: string) {
    super(HttpStatusCode.BadRequest, message, errors, code);
  }
}

export class HttpInternalServerError extends ApiError {
  constructor(message: string, errors?: string[], code?: string) {
    super(HttpStatusCode.InternalServerError, message, errors, code);
  }
}

export class HttpUnAuthorizedError extends ApiError {
  constructor(message: string, code?: string) {
    super(HttpStatusCode.Unauthorized, message, undefined, code);
  }
}

export class HttpNotFoundError extends ApiError {
  constructor(message: string, errors?: string[], code?: string) {
    super(HttpStatusCode.NotFound, message, errors, code);
  }
}

export class HttpForbiddenError extends ApiError {
  constructor(message: string, errors?: string[], code?: string) {
    super(HttpStatusCode.Forbidden, message, errors, code);
  }
}
