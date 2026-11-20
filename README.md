# Rentora — Backend API Server

Production-grade Express + TypeScript backend for the **Rentora** Equipment Rental Platform.

---

## 🏗️ Architecture & Modules

The server follows a clean, decoupled layer architecture:

```
src/
  ├── config/             # Environment, CORS, BetterAuth, and MongoDB database configuration
  ├── controllers/        # Request handlers (health, auth)
  ├── middlewares/        # Centralized error handler, 404 handler, Helmet, rate limiting, verifyToken, RBAC
  ├── models/             # Mongoose schemas & domain models (User)
  ├── routes/             # Express API routers (health, auth, better-auth)
  ├── services/           # Business logic layer (jwtService, authService)
  ├── types/              # Standardized API response, error, and domain interfaces
  ├── utils/              # ApiError, ResponseFormatter, asyncHandler wrappers
  ├── validators/         # Reusable Zod validation middleware and schemas
  ├── app.ts              # Express application factory & middleware pipeline
  └── server.ts           # Server entry point with graceful shutdown & DB lifecycle
```

---

## 🛠️ Tech Stack & Dependencies

- **Runtime & Language**: Node.js, TypeScript (Target ES2022, CommonJS output)
- **HTTP Framework**: Express.js (`v5.3.0`)
- **Database**: MongoDB via Mongoose (`v9.12.2`)
- **Authentication**: BetterAuth (`v1.7.27`) + MongoDB Adapter, JWT (`jsonwebtoken v9.0.3`), bcryptjs (`v3.0.3`)
- **Validation**: Zod (`v4.6.7`)
- **Security**: Helmet (`v8.3.0`), CORS (`v2.8.6`), express-rate-limit (`v8.7.5`)
- **Utilities**: cookie-parser, dotenv
- **Development Tooling**: tsx, typescript, eslint, prettier

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` to configure your environment:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP server listening port | `5000` |
| `CLIENT_URL` | Frontend origin for CORS verification | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rentora` |
| `JWT_SECRET` | Secret key for JWT signing (min 16 chars) | `rentora_default_jwt_secret...` |
| `JWT_EXPIRES_IN` | JWT token expiration lifespan | `7d` |
| `BETTER_AUTH_SECRET` | BetterAuth encryption secret | `rentora_default_better_auth...` |
| `BETTER_AUTH_URL` | BetterAuth server endpoint | `http://localhost:5000` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional in dev) | `your_google_client_id...` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret (optional in dev)| `your_google_client_secret...` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_test_placeholder` |
| `IMGBB_API_KEY` | imgbb image hosting API key | `placeholder_imgbb_key` |

---

## 🚀 Scripts

```bash
# Start development server with live reload (tsx watch)
npm run dev

# Run TypeScript typecheck without emitting files
npm run typecheck

# Build for production (outputs to dist/)
npm run build

# Start production server
npm run start

# Run automated smoke test
npm run test:smoke

# Run automated authentication & RBAC test suite
npm run test:auth
```

---

## 🩺 Endpoints

### 1. Root & Health Check
- **`GET /`** — Service status and metadata
- **`GET /api/health`** — Server telemetry, uptime, memory, and database status

### 2. Authentication & Authorization (`/api/auth`)
- **`POST /api/auth/register`** — Register new user with email/password.
  - Body: `{ name, email, password, confirmPassword?, role?, phone?, address?, avatarUrl? }`
  - Enforces role sanitization (disallows client self-assignment of `admin`; defaults to `customer`).
  - Sets HTTP-only `accessToken` cookie and returns `{ user, token }`.
- **`POST /api/auth/login`** — Login with email and password.
  - Body: `{ email, password }`
  - Validates credentials against BetterAuth account collection.
  - Sets HTTP-only `accessToken` cookie and returns `{ user, token }`.
- **`POST /api/auth/google`** — Google OAuth sign-in / registration.
  - Body: `{ idToken?, email, name?, avatarUrl? }`
  - **Guaranteed: New Google registrations strictly default to `Customer` (`customer`) role**.
  - Returns `{ user, token }`.
- **`GET /api/auth/me`** — Current authenticated user profile.
  - Header: `Authorization: Bearer <token>` or cookie `accessToken`.
  - Enables persistent session across page reloads.
- **`POST /api/auth/logout`** — Clears authentication cookie and session.

### 3. Role-Based Access Control (RBAC) Verification Endpoints
- **`GET /api/auth/test/protected`** — Accessible by any verified user (`verifyToken`).
- **`GET /api/auth/test/renter`** — Accessible by `Customer` (Renter) and `Admin` (`verifyRenter`).
- **`GET /api/auth/test/owner`** — Accessible by `Owner` and `Admin` (`verifyOwner`).
- **`GET /api/auth/test/admin`** — Exclusively accessible by `Admin` (`verifyAdmin`).

---

## 🛡️ Required Express Middlewares

| Middleware | Description |
|---|---|
| `verifyToken` | Validates JWT from `Authorization: Bearer` header or HTTP-only cookie, attaching `req.user`. |
| `verifyRenter` | Enforces Customer / Renter permissions (permits `customer`, `renter`, and `admin`). |
| `verifyOwner` | Enforces Equipment Owner permissions (permits `owner` and `admin`). |
| `verifyAdmin` | Enforces Platform Administrator permissions exclusively (`admin`). |
| `authorizeRoles(...roles)` | Generic role checker supporting role combinations with case normalization. |

---

## 📜 Git Commit History (25 Commits)

```
38bffd2 test(auth): add automated RBAC and authentication integration tests
6b55ecb feat(routes): mount auth and role-protected test routes in Express app
9f287b6 feat(controllers): implement authentication controller endpoints
ab3180d feat(middlewares): implement verifyToken and RBAC authorization middlewares
f0d0c8b feat(auth): implement authentication service with role security
efdf521 feat(validators): create Zod schemas for registration and login validation
55d9e4b feat(auth): implement JWT token generation and verification service
d96973f feat(models): create Mongoose user model compatible with BetterAuth
49c1a75 feat(auth): configure BetterAuth with MongoDB adapter and user schema
65f7f20 docs: update server readme with architecture, endpoints, and usage guide
ea7f6d9 test(smoke): add automated health check and verification script
47c739d feat(server): implement server entry point with graceful shutdown
df7f5c8 feat(app): assemble express application with complete middleware pipeline
9b44ede feat(routes): implement health-check controller and route
d1e5a37 feat(validators): create reusable zod request validation middleware
2949e42 feat(database): implement resilient mongodb connection with mongoose
5760c62 feat(middlewares): add helmet and rate limiting security middleware
87cdf23 feat(config): configure cors policies for client integration
8382574 feat(middlewares): implement centralized error handling and not-found middleware
2b0f299 feat(utils): implement standard API response and custom error classes
b503f16 feat(types): define standardized API response and error contracts
fa98d31 feat(config): implement validated environment configuration with zod
68edaac chore: configure development tooling and environment ignore rules
9a6af31 first commit
```
