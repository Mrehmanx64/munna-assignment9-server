const http = require("http");
const { app } = require("./dist/app.js");
const { JwtService } = require("./dist/services/jwtService.js");
const {
  adminUserQuerySchema,
  updateUserRoleSchema,
  userIdParamSchema,
} = require("./dist/validators/userValidators.js");
const { UserService } = require("./dist/services/userService.js");
const { User } = require("./dist/models/userModel.js");

const PORT = 5094;

const runTest = async () => {
  console.log("=================================================");
  console.log("🧪 Rentora Admin User Management Test Suite");
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

  // Valid query schema
  const validQuery = adminUserQuerySchema.safeParse({
    search: "alexander",
    role: "customer",
    page: "2",
    limit: "15",
  });
  assert(
    validQuery.success && validQuery.data.page === 2 && validQuery.data.limit === 15,
    "Valid adminUserQuerySchema coerces page and limit to numbers"
  );

  // Invalid role query
  const invalidRoleQuery = adminUserQuerySchema.safeParse({ role: "superadmin" });
  assert(!invalidRoleQuery.success, "Invalid role query parameter is rejected");

  // Valid role update
  const validRoleUpdate = updateUserRoleSchema.safeParse({ role: "owner" });
  assert(validRoleUpdate.success, "Valid role update passes updateUserRoleSchema");

  // Invalid role update
  const invalidRoleUpdate = updateUserRoleSchema.safeParse({ role: "manager" });
  assert(!invalidRoleUpdate.success, "Invalid role 'manager' is rejected by updateUserRoleSchema");

  // Valid user ID param
  const validIdParam = userIdParamSchema.safeParse({ id: "60d5ec49f1b2c8a1e8a8b1a1" });
  assert(validIdParam.success, "Valid 24-char ObjectId passes userIdParamSchema");

  const invalidIdParam = userIdParamSchema.safeParse({ id: "invalid-id" });
  assert(!invalidIdParam.success, "Malformed user ID is rejected by userIdParamSchema");

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: SERVICE LOGIC & SELF-DEMOTION PROTECTION
  // -----------------------------------------------------------------
  console.log("\n--- 2. Service Logic & Self-Demotion Guard ---");

  const adminId = "60d5ec49f1b2c8a1e8a8b1a3";
  const targetCustomerId = "60d5ec49f1b2c8a1e8a8b1a1";

  // Attempt self-demotion
  let selfDemotionError = null;
  try {
    await UserService.updateUserRole(adminId, adminId, "customer");
  } catch (err) {
    selfDemotionError = err;
  }
  assert(
    selfDemotionError !== null && selfDemotionError.statusCode === 400,
    "Admin self-demotion is strictly blocked by UserService (HTTP 400 Bad Request)"
  );

  // -----------------------------------------------------------------
  // 3. HTTP INTEGRATION & RBAC SECURITY TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 3. HTTP Integration & Role-Based Access Control ---");

  const mockUsers = [
    {
      _id: "60d5ec49f1b2c8a1e8a8b1a1",
      name: "Alexander Hayes",
      email: "alexander@apexbuild.com",
      role: "customer",
      phone: "+1 (555) 345-6789",
      address: "Oakland Yard",
      avatarUrl: "https://example.com/avatar1.jpg",
      createdAt: new Date(),
      toJSON: function () {
        return this;
      },
    },
    {
      _id: "60d5ec49f1b2c8a1e8a8b1a2",
      name: "Marcus Vance",
      email: "marcus@vanceheavygear.com",
      role: "owner",
      createdAt: new Date(),
      toJSON: function () {
        return this;
      },
    },
  ];

  const createMockQuery = (result) => {
    const chain = {
      select: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => result,
      exec: async () => result,
      then: (resolve) => resolve(result),
    };
    return chain;
  };

  User.find = function () {
    return createMockQuery(mockUsers);
  };
  User.countDocuments = async function () {
    return mockUsers.length;
  };
  User.findById = function (id) {
    const found = mockUsers.find((u) => u._id === String(id));
    if (found) {
      return {
        ...found,
        save: async function () {
          return this;
        },
        toJSON: function () {
          return this;
        },
      };
    }
    return null;
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
    // 1. Unauthenticated request rejected (401)
    const unauthRes = await makeRequest({
      path: "/api/admin/users",
      method: "GET",
    });
    assert(
      unauthRes.statusCode === 401,
      `Unauthenticated access to /api/admin/users rejected with HTTP 401`
    );

    // 2. Customer role blocked (403 Forbidden)
    const customerRes = await makeRequest({
      path: "/api/admin/users",
      method: "GET",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      customerRes.statusCode === 403,
      `Customer role blocked from admin user directory (HTTP 403 Forbidden)`
    );

    // 3. Owner role blocked (403 Forbidden)
    const ownerRes = await makeRequest({
      path: "/api/admin/users",
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      ownerRes.statusCode === 403,
      `Owner role blocked from admin user directory (HTTP 403 Forbidden)`
    );

    // 4. Admin retrieves paginated user directory (200 OK)
    const adminRes = await makeRequest({
      path: "/api/admin/users?role=customer&page=1&limit=10",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminRes.statusCode === 200 && Array.isArray(adminRes.body.data),
      `Admin retrieves user directory with filters (HTTP 200 OK, count: ${adminRes.body?.data?.length})`
    );

    // 5. Admin updates a target user's role (200 OK)
    const updateRoleRes = await makeRequest(
      {
        path: `/api/admin/users/${targetCustomerId}/role`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { role: "owner" }
    );
    assert(
      updateRoleRes.statusCode === 200 && updateRoleRes.body.data.role === "owner",
      `Admin successfully updates user role to 'owner' (HTTP 200 OK)`
    );

    // 6. Admin attempting self-demotion is rejected via HTTP (400 Bad Request)
    const selfDemoteRes = await makeRequest(
      {
        path: `/api/admin/users/${adminId}/role`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { role: "customer" }
    );
    assert(
      selfDemoteRes.statusCode === 400 && selfDemoteRes.body.message.includes("demote"),
      `Admin self-demotion rejected over HTTP with message: ${selfDemoteRes.body?.message}`
    );

    // 7. Invalid role body rejected with 422
    const invalidRoleHttp = await makeRequest(
      {
        path: `/api/admin/users/${targetCustomerId}/role`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { role: "unauthorized_role" }
    );
    assert(
      invalidRoleHttp.statusCode === 422,
      `Invalid role string rejected with HTTP 422 Unprocessable Entity`
    );

    // 8. API modules list includes 'admin-users'
    const apiIndex = await makeRequest({
      path: "/api",
      method: "GET",
    });
    assert(
      apiIndex.statusCode === 200 && apiIndex.body.data.modules.includes("admin-users"),
      "Root /api index lists 'admin-users' module"
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
