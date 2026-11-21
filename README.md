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
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_placeholder` |
| `STRIPE_SUCCESS_URL`| Stripe checkout success redirect URL | `http://localhost:3000/dashboard/customer/rentals?status=success&session_id={CHECKOUT_SESSION_ID}` |
| `STRIPE_CANCEL_URL` | Stripe checkout cancellation redirect URL | `http://localhost:3000/equipment?status=cancelled` |
| `IMGBB_API_KEY` | imgbb image hosting API key | `placeholder_imgbb_key` |

---

## 🔐 Role Access & Authentication Model

Rentora implements strict role-based access control (RBAC) across three distinct tiers:

- **Customer / Renter**: Default role assigned upon registration and Google OAuth sign-in. Access to public equipment, booking creation, personal favorites, and rental history.
- **Fleet Owner**: Access to owner equipment CRUD, fleet availability, rental dispatch, and fleet earnings analytics.
- **Platform Administrator**: Universal supervisory clearance. Access to equipment approvals/rejections with mandatory audit trails, master escrow ledger, user directory management, and platform analytics.

In development, developers can register accounts or test role endpoints using test fixtures. In production, default credentials and automatic demo accounts are prohibited; administrator privileges must be initialized through controlled administrative provisioning.

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

# Run automated booking availability, pricing, & Stripe webhook test suite (21 assertions)
npm run test:booking

# Run automated customer favorites, role isolation, & analytics aggregation test suite (27 assertions)
npm run test:analytics

# Run automated admin user directory & role management test suite (15 assertions)
npm run test:users
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

### 7. Rental Bookings APIs (`/api/bookings`, `/api/owner/bookings`, `/api/admin/bookings`)
- **`GET /api/equipment/:id/availability`** — Public/Customer equipment availability lookup.
  - Query parameters: `startDate`, `endDate`, `quantity` (optional, default: 1).
  - Evaluates active rentals and 30-minute pending Stripe checkout reservations against `totalQuantity`.
  - Returns: `{ isAvailable, availableQuantity, requestedQuantity, totalQuantity, activeBookingsCount }`.
- **`POST /api/bookings`** — Customer equipment booking creation & Stripe checkout initialization.
  - *Requires authentication with `Customer` role (`verifyRenter`).*
  - Body: `{ equipmentId, startDate, endDate, quantity, contactNumber, deliveryAddress, additionalNotes? }`.
  - Server-side duration and pricing calculations (`Daily`: days, `Weekly`: ceil(days/7), `Monthly`: ceil(days/30)).
  - Rejects overlapping bookings that exceed `totalQuantity`.
  - Initiates Stripe Checkout Session and returns: `{ booking, checkoutUrl, sessionId }`.
- **`GET /api/bookings/my-rentals`** — Customer rental history.
  - *Requires `Customer` role.*
  - Query filters: `bookingStatus`, `paymentStatus`, pagination (`page`, `limit`).
  - Returns populated equipment, owner contact details, and payment summary.
- **`GET /api/bookings/:id`** — Single rental booking details.
  - Accessible to the customer who booked, the equipment owner, or an administrator.
- **`POST /api/bookings/:id/checkout`** — Reinitiate Stripe Checkout Session.
  - *Requires `Customer` role.*
  - Validates booking is `Pending` payment and regenerates a fresh Stripe Checkout Session.
- **`GET /api/owner/bookings`** — Owner bookings and fleet rental management.
  - *Requires `Owner` role (`verifyOwner`).*
  - Returns all bookings for equipment owned by the authenticated owner.
  - Supports filters: `equipmentId`, `bookingStatus`, `paymentStatus`, pagination.
- **`GET /api/admin/bookings`** — Platform-wide booking oversight console.
  - *Requires `Admin` role (`verifyAdmin`).*
  - View all platform bookings across all customers and owners.
- **`PATCH /api/admin/bookings/:id/status`** — Admin booking status override.
  - *Requires `Admin` role (`verifyAdmin`).*
  - Body: `{ bookingStatus?, paymentStatus? }`.

### 8. Payments & Stripe Webhook (`/api/payments`)
- **`POST /api/payments/webhook`** — Stripe Webhook receiver.
  - Validates `stripe-signature` header against raw request byte buffer (`req.rawBody`).
  - Idempotent processing: verifies if `Payment` record with `stripeSessionId` already exists before applying mutations.
  - Handles `checkout.session.completed`: updates booking `paymentStatus: "Paid"`, `bookingStatus: "Confirmed"`, creates persistent `Payment` ledger entry.
  - Handles `checkout.session.expired`: unlocks temporary inventory hold by updating booking `bookingStatus: "Cancelled"`, `paymentStatus: "Failed"`.

### 9. Customer Favorites APIs (`/api/favorites`)
*Requires authentication with strict `Customer` role (`verifyStrictCustomer`).*
- **`POST /api/favorites/:equipmentId`** — Add equipment listing to customer's favorites.
  - Only approved equipment listings can be favorited (pending/rejected items are rejected).
  - Idempotent: returns existing record cleanly if already favorited.
