import { Response } from "express";
import { ApiResponse, ApiResponseMeta, HttpStatus } from "../types";

export class ResponseFormatter {
  static format<T>(
    statusCode: number,
    message: string,
    data: T,
    meta?: ApiResponseMeta
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (meta) {
      response.meta = meta;
    }

    return response;
  }

  static send<T>(
    res: Response,
    statusCode: number,
    message: string,
    data: T,
    meta?: ApiResponseMeta
  ): Response {
    const formatted = this.format(statusCode, message, data, meta);
    return res.status(statusCode).json(formatted);
  }

  static ok<T>(
    res: Response,
    message = "Success",
    data: T,
    meta?: ApiResponseMeta
  ): Response {
    return this.send(res, HttpStatus.OK, message, data, meta);
  }

  static created<T>(
    res: Response,
    message = "Resource created successfully",
    data: T
  ): Response {
    return this.send(res, HttpStatus.CREATED, message, data);
  }

  static noContent(res: Response): Response {
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
