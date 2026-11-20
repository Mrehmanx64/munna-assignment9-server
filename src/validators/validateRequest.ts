import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodTypeAny, ZodError } from "zod";

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validateRequest = (schema: RequestValidationSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as Record<string, string>;
      }

      if (schema.query) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.query = (await schema.query.parseAsync(req.query)) as any;
      }

      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
};
