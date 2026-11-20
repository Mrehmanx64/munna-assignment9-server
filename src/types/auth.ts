export type UserRole = "customer" | "owner" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthResponseData {
  user: AuthUser;
  token: string;
}

// Global declaration augmenting Express Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
