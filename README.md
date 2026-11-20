# Rentora — Backend API Server

Production-grade Express + TypeScript backend foundation for the **Rentora** Equipment Rental Platform.

---

## 🏗️ Architecture & Modules

The server follows a clean, decoupled layer architecture:

```
src/
  ├── config/             # Environment, CORS, and MongoDB database configuration
  ├── controllers/        # Request handlers delegating to services
  ├── middlewares/        # Centralized error handler, 404 handler, Helmet, rate limiting
  ├── models/             # Mongoose schemas & domain models (future milestones)
  ├── routes/             # Express API routers and versioned endpoints
  ├── services/           # Business logic layer (future milestones)
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
```

---

## 🩺 Endpoints (Foundation Milestone)

### 1. Root Gateway
- **`GET /`**
  - Status: `200 OK`
  - Returns service status, version, and health check link.

### 2. Health Check
- **`GET /api/health`** (also accessible via `/api/v1/health`)
  - Status: `200 OK`
  - Returns service telemetry, uptime, Node environment, memory usage, and MongoDB connection status.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Service health check",
  "data": {
    "service": "rentora-backend-api",
    "status": "healthy",
    "environment": "development",
    "uptime": {
      "seconds": 42,
      "formatted": "0d 0h 0m 42s"
    },
    "timestamp": "2026-11-20T14:25:00.000Z",
    "database": {
      "status": "connected",
      "host": "localhost",
      "name": "rentora"
    },
    "memory": {
      "heapUsedMB": 24.5,
      "heapTotalMB": 38.2,
      "rssMB": 52.1
    }
  },
  "timestamp": "2026-11-20T14:25:00.000Z"
}
```

### 3. Error Contract & 404 Handling
- Any unhandled route returns a standardized `404 Not Found` payload:
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Route not found: GET /api/unknown-endpoint",
  "errors": null,
  "timestamp": "2026-11-20T14:25:00.000Z"
}
```

---

## 📜 Git Commit History (14 Commits)

```
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
