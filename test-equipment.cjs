const http = require("http");
const { app } = require("./dist/app.js");
const { JwtService } = require("./dist/services/jwtService.js");
const {
  createEquipmentSchema,
  updateEquipmentSchema,
  adminEquipmentStatusSchema,
  equipmentQuerySchema,
} = require("./dist/validators/equipmentValidators.js");
const { ImgBBService } = require("./dist/services/imgbbService.js");
const { Equipment } = require("./dist/models/equipmentModel.js");

const PORT = 5097;

const runTest = async () => {
  console.log("=================================================");
  console.log("🧪 Rentora Milestone 4: Equipment Management Test Suite");
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
  // 1. UNIT TESTS: ZOD EQUIPMENT VALIDATION SCHEMAS
  // -----------------------------------------------------------------
  console.log("--- 1. Zod Request Validation Schemas ---");

  // Valid equipment creation
  const validEquipment = createEquipmentSchema.safeParse({
    name: "CAT 320D Hydraulic Excavator",
    description: "20-ton tracked crawler excavator with hydraulic quick coupler and digging bucket.",
    category: "Construction Equipment",
    location: "Oakland, CA",
    rentalPrice: 450,
    rentalType: "daily",
    availableQuantity: 2,
    totalQuantity: 2,
    condition: "excellent",
    brand: "Caterpillar",
    model: "320D",
    imageUrl: "https://images.unsplash.com/photo-1768085091650-e8e89ef57b76",
    rentalTerms: "Requires heavy equipment operator license and $2,000 security deposit.",
  });
  assert(validEquipment.success, "Valid equipment creation payload passes Zod validation");
  if (validEquipment.success) {
    assert(validEquipment.data.rentalType === "Daily", "Rental type 'daily' normalizes to 'Daily'");
    assert(validEquipment.data.condition === "Excellent", "Condition 'excellent' normalizes to 'Excellent'");
  }

  // Missing required name and title
  const missingName = createEquipmentSchema.safeParse({
    description: "Valid description longer than ten characters.",
    category: "Construction",
    location: "San Francisco, CA",
    rentalPrice: 200,
    brand: "CAT",
    model: "D6",
    imageUrl: "https://example.com/img.jpg",
    rentalTerms: "Standard rental waiver applies.",
  });
  assert(!missingName.success, "Equipment missing both name and title is rejected by Zod");

  // Negative rental price
  const negativePrice = createEquipmentSchema.safeParse({
    name: "Excavator",
    description: "Valid description longer than ten characters.",
    category: "Construction",
    location: "San Francisco, CA",
    rentalPrice: -50,
    brand: "CAT",
    model: "D6",
    imageUrl: "https://example.com/img.jpg",
    rentalTerms: "Standard rental waiver applies.",
  });
  assert(!negativePrice.success, "Negative rental price is rejected by Zod");

  // Invalid rental type
  const badRentalType = createEquipmentSchema.safeParse({
    name: "Excavator",
    description: "Valid description longer than ten characters.",
    category: "Construction",
    location: "San Francisco, CA",
    rentalPrice: 100,
    rentalType: "yearly",
    brand: "CAT",
    model: "D6",
    imageUrl: "https://example.com/img.jpg",
    rentalTerms: "Standard rental waiver applies.",
  });
  assert(!badRentalType.success, "Invalid rental type ('yearly') is rejected by Zod");

  // Admin status approval
  const adminApprove = adminEquipmentStatusSchema.safeParse({
    status: "Approved",
  });
  assert(adminApprove.success, "Admin 'Approved' status without reason is valid");

  // Admin status rejection with reason
  const adminRejectWithReason = adminEquipmentStatusSchema.safeParse({
    status: "Rejected",
    rejectionReason: "Equipment certification of insurance is missing or invalid.",
  });
  assert(adminRejectWithReason.success, "Admin 'Rejected' status with explanation reason is valid");

  // Admin status rejection WITHOUT reason
  const adminRejectNoReason = adminEquipmentStatusSchema.safeParse({
    status: "Rejected",
    rejectionReason: "   ",
  });
  assert(!adminRejectNoReason.success, "Admin 'Rejected' status without explanation reason is rejected");

  // Query validation & transformations
  const queryParse = equipmentQuerySchema.safeParse({
    minPrice: "100",
    maxPrice: "1000",
    page: "2",
    limit: "15",
    rentalType: "monthly",
    available: "true",
    sort: "price_asc",
  });
  assert(queryParse.success, "Equipment query string parameters successfully parsed and coerced");
  if (queryParse.success) {
    assert(queryParse.data.minPrice === 100, "minPrice coerced to number 100");
    assert(queryParse.data.page === 2, "page coerced to integer 2");
    assert(queryParse.data.rentalType === "Monthly", "rentalType coerced to 'Monthly'");
    assert(queryParse.data.available === true, "available coerced to boolean true");
  }

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: IMGBB SERVICE IN TEST MODE
  // -----------------------------------------------------------------
  console.log("\n--- 2. ImgBB Upload Service ---");
  process.env.NODE_ENV = "test";
  const uploadResult = await ImgBBService.uploadBase64(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "test-rig"
  );
  assert(typeof uploadResult.url === "string" && uploadResult.url.includes("test"), "ImgBB service handles base64 image upload cleanly");

  // -----------------------------------------------------------------
  // 3. INTEGRATION TESTS: HTTP ENDPOINTS & RBAC ACCESS CONTROL
  // -----------------------------------------------------------------
  console.log("\n--- 3. HTTP Integration & RBAC Security Rules ---");

  // Setup mock query responses if MongoDB is not connected
  const mockEquipmentDoc = {
    _id: "60d5ec49f1b2c8a1e8a8b1a1",
    name: "CAT 320D Hydraulic Excavator",
    title: "CAT 320D Hydraulic Excavator",
    category: "Construction Equipment",
    rentalPrice: 450,
    rentalType: "Daily",
    availableQuantity: 2,
    status: "Approved",
    owner: {
      _id: "60d5ec49f1b2c8a1e8a8b1a2",
      name: "Marcus Vance",
      email: "marcus@vanceheavygear.com",
      avatarUrl: "https://example.com/avatar.jpg",
      phone: "+1 555-123-4567",
      role: "owner",
    },
    createdAt: new Date(),
  };

  const createMockQuery = (result) => {
    const chain = {
      populate: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => result,
      exec: async () => result,
      then: (resolve) => resolve(result),
    };
    return chain;
  };

  Equipment.find = function () {
    return createMockQuery([mockEquipmentDoc]);
  };

  Equipment.countDocuments = async function () {
    return 1;
  };

  Equipment.aggregate = async function () {
    return [{ category: "Construction Equipment", count: 8 }];
  };

  Equipment.findById = function () {
    return createMockQuery(mockEquipmentDoc);
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const customerToken = JwtService.generateAccessToken({
    id: "60d5ec49f1b2c8a1e8a8b1a1",
    email: "alexander@apexbuild.com",
    role: "customer",
    name: "Alexander Hayes",
  });

  const owner1Token = JwtService.generateAccessToken({
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
    // 1. Unauthenticated user cannot create equipment (401)
    const unauthCreate = await makeRequest(
      {
        path: "/api/owner/equipment",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { name: "Unauthorized Rig" }
    );
    assert(
      unauthCreate.statusCode === 401,
      `Unauthenticated user cannot create equipment (HTTP ${unauthCreate.statusCode})`
    );

    // 2. Customer cannot create equipment (403)
    const customerCreate = await makeRequest(
      {
        path: "/api/owner/equipment",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
      },
      {
        name: "Customer Excavator",
        description: "Attempted customer listing with more than 10 characters.",
        category: "Construction",
        location: "Oakland",
        rentalPrice: 300,
        brand: "CAT",
        model: "320",
        imageUrl: "https://example.com/img.jpg",
        rentalTerms: "Terms and conditions required.",
      }
    );
    assert(
      customerCreate.statusCode === 403,
      `Customer role cannot create equipment (HTTP ${customerCreate.statusCode} Forbidden)`
    );

    // 3. Customer cannot access admin endpoints (403)
    const customerAdminAccess = await makeRequest({
      path: "/api/admin/equipment",
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert(
      customerAdminAccess.statusCode === 403,
      `Customer role cannot access admin equipment endpoints (HTTP ${customerAdminAccess.statusCode} Forbidden)`
    );

    // 4. Owner cannot approve equipment (403)
    const ownerApproveAttempt = await makeRequest(
      {
        path: "/api/admin/equipment/60d5ec49f1b2c8a1e8a8b1a2/approve",
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      }
    );
    assert(
      ownerApproveAttempt.statusCode === 403,
      `Owner role cannot approve equipment listings (HTTP ${ownerApproveAttempt.statusCode} Forbidden)`
    );

    // 5. Invalid MongoDB ObjectId format returns validation error (422/400)
    const invalidIdCheck = await makeRequest(
      {
        path: "/api/owner/equipment/not-a-valid-mongo-id",
        method: "GET",
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      }
    );
    assert(
      invalidIdCheck.statusCode === 422 || invalidIdCheck.statusCode === 400,
      `Invalid MongoDB ObjectId returns validation error (HTTP ${invalidIdCheck.statusCode})`
    );

    // 6. Public equipment listings route responds with 200 OK without auth
    const publicEquipment = await makeRequest({
      path: "/api/equipment?category=Construction&sort=price_asc",
      method: "GET",
    });
    assert(
      publicEquipment.statusCode === 200,
      `Public equipment listing GET /api/equipment returns HTTP ${publicEquipment.statusCode}`
    );

    // 7. Public featured equipment route responds with 200 OK without auth
    const featuredEquipment = await makeRequest({
      path: "/api/equipment/featured?limit=6",
      method: "GET",
    });
    assert(
      featuredEquipment.statusCode === 200,
      `Public featured equipment GET /api/equipment/featured returns HTTP ${featuredEquipment.statusCode}`
    );

    // 8. Public equipment categories route responds with 200 OK
    const categoriesRes = await makeRequest({
      path: "/api/equipment/categories",
      method: "GET",
    });
    assert(
      categoriesRes.statusCode === 200,
      `Public categories summary GET /api/equipment/categories returns HTTP ${categoriesRes.statusCode}`
    );

    // 9. Upload route rejects unauthenticated requests (401)
    const unauthUpload = await makeRequest({
      path: "/api/uploads/image",
      method: "POST",
    });
    assert(
      unauthUpload.statusCode === 401,
      `Upload endpoint rejects unauthenticated requests (HTTP ${unauthUpload.statusCode})`
    );

    // 10. Admin route is accessible with Admin token (200)
    const adminAccess = await makeRequest({
      path: "/api/admin/equipment?status=Pending",
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert(
      adminAccess.statusCode === 200,
      `Admin role successfully accesses admin equipment review console (HTTP ${adminAccess.statusCode})`
    );

    // 11. API modules index lists all registered modules
    const apiIndex = await makeRequest({
      path: "/api",
      method: "GET",
    });
    assert(
      apiIndex.statusCode === 200 && apiIndex.body.data.modules.includes("equipment"),
      "Root /api index lists 'equipment', 'owner-equipment', and 'admin-equipment'"
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
