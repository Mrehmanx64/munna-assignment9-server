const http = require("http");
const { app } = require("./dist/app.js");
const { JwtService } = require("./dist/services/jwtService.js");
const {
  favoriteParamsSchema,
  favoriteQuerySchema,
} = require("./dist/validators/favoriteValidators.js");
const {
  monthlyAnalyticsQuerySchema,
} = require("./dist/validators/analyticsValidators.js");
const { FavoriteService } = require("./dist/services/favoriteService.js");
const { AnalyticsService } = require("./dist/services/analyticsService.js");
const { Favorite } = require("./dist/models/favoriteModel.js");
const { Equipment } = require("./dist/models/equipmentModel.js");
const { Booking } = require("./dist/models/bookingModel.js");
const { Payment } = require("./dist/models/paymentModel.js");
const { User } = require("./dist/models/userModel.js");

const PORT = 5095;

const runTest = async () => {
  console.log("=================================================");
  console.log("🧪 Rentora Milestone 6: Favorites & Analytics Test Suite");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✔ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  // -----------------------------------------------------------------
  // 1. UNIT TESTS: ZOD VALIDATION SCHEMAS
  // -----------------------------------------------------------------
  console.log("--- 1. Zod Request Validation Schemas ---");

  // Valid 24-character hexadecimal ObjectId
  const validParam = favoriteParamsSchema.safeParse({
    equipmentId: "60d5ec49f1b2c8a1e8a8b1a0",
  });
  assert(validParam.success, "Valid 24-character ObjectId passes favoriteParamsSchema");

  // Invalid ObjectId format
  const invalidParam = favoriteParamsSchema.safeParse({
    equipmentId: "invalid-id-123",
  });
  assert(!invalidParam.success, "Invalid equipment ID string is rejected by favoriteParamsSchema");

  // Missing equipmentId
  const missingParam = favoriteParamsSchema.safeParse({});
  assert(!missingParam.success, "Missing equipmentId is rejected by favoriteParamsSchema");

  // Monthly analytics query validation
  const validMonthsQuery = monthlyAnalyticsQuerySchema.safeParse({ months: "12" });
  assert(
    validMonthsQuery.success && validMonthsQuery.data.months === 12,
    "Valid months parameter is coerced to integer 12"
  );

  const invalidMonthsQuery = monthlyAnalyticsQuerySchema.safeParse({ months: "0" });
  assert(!invalidMonthsQuery.success, "Months value less than 1 is rejected");

  const excessiveMonthsQuery = monthlyAnalyticsQuerySchema.safeParse({ months: "30" });
  assert(!excessiveMonthsQuery.success, "Months value greater than 24 is rejected");

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: ANALYTICS MONTH SEQUENCE GENERATION
  // -----------------------------------------------------------------
  console.log("\n--- 2. Analytics Month Sequence Generation ---");

  const sequence6 = AnalyticsService.generateMonthSequence(6);
  assert(sequence6.length === 6, "generateMonthSequence(6) produces exactly 6 months");
  assert(
    /^\d{4}-\d{2}$/.test(sequence6[0]) && /^\d{4}-\d{2}$/.test(sequence6[5]),
    "Month keys adhere strictly to 'YYYY-MM' format"
  );

  const sequence12 = AnalyticsService.generateMonthSequence(12);
  assert(sequence12.length === 12, "generateMonthSequence(12) produces exactly 12 months");

  // -----------------------------------------------------------------
  // 3. HTTP INTEGRATION & RBAC SECURITY TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 3. HTTP Integration & Role-Based Access Control ---");

  // Helper to create mock Mongoose queries
  const createMockQuery = (result) => {
    const chain = {
      populate: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      select: () => chain,
      lean: async () => result,
      exec: async () => result,
      then: (resolve) => resolve(result),
    };
    return chain;
  };

  const mockEquipmentDoc = {
    _id: "60d5ec49f1b2c8a1e8a8b1a0",
    name: "CAT 320D Excavator",
    title: "CAT 320D Excavator",
    status: "Approved",
    rentalPrice: 450,
    rentalType: "Daily",
    owner: "60d5ec49f1b2c8a1e8a8b1a2",
    toJSON: function () {
      return this;
    },
  };

  const mockPendingEquipmentDoc = {
    _id: "60d5ec49f1b2c8a1e8a8b1a9",
    name: "Unapproved Crane",
    title: "Unapproved Crane",
    status: "Pending",
    owner: "60d5ec49f1b2c8a1e8a8b1a2",
  };

  const mockFavoriteDoc = {
    _id: "60d5ec49f1b2c8a1e8a8b1f1",
    customer: "60d5ec49f1b2c8a1e8a8b1a1",
    equipment: mockEquipmentDoc,
    createdAt: new Date(),
    toJSON: function () {
      return this;
    },
    populate: async function () {
      return this;
    },
    save: async function () {
      return this;
    },
  };

  // Configure Mongoose stubs for standalone execution
  Favorite.find = function () {
    return createMockQuery([mockFavoriteDoc]);
  };
  Favorite.countDocuments = async function () {
    return 1;
  };
  Favorite.findOne = function () {
    return createMockQuery(null);
  };
  Favorite.findOneAndDelete = async function () {
    return mockFavoriteDoc;
  };
  Favorite.exists = async function () {
    return { _id: "60d5ec49f1b2c8a1e8a8b1f1" };
  };
  Favorite.prototype.save = async function () {
    return this;
  };
  Favorite.prototype.populate = async function () {
    return this;
  };

  Equipment.findById = function (id) {
    if (String(id) === "60d5ec49f1b2c8a1e8a8b1a9") {
      return createMockQuery(mockPendingEquipmentDoc);
    }
    if (String(id) === "60d5ec49f1b2c8a1e8a8b1a0") {
      return createMockQuery(mockEquipmentDoc);
    }
    return createMockQuery(null);
  };

  Equipment.countDocuments = async function (filter = {}) {
    if (filter.status === "Pending") return 3;
    if (filter.status === "Approved") return 12;
    if (filter.owner) return 5;
    return 15;
  };

  User.countDocuments = async function () {
    return 42;
  };

  Booking.countDocuments = async function (filter = {}) {
    if (filter.bookingStatus === "Completed") return 18;
    if (filter.bookingStatus && filter.bookingStatus.$in) return 7;
    if (filter.owner) return 8;
    return 25;
  };

  Booking.aggregate = async function () {
    return [
      { _id: "2026-10", count: 4 },
      { _id: "2026-11", count: 7 },
    ];
  };

  Payment.aggregate = async function (pipeline) {
    const match = pipeline[0]?.$match || {};
    // Owner specific query
    if (match.owner) {
      if (pipeline[1]?.$group?._id === null) {
        return [{ _id: null, total: 4850.5 }];
      }
      return [
        { _id: "2026-10", earnings: 1350, rentalsCount: 2 },
        { _id: "2026-11", earnings: 3500.5, rentalsCount: 4 },
      ];
    }
    // Admin global revenue
    if (pipeline[1]?.$group?._id === null) {
      return [{ _id: null, total: 14250.75 }];
    }
    // Admin monthly revenue
    return [
      { _id: "2026-10", revenue: 5200 },
      { _id: "2026-11", revenue: 9050.75 },
    ];
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const customerToken = JwtService.generateAccessToken({
    id: "60d5ec49f1b2c8a1e8a8b1a1",
    email: "alexander@apexbuild.com",
    role: "customer",
    name: "Alexander Hayes",
  });

  const ownerToken = JwtService.generateAccessToken({
    id: "60d5ec49f1b2c8a1e8a8b1a2",
    email: "marcus@vanceheavygear.com",
    role: "owner",
    name: "Marcus Vance",
  });

  const otherOwnerToken = JwtService.generateAccessToken({
    id: "60d5ec49f1b2c8a1e8a8b1a8",
    email: "victor@apexmachinery.com",
    role: "owner",
    name: "Victor Stone",
  });

  const adminToken = JwtService.generateAccessToken({
    id: "60d5ec49f1b2c8a1e8a8b1a3",
    email: "elena@rentora.internal",
    role: "admin",
    name: "Elena Rostova",
  });

  const makeRequest = (options, postData = null) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: PORT,
          ...options,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: body ? JSON.parse(body) : null,
              });
            } catch {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body,
              });
            }
          });
        }
      );
      req.on("error", reject);
      if (postData) {
        req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  };

  try {
    // ---------------------------------------------------------------
    // 3A. FAVORITES ENDPOINT TESTS
    // ---------------------------------------------------------------
    console.log("\n--- 3A. Favorites Endpoint Security & Functionality ---");

    // 1. Unauthenticated request rejected (401)
    const unauthFav = await makeRequest({
      path: "/api/favorites",
      method: "GET",
    });
    assert(
      unauthFav.statusCode === 401,
      `Unauthenticated favorites access rejected with HTTP 401`
    );

    // 2. Owner role cannot access customer favorites (403 Forbidden)
    const ownerFav = await makeRequest({
      path: "/api/favorites",
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerFav.statusCode === 403,
      `Owner role is blocked from customer favorites endpoint (HTTP 403 Forbidden)`
    );

    // 3. Admin role cannot access customer favorites (403 Forbidden)
    const adminFav = await makeRequest({
      path: "/api/favorites",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminFav.statusCode === 403,
      `Admin role is blocked from customer favorites endpoint (HTTP 403 Forbidden)`
    );

    // 4. Customer successfully lists own favorites (200 OK)
    const customerFavList = await makeRequest({
      path: "/api/favorites",
      method: "GET",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      customerFavList.statusCode === 200 && Array.isArray(customerFavList.body.data),
      `Customer successfully retrieves favorites list (HTTP 200 OK)`
    );

    // 5. Customer checks favorite status (200 OK)
    const favStatus = await makeRequest({
      path: "/api/favorites/60d5ec49f1b2c8a1e8a8b1a0/status",
      method: "GET",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      favStatus.statusCode === 200 && favStatus.body.data.isFavorite === true,
      `Customer checks equipment favorite status (HTTP 200, isFavorite: true)`
    );

    // 6. Invalid ObjectId parameter returns 422 Unprocessable Entity
    const invalidIdFav = await makeRequest({
      path: "/api/favorites/not-a-valid-id",
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      invalidIdFav.statusCode === 422,
      `Invalid equipment ObjectId rejected with HTTP 422 validation error`
    );

    // 7. Non-approved (Pending) equipment cannot be favorited (HTTP 400 Bad Request)
    const pendingFav = await makeRequest({
      path: "/api/favorites/60d5ec49f1b2c8a1e8a8b1a9",
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      pendingFav.statusCode === 400 && pendingFav.body.message.includes("approved"),
      `Pending equipment is rejected from being favorited (HTTP 400 Bad Request)`
    );

    // 8. Customer removes equipment from favorites (200 OK)
    const removeFav = await makeRequest({
      path: "/api/favorites/60d5ec49f1b2c8a1e8a8b1a0",
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      removeFav.statusCode === 200 && removeFav.body.data.favorited === false,
      `Customer removes equipment from favorites (HTTP 200, favorited: false)`
    );

    // ---------------------------------------------------------------
    // 3B. ADMIN DASHBOARD ANALYTICS TESTS
    // ---------------------------------------------------------------
    console.log("\n--- 3B. Admin Analytics Security & Accuracy ---");

    // 1. Customer blocked from admin analytics (403 Forbidden)
    const custAdminOverview = await makeRequest({
      path: "/api/admin/analytics/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      custAdminOverview.statusCode === 403,
      `Customer role blocked from admin analytics (HTTP 403 Forbidden)`
    );

    // 2. Owner blocked from admin analytics (403 Forbidden)
    const ownerAdminOverview = await makeRequest({
      path: "/api/admin/analytics/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerAdminOverview.statusCode === 403,
      `Owner role blocked from admin analytics (HTTP 403 Forbidden)`
    );

    // 3. Admin retrieves platform overview metrics (200 OK)
    const adminOverview = await makeRequest({
      path: "/api/admin/analytics/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminOverview.statusCode === 200 &&
        adminOverview.body.data.totalUsers === 42 &&
        adminOverview.body.data.totalEquipment === 15 &&
        adminOverview.body.data.pendingApprovals === 3 &&
        adminOverview.body.data.completedRentals === 18 &&
        adminOverview.body.data.totalRevenue === 14250.75,
      `Admin retrieves accurate platform overview metrics (HTTP 200, revenue: $14,250.75)`
    );

    // 4. Admin retrieves monthly booking statistics with zero-filled months (200 OK)
    const adminMonthly = await makeRequest({
      path: "/api/admin/analytics/monthly-bookings?months=6",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminMonthly.statusCode === 200 &&
        Array.isArray(adminMonthly.body.data) &&
        adminMonthly.body.data.length === 6,
      `Admin retrieves 6-month booking metrics with zero-month fallbacks (HTTP 200, length: 6)`
    );

    // ---------------------------------------------------------------
    // 3C. OWNER DASHBOARD ANALYTICS & TENANT ISOLATION TESTS
    // ---------------------------------------------------------------
    console.log("\n--- 3C. Owner Analytics Security & Fleet Isolation ---");

    // 1. Customer blocked from owner analytics (403 Forbidden)
    const custOwnerOverview = await makeRequest({
      path: "/api/owner/analytics/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      custOwnerOverview.statusCode === 403,
      `Customer role blocked from owner analytics (HTTP 403 Forbidden)`
    );

    // 2. Owner retrieves own fleet overview metrics (200 OK)
    const ownerOverview = await makeRequest({
      path: "/api/owner/analytics/overview",
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerOverview.statusCode === 200 &&
        ownerOverview.body.data.totalEquipment === 5 &&
        ownerOverview.body.data.totalEarnings === 4850.5,
      `Owner retrieves isolated fleet overview (HTTP 200, totalEarnings: $4,850.50)`
    );

    // 3. Owner retrieves historical monthly earnings with zero-value months (200 OK)
    const ownerMonthly = await makeRequest({
      path: "/api/owner/analytics/monthly-earnings?months=6",
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerMonthly.statusCode === 200 &&
        Array.isArray(ownerMonthly.body.data) &&
        ownerMonthly.body.data.length === 6,
      `Owner retrieves 6-month earnings breakdown including zero-earning months (HTTP 200)`
    );

    // 4. Verify API index includes 'favorites', 'admin-analytics', and 'owner-analytics'
    const apiIndex = await makeRequest({
      path: "/api",
      method: "GET",
    });
    assert(
      apiIndex.statusCode === 200 &&
        apiIndex.body.data.modules.includes("favorites") &&
        apiIndex.body.data.modules.includes("admin-analytics") &&
        apiIndex.body.data.modules.includes("owner-analytics"),
      "Root /api index contains 'favorites', 'admin-analytics', and 'owner-analytics' modules"
    );

    // ---------------------------------------------------------------
    // 3D. EMPTY DATABASE FALLBACK TESTS
    // ---------------------------------------------------------------
    console.log("\n--- 3D. Empty Collection Zero Fallback Tests ---");

    Payment.aggregate = async function () {
      return [];
    };
    Equipment.countDocuments = async function () {
      return 0;
    };
    Booking.countDocuments = async function () {
      return 0;
    };
    User.countDocuments = async function () {
      return 0;
    };

    const emptyOverview = await AnalyticsService.getAdminOverview();
    assert(
      emptyOverview.totalRevenue === 0 &&
        emptyOverview.totalUsers === 0 &&
        emptyOverview.totalEquipment === 0,
      "Empty database collections yield safe zero numbers (not null/NaN)"
    );

    const emptyOwnerOverview = await AnalyticsService.getOwnerOverview(
      "60d5ec49f1b2c8a1e8a8b1a8"
    );
    assert(
      emptyOwnerOverview.totalEarnings === 0 &&
        emptyOwnerOverview.totalEquipment === 0,
      "Empty owner fleet collections yield safe zero numbers (not null/NaN)"
    );

  } finally {
    server.close();
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
};

runTest().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
