import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload, AuthUser } from "../types";
import { ApiError } from "../utils";

export class JwtService {
  /**
   * Generates a signed JWT access token for an authenticated user
   */
  static generateAccessToken(user: AuthUser, customExpiresIn?: string): string {
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const options: SignOptions = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: (customExpiresIn || env.JWT_EXPIRES_IN) as any,
      issuer: "rentora-auth",
    };

    return jwt.sign(payload, env.JWT_SECRET, options);
  }

  /**
   * Verifies and decodes a JWT access token
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: "rentora-auth",
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized("Access token has expired. Please log in again.");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized("Invalid access token. Authentication failed.");
      }
      throw ApiError.unauthorized("Token verification failed.");
    }
  }
}