- **`GET /api/favorites`** — List authenticated customer's saved favorites.
  - Populates equipment data and query pagination (`page`, `limit`).
  - Gracefully handles and filters out any deleted equipment without breaking client rendering.
- **`DELETE /api/favorites/:equipmentId`** — Remove equipment from customer's favorites.
  - Idempotent removal bound strictly to `req.user.id`.
- **`GET /api/favorites/:equipmentId/status`** — Check favorite status.
  - Returns: `{ isFavorite: boolean }`.

### 10. Dashboard Analytics APIs (`/api/admin/analytics`, `/api/owner/analytics`)
- **Admin Analytics** (*Requires `Admin` role — `verifyAdmin`*):
  - **`GET /api/admin/analytics/overview`** — Platform-wide system totals:
    - Returns: `totalUsers`, `totalEquipment`, `totalBookings`, `pendingApprovals`, `approvedEquipment`, `completedRentals`, `activeRentals`, `totalRevenue`.
    - Revenue is strictly calculated from verified `Paid` payment records with zero duplicate counting.
  - **`GET /api/admin/analytics/monthly-bookings`** — Historical monthly booking & revenue trajectory.
    - Query parameter: `months` (default: 6, max: 24).
    - Aggregates by month (`YYYY-MM`) and guarantees zero-booking months are represented in chronological order.
- **Owner Analytics** (*Requires `Owner` role — `verifyOwner`*):
  - **`GET /api/owner/analytics/overview`** — Fleet overview strictly isolated to `req.user.id`:
    - Returns: `totalEquipment`, `activeListings`, `pendingListings`, `totalBookings`, `completedRentals`, `activeRentals`, `pendingRentals`, `totalEarnings`.
  - **`GET /api/owner/analytics/monthly-earnings`** — Historical monthly earnings strictly isolated to authenticated owner.
    - Query parameter: `months` (default: 6, max: 24).
    - Aggregates by month (`YYYY-MM`) and fills zero-earning months with `{ month, earnings: 0, rentalsCount: 0 }`.

### 11. Admin User Management APIs (`/api/admin/users`)
*Requires `Admin` role (`verifyAdmin`).*
- **`GET /api/admin/users`** — Paginated user directory with multi-field search and role filtering.
  - Query parameters:
    - `search`: Case-insensitive regex match against user `name` and `email`.
    - `role`: Filter by role (`customer`, `owner`, `admin`, `all`).
    - `page` (default: 1), `limit` (default: 20).
  - Prohibits exposing password hashes, salts, or sensitive auth tokens.
- **`PATCH /api/admin/users/:id/role`** — Update a user's role (`customer`, `owner`, `admin`).
  - Self-demotion guard: strictly prevents administrators from removing their own admin privileges.

---

## 🌐 Production Deployment (Render / Railway / VPS)

### 1. Build and Run Commands
- **Build Command**: `npm run build` (runs `tsc` and outputs compiled JavaScript to `dist/`)
- **Start Command**: `npm run start` (runs `node dist/server.js`)
- **Root Directory**: `server`

### 2. Required Production Environment Variables
- `NODE_ENV=production`
- `PORT=5000` (or assigned dynamic `$PORT`)
- `CLIENT_URL=https://your-rentora-frontend.vercel.app` (comma-separated or single URL; Vercel preview wildcards `*.vercel.app` are also automatically supported)
- `MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/rentora?retryWrites=true&w=majority`
- `JWT_SECRET=<64-char-random-string>`
- `JWT_EXPIRES_IN=7d`
- `BETTER_AUTH_SECRET=<32-char-random-string>`
- `BETTER_AUTH_URL=https://your-rentora-api.onrender.com`
- `STRIPE_SECRET_KEY=sk_live_...` (or test key `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_SUCCESS_URL=https://your-rentora-frontend.vercel.app/dashboard/customer/rentals?status=success&session_id={CHECKOUT_SESSION_ID}`
- `STRIPE_CANCEL_URL=https://your-rentora-frontend.vercel.app/equipment?status=cancelled`
- `IMGBB_API_KEY=<your_imgbb_api_key>`
- `GOOGLE_CLIENT_ID=<your_google_oauth_client_id>`
- `GOOGLE_CLIENT_SECRET=<your_google_oauth_client_secret>`

### 3. Stripe Webhook Production Configuration
1. In the Stripe Dashboard, go to **Developers > Webhooks**.
2. Add an endpoint pointing to: `https://your-rentora-api.onrender.com/api/payments/webhook`.
3. Select events to listen to:
   - `checkout.session.completed`
   - `checkout.session.expired`
4. Copy the **Signing secret** (`whsec_...`) into your production `STRIPE_WEBHOOK_SECRET` environment variable.
