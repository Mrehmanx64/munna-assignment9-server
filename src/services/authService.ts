import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, IUser, UserRole } from "../models";
import { RegisterInput, LoginInput, GoogleAuthInput } from "../validators";
import { JwtService } from "./jwtService";
import { AuthUser, AuthResponseData } from "../types";
import { ApiError } from "../utils";

export class AuthService {
  /**
   * Transforms Mongoose IUser into sanitized client AuthUser
   */
  private static formatAuthUser(user: IUser): AuthUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || user.image,
      phone: user.phone,
      address: user.address,
    };
  }

  /**
   * Registers a new user with email and password
   * Enforces role sanitization (disallowing client self-assignment of admin)
   */
  static async register(input: RegisterInput): Promise<AuthResponseData> {
    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      throw ApiError.conflict("An account with this email address already exists");
    }

    // Role security: Disallow self-assignment of "admin"; allow "customer" and "owner"
    const sanitizedRole: UserRole = input.role === "owner" ? "owner" : "customer";

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const newUser = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      role: sanitizedRole,
      phone: input.phone,
      address: input.address,
      avatarUrl: input.avatarUrl || undefined,
      image: input.avatarUrl || undefined,
      emailVerified: false,
    });

    // Create credential account record in BetterAuth's account collection
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("account").insertOne({
        userId: newUser._id.toString(),
        accountId: newUser._id.toString(),
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const authUser = this.formatAuthUser(newUser);
    const token = JwtService.generateAccessToken(authUser);

    return { user: authUser, token };
  }

  /**
   * Authenticates user with email and password
   */
  static async login(input: LoginInput): Promise<AuthResponseData> {
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw ApiError.internal("Database connection is not available");
    }

    // Find account credentials in BetterAuth account collection
    const account = await db.collection("account").findOne({
      userId: user._id.toString(),
      providerId: "credential",
    });

    if (!account || !account.password) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(input.password, account.password as string);
    if (!isMatch) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const authUser = this.formatAuthUser(user);
    const token = JwtService.generateAccessToken(authUser);

    return { user: authUser, token };
  }

  /**
   * Handles Google OAuth sign-in and registration
   * Cryptographically verifies Google ID token with Google's public tokeninfo endpoint.
   * Guaranteed: new Google registrations strictly default to "customer" role.
   * Never authenticates based solely on client-submitted email.
   */
  static async googleAuth(input: GoogleAuthInput): Promise<AuthResponseData> {
    if (!input.idToken) {
      throw ApiError.badRequest("Google ID token is required");
    }

    // 1. Verify Google ID token signature and claims via official Google OAuth2 tokeninfo service
    let googlePayload: any;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.idToken)}`,
        { headers: { "User-Agent": "Rentora-Auth/1.0" } }
      );
      if (!response.ok) {
        throw new Error(`Google token service responded with status ${response.status}`);
      }
      googlePayload = await response.json();
    } catch (err: any) {
      throw ApiError.unauthorized(`Google ID token verification failed: ${err.message}`);
    }

    if (!googlePayload || googlePayload.error || !googlePayload.email) {
      throw ApiError.unauthorized("Google authentication failed: Missing verified email identity");
    }

    // 2. Validate token issuer
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!validIssuers.includes(googlePayload.iss)) {
      throw ApiError.unauthorized("Invalid Google token issuer");
    }

    // 3. Validate audience if GOOGLE_CLIENT_ID is configured in environment
    const configuredAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (configuredAudience && googlePayload.aud !== configuredAudience) {
      throw ApiError.unauthorized("Google token audience mismatch");
    }

    // 4. Validate token expiration
    const expSeconds = Number(googlePayload.exp);
    if (!expSeconds || expSeconds * 1000 <= Date.now()) {
      throw ApiError.unauthorized("Google ID token has expired");
    }

    // 5. Validate email_verified claim
    const isEmailVerified =
      googlePayload.email_verified === "true" || googlePayload.email_verified === true;
    if (!isEmailVerified) {
      throw ApiError.unauthorized("Google account email is not verified");
    }

    // 6. Verified user attributes from verified token
    const email = googlePayload.email.toLowerCase().trim();
    const name = googlePayload.name || email.split("@")[0] || "Google User";
    const avatarUrl = googlePayload.picture || undefined;

    let user = await User.findOne({ email });

    if (!user) {
      // New user from Google -> STRICT REQUIREMENT: Default role is "customer"
      user = await User.create({
        name,
        email,
        role: "customer", // Enforced default Google registration role: Customer
        avatarUrl,
        image: avatarUrl,
        emailVerified: true,
      });

      const db = mongoose.connection.db;
      if (db) {
        await db.collection("account").insertOne({
          userId: user._id.toString(),
          accountId: googlePayload.sub || user._id.toString(),
          providerId: "google",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const authUser = this.formatAuthUser(user);
    const token = JwtService.generateAccessToken(authUser);

    return { user: authUser, token };
  }

  /**
   * Retrieves user profile by user ID for session persistence
   */
  static async getMe(userId: string): Promise<AuthUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound("User account not found");
    }
    return this.formatAuthUser(user);
  }
}
