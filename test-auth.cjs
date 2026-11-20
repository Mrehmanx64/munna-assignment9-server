const http = require("http");
const { app } = require("./dist/app.js");
const { JwtService } = require("./dist/services/jwtService.js");
const { registerSchema, loginSchema, googleAuthSchema } = require("./dist/validators/authValidators.js");

const PORT = 5098;

const runTest = async () => {
  console.log("=================================================");
  console.log("🧪 Rentora Milestone 3: Auth & RBAC Test Suite");
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
  // 1. UNIT TESTS: ZOD AUTH VALIDATION SCHEMAS
  // -----------------------------------------------------------------
  console.log("--- 1. Zod Request Validation Schemas ---");

  // Valid registration
  const validReg = registerSchema.safeParse({
    name: "Alexander Hayes",
    email: "alexander@apexbuild.com",
    password: "Password123!",
    confirmPassword: "Password123!",
    role: "customer",
  });
  assert(validReg.success, "Valid customer registration passes Zod validation");

  // Password mismatch
  const mismatchReg = registerSchema.safeParse({
    name: "Alexander Hayes",
    email: "alexander@apexbuild.com",
    password: "Password123!",
    confirmPassword: "WrongPassword!",
  });
  assert(!mismatchReg.success, "Password mismatch triggers Zod validation error");

  // Role clamping: Renter normalizes to Customer
  const renterReg = registerSchema.safeParse({
    name: "Contractor Dan",
    email: "dan@contractor.com",
    password: "Password123!",
    role: "renter",
  });
  assert(renterReg.success && renterReg.data.role === "customer", "Role 'renter' normalizes to 'customer'");

  // Invalid email
  const badEmailLogin = loginSchema.safeParse({
    email: "not-an-email",
    password: "SecretPassword123",
  });
  assert(!badEmailLogin.success, "Invalid email format fails login validation");

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: JWT SERVICE TOKEN ISSUANCE & VERIFICATION
  // -----------------------------------------------------------------
  console.log("\n--- 2. JWT Generation & Verification ---");

  const customerUser = {
    id: "usr-cust-01",
    email: "alexander@apexbuild.com",
    role: "customer",
    name: "Alexander Hayes",
  };

  const ownerUser = {
    id: "usr-owner-01",
    email: "marcus@vanceheavygear.com",
    role: "owner",
    name: "Marcus Vance",
  };

  const adminUser = {
    id: "usr-admin-01",
    email: "elena@rentora.internal",
    role: "admin",
    name: "Elena Rostova",
  };

  const customerToken = JwtService.generateAccessToken(customerUser);
  const ownerToken = JwtService.generateAccessToken(ownerUser);
  const adminToken = JwtService.generateAccessToken(adminUser);

  assert(typeof customerToken === "string" && customerToken.length > 30, "Generated customer JWT token");
  assert(typeof ownerToken === "string" && ownerToken.length > 30, "Generated owner JWT token");
  assert(typeof adminToken === "string" && adminToken.length > 30, "Generated admin JWT token");

  const decodedCustomer = JwtService.verifyAccessToken(customerToken);
  assert(
    decodedCustomer.id === customerUser.id && decodedCustomer.role === "customer",
    "Verified and decoded customer JWT payload"
  );

  // -----------------------------------------------------------------
  // 3. INTEGRATION TESTS: EXPRESS HTTP PIPELINE & RBAC GUARDS
  // -----------------------------------------------------------------
  console.log("\n--- 3. Express HTTP Pipeline & RBAC Endpoints ---");

  const server = app.listen(PORT);

  const request = (method, path, body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const url = `http://localhost:${PORT}${path}`;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const req = http.request(url, { method, headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });

      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  try {
    // 3a. Unauthenticated access to protected route -> 401
    const unauthRes = await request("GET", "/api/auth/test/protected");
    assert(unauthRes.status === 401, "Protected route denies request without token (401)");

    // 3b. Authenticated access with valid token -> 200
    const authRes = await request("GET", "/api/auth/test/protected", null, customerToken);
    assert(authRes.status === 200 && authRes.body.success === true, "Protected route grants access with valid token (200)");

    // 3c. Customer accessing Renter endpoint -> 200 OK
    const custRenterRes = await request("GET", "/api/auth/test/renter", null, customerToken);
    assert(custRenterRes.status === 200, "Customer accesses verifyRenter endpoint (200)");

    // 3d. Customer accessing Owner endpoint -> 403 Forbidden
    const custOwnerRes = await request("GET", "/api/auth/test/owner", null, customerToken);
    assert(custOwnerRes.status === 403, "Customer denied on verifyOwner endpoint (403)");

    // 3e. Customer accessing Admin endpoint -> 403 Forbidden
    const custAdminRes = await request("GET", "/api/auth/test/admin", null, customerToken);
    assert(custAdminRes.status === 403, "Customer denied on verifyAdmin endpoint (403)");

    // 3f. Owner accessing Owner endpoint -> 200 OK
    const ownerOwnerRes = await request("GET", "/api/auth/test/owner", null, ownerToken);
    assert(ownerOwnerRes.status === 200, "Owner accesses verifyOwner endpoint (200)");

    // 3g. Owner accessing Admin endpoint -> 403 Forbidden
    const ownerAdminRes = await request("GET", "/api/auth/test/admin", null, ownerToken);
    assert(ownerAdminRes.status === 403, "Owner denied on verifyAdmin endpoint (403)");

    // 3h. Admin accessing Admin endpoint -> 200 OK
    const adminAdminRes = await request("GET", "/api/auth/test/admin", null, adminToken);
    assert(adminAdminRes.status === 200, "Admin accesses verifyAdmin endpoint (200)");

    // 3i. Admin accessing Renter & Owner endpoints -> 200 OK (Supervisory clearance)
    const adminRenterRes = await request("GET", "/api/auth/test/renter", null, adminToken);
    const adminOwnerRes = await request("GET", "/api/auth/test/owner", null, adminToken);
    assert(
      adminRenterRes.status === 200 && adminOwnerRes.status === 200,
      "Admin granted supervisory access across Renter and Owner endpoints (200)"
    );

    // 3j. Registration endpoint input validation rejection -> 422
    const invalidRegRes = await request("POST", "/api/auth/register", {
      name: "Short",
      email: "invalid-email-string",
      password: "123", // Too short
    });
    assert(
      invalidRegRes.status === 422 && Array.isArray(invalidRegRes.body.errors),
      "Register endpoint returns structured 422 validation errors for invalid input"
    );

    // 3k. Logout endpoint -> 200 OK
    const logoutRes = await request("POST", "/api/auth/logout");
    assert(logoutRes.status === 200 && logoutRes.body.success === true, "Logout endpoint succeeds (200)");

  } finally {
    server.close();
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL AUTHENTICATION & RBAC TESTS PASSED!");
    process.exit(0);
  }
};

runTest().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
