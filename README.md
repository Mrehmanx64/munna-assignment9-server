# Rentora — Backend API Server

Production-grade Express + TypeScript backend for the **Rentora** Equipment Rental Platform.

---

## 🏗️ Architecture & Modules

The server follows a clean, decoupled layer architecture:

```
src/
  ├── config/             # Environment, CORS, BetterAuth, and MongoDB database configuration
  ├── controllers/        # Request handlers (health, auth, equipment, owner, admin, upload)
  ├── middlewares/        # Centralized error handler, 404 handler, Helmet, rate limiting, verifyToken, RBAC, upload
  ├── models/             # Mongoose schemas & domain models (User, Equipment)
  ├── routes/             # Express API routers (health, auth, equipment, owner, admin, uploads, better-auth)
  ├── services/           # Business logic layer (jwtService, authService, equipmentService, imgbbService)
  ├── types/              # Standardized API response, error, domain, and equipment interfaces
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
- **File Upload & Hosting**: Multer (`v1.4.5-lts.1` memory storage), ImgBB API
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

# Run automated authentication & RBAC test suite (19 assertions)
npm run test:auth

# Run automated equipment management & upload test suite (26 assertions)
npm run test:equipment
```

---

## 🩺 Endpoints

### 1. Root & Health Check
- **`GET /`** — Service status and registered modules list
- **`GET /api/health`** — Server telemetry, uptime, memory, and database status

### 2. Authentication & Authorization (`/api/auth`)
- **`POST /api/auth/register`** — Register new user with email/password.
  - Body: `{ name, email, password, confirmPassword?, role?, phone?, address?, avatarUrl? }`
  - Enforces role sanitization (disallows client self-assignment of `admin`; defaults to `customer`).
  - Sets HTTP-only `accessToken` cookie and returns `{ user, token }`.
- **`POST /api/auth/login`** — Sign in with email/password.
  - Body: `{ email, password }`
  - Validates credentials and sets HTTP-only `accessToken` cookie.
- **`POST /api/auth/google`** — Google OAuth exchange.
  - Body: `{ email, name, googleId?, avatarUrl? }`
  - Strictly defaults role to `customer` for newly created Google users.
- **`GET /api/auth/me`** — Session persistence across page reloads.
  - Protected by `verifyToken` (reads Bearer header or HTTP-only cookie).
  - Returns authenticated user profile.
- **`POST /api/auth/logout`** — Clears authentication cookie and invalidates session.
- **`GET /api/auth/test/protected`** — Verification endpoint for any authenticated token.
- **`GET /api/auth/test/renter`** — Protected by `verifyRenter` (Renter/Customer & Admin).
- **`GET /api/auth/test/owner`** — Protected by `verifyOwner` (Owner & Admin).
- **`GET /api/auth/test/admin`** — Protected by `verifyAdmin` (Admin only).

### 3. Public Equipment APIs (`/api/equipment`)
- **`GET /api/equipment`** — Get all approved equipment listings with server-side search, filtering, and pagination.
  - Query parameters:
    - `search` / `q`: multi-field search (title, name, brand, model, description, location)
    - `category`: case-insensitive category filter
    - `location`: location regex filter
    - `rentalType`: `Daily`, `Weekly`, `Monthly`
    - `minPrice`, `maxPrice`: numeric price bounds
    - `available`: `true` (availableQuantity > 0)
    - `sort`: `price_asc`, `price_desc`, `newest`, `rating`
    - `page` (default: 1), `limit` (default: 12)
  - Returns: `{ success: true, data: IEquipment[], meta: { total, page, limit, totalPages } }`
- **`GET /api/equipment/featured`** — Get top featured equipment (hard-capped at 6 via MongoDB `.limit(6)`).
- **`GET /api/equipment/categories`** — Aggregate summary of available approved listings by category.
- **`GET /api/equipment/:id`** — Get equipment details by ID with populated owner contact info.
  - Non-approved listings return 404 unless requested by the equipment owner or an administrator.

### 4. Owner Equipment APIs (`/api/owner/equipment`)
*Requires authentication with `Owner` role.*
- **`POST /api/owner/equipment`** — Create a new equipment listing.
  - Ownership is bound strictly to `req.user.id`.
  - Approval status is forced to `Pending`.
  - Body validated via Zod (`createEquipmentSchema`).
- **`GET /api/owner/equipment`** — Get all equipment listings owned by the authenticated owner.
  - Supports query filters: `status`, `category`, `search`, pagination.
- **`GET /api/owner/equipment/:id`** — Get single equipment owned by current owner.
  - Rejects access with 403 Forbidden if the equipment belongs to another owner.
- **`PUT /api/owner/equipment/:id`** & **`PATCH /:id`** — Update own equipment listing.
  - Prohibits altering owner or self-approving listing.
- **`DELETE /api/owner/equipment/:id`** — Delete own equipment listing.

### 5. Admin Equipment APIs (`/api/admin/equipment`)
*Requires authentication with `Admin` role.*
- **`GET /api/admin/equipment`** — Get all equipment across all statuses (`Pending`, `Approved`, `Rejected`).
  - Supports `status`, `category`, `search`, and pagination.
- **`PATCH /api/admin/equipment/:id/approve`** — Approve equipment listing.
  - Sets `status: "Approved"`, `approvedAt: new Date()`, `approvedBy: adminId`.
- **`PATCH /api/admin/equipment/:id/reject`** — Reject equipment listing.
  - Body: `{ rejectionReason: string }` (mandatory explanation).
  - Sets `status: "Rejected"`, `rejectionReason`, `rejectedAt: new Date()`, `rejectedBy: adminId`.
- **`PUT /api/admin/equipment/:id`** — Update any equipment listing as administrator.
- **`DELETE /api/admin/equipment/:id`** — Permanently delete any equipment listing.

### 6. File & Image Uploads (`/api/uploads`)
*Requires authentication.*
- **`POST /api/uploads/image`** (or **`POST /api/uploads`**) — Upload equipment photography to ImgBB.
  - Accepts multipart form-data (field `image`) or JSON `{ image: "<base64_data>", name?: string }`.
  - Validates MIME types (JPEG, PNG, WEBP, GIF) and 5MB file size limit.
  - Keeps binary data in memory buffers; binaries are never stored in MongoDB.
  - Returns: `{ url, displayUrl, deleteUrl, thumbnail }`.
