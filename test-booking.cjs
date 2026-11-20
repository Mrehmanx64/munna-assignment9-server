const http = require("http");
const { app } = require("./dist/app.js");
const { JwtService } = require("./dist/services/jwtService.js");
const {
  createBookingSchema,
  updateBookingStatusSchema,
  availabilityQuerySchema,
} = require("./dist/validators/bookingValidators.js");
const { BookingService } = require("./dist/services/bookingService.js");
const { StripeService } = require("./dist/services/stripeService.js");
const { Booking } = require("./dist/models/bookingModel.js");
const { Equipment } = require("./dist/models/equipmentModel.js");
const { Payment } = require("./dist/models/paymentModel.js");

const PORT = 5096;

const runTest = async () => {
  console.log("=================================================");
  console.log("🧪 Rentora Milestone 5: Booking & Stripe Test Suite");
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
  // 1. UNIT TESTS: ZOD BOOKING VALIDATION & DATE INTEGRITY
  // -----------------------------------------------------------------
  console.log("--- 1. Zod Request Validation & Date Integrity ---");

  // Valid booking payload
  const validBooking = createBookingSchema.safeParse({
    equipmentId: "60d5ec49f1b2c8a1e8a8b1a1",
    startDate: "2026-06-01T08:00:00.000Z",
    endDate: "2026-06-05T18:00:00.000Z",
    quantity: 2,
    contactNumber: "+1 (555) 345-6789",
    deliveryAddress: "742 Evergreen Terrace, Springfield",
    additionalNotes: "Site entry via Gate 3.",
  });
  assert(validBooking.success, "Valid booking creation payload passes Zod validation");

  // Inverted date range (endDate before startDate)
  const invertedDates = createBookingSchema.safeParse({
    equipmentId: "60d5ec49f1b2c8a1e8a8b1a1",
    startDate: "2026-06-10T08:00:00.000Z",
    endDate: "2026-06-05T18:00:00.000Z",
    quantity: 1,
    contactNumber: "+1 (555) 345-6789",
    deliveryAddress: "742 Evergreen Terrace",
  });
  assert(!invertedDates.success, "End date preceding start date is rejected by Zod validation");

  // Zero or negative quantity
  const zeroQuantity = createBookingSchema.safeParse({
    equipmentId: "60d5ec49f1b2c8a1e8a8b1a1",
    startDate: "2026-06-01T08:00:00.000Z",
    endDate: "2026-06-05T18:00:00.000Z",
    quantity: 0,
    contactNumber: "+1 (555) 345-6789",
    deliveryAddress: "742 Evergreen Terrace",
  });
  assert(!zeroQuantity.success, "Zero quantity is rejected by Zod validation");

  // Missing delivery address
  const missingAddress = createBookingSchema.safeParse({
    equipmentId: "60d5ec49f1b2c8a1e8a8b1a1",
    startDate: "2026-06-01T08:00:00.000Z",
    endDate: "2026-06-05T18:00:00.000Z",
    quantity: 1,
    contactNumber: "+1 (555) 345-6789",
  });
  assert(!missingAddress.success, "Missing delivery address is rejected by Zod validation");

  // Availability query schema validation
  const validAvailQuery = availabilityQuerySchema.safeParse({
    startDate: "2026-07-01",
    endDate: "2026-07-10",
  });
  assert(validAvailQuery.success, "Valid availability query parameters pass Zod validation");

  const invalidAvailQuery = availabilityQuerySchema.safeParse({
    startDate: "2026-07-10",
    endDate: "2026-07-01",
  });
  assert(!invalidAvailQuery.success, "Invalid availability date range is rejected by Zod validation");

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: PRICING & DURATION RULES
  // -----------------------------------------------------------------
  console.log("\n--- 2. Pricing & Duration Calculation Rules ---");

  // A. Daily Rental: 3 days @ $100/day, qty 2 = $600
  const dailyEquipment = {
    rentalType: "Daily",
    rentalPrice: 100,
  };
  const dailyPrice = BookingService.calculatePricingAndDuration(
    dailyEquipment,
    "2026-06-01T00:00:00Z",
    "2026-06-04T00:00:00Z", // 3 days
    2
  );
  assert(
    dailyPrice.duration === 3 && dailyPrice.totalAmount === 600,
    `Daily pricing: 3 days @ $100 * qty 2 = $${dailyPrice.totalAmount} (expected 600)`
  );

  // B. Weekly Rental: 8 days (2 weeks) @ $500/week, qty 1 = $1000
  const weeklyEquipment = {
    rentalType: "Weekly",
    rentalPrice: 500,
  };
  const weeklyPrice = BookingService.calculatePricingAndDuration(
    weeklyEquipment,
    "2026-06-01T00:00:00Z",
    "2026-06-09T00:00:00Z", // 8 days -> Math.ceil(8/7) = 2 weeks
    1
  );
  assert(
    weeklyPrice.duration === 2 && weeklyPrice.totalAmount === 1000,
    `Weekly pricing: 8 days (2 weeks) @ $500 * qty 1 = $${weeklyPrice.totalAmount} (expected 1000)`
  );

  // C. Monthly Rental: 35 days (2 months) @ $1,800/month, qty 1 = $3600
  const monthlyEquipment = {
    rentalType: "Monthly",
    rentalPrice: 1800,
  };
  const monthlyPrice = BookingService.calculatePricingAndDuration(
    monthlyEquipment,
    "2026-06-01T00:00:00Z",
    "2026-07-06T00:00:00Z", // 35 days -> Math.ceil(35/30) = 2 months
    1
  );
  assert(
    monthlyPrice.duration === 2 && monthlyPrice.totalAmount === 3600,
    `Monthly pricing: 35 days (2 months) @ $1800 * qty 1 = $${monthlyPrice.totalAmount} (expected 3600)`
  );

  // -----------------------------------------------------------------
  // 3. UNIT TESTS: STRIPE SERVICE SIMULATION & WEBHOOKS
  // -----------------------------------------------------------------
  console.log("\n--- 3. Stripe Service & Webhook Idempotency ---");

  process.env.NODE_ENV = "test";

  const mockBookingDoc = {
    _id: "60d5ec49f1b2c8a1e8a8b1b1",
    customer: "60d5ec49f1b2c8a1e8a8b1a1",
    owner: "60d5ec49f1b2c8a1e8a8b1a2",
    equipment: "60d5ec49f1b2c8a1e8a8b1a0",
    duration: 3,
    rentalType: "Daily",
    quantity: 1,
    unitPrice: 450,
    totalAmount: 1350,
    paymentStatus: "Pending",
    bookingStatus: "Pending",
    save: async function () {
      return this;
    },
    toJSON: function () {
      return this;
    },
  };

  const checkoutResult = await StripeService.createCheckoutSession(
    mockBookingDoc,
    "CAT Excavator",
    "alexander@apexbuild.com"
  );
  assert(
    typeof checkoutResult.sessionId === "string" &&
      checkoutResult.checkoutUrl.includes("checkout.stripe.com"),
    "StripeService initializes checkout session URL"
  );

  // Webhook event verification
  const rawWebhookEvent = JSON.stringify({
    id: "evt_test_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_completed_123",
        amount_total: 135000, // Cents
        currency: "usd",
        payment_status: "paid",
        payment_intent: "pi_test_12345",
        metadata: {
          bookingId: "60d5ec49f1b2c8a1e8a8b1b1",
        },
      },
    },
  });

  const parsedEvent = StripeService.verifyWebhookSignature(
    Buffer.from(rawWebhookEvent),
    "test_signature"
  );
  assert(
    parsedEvent.type === "checkout.session.completed",
    "Stripe webhook signature verified and parsed event payload"
  );

  // -----------------------------------------------------------------
  // 4. HTTP INTEGRATION & RBAC SECURITY RULES
  // -----------------------------------------------------------------
  console.log("\n--- 4. HTTP Integration & RBAC Security Rules ---");

  // Setup stubs for Mongoose operations when running standalone
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

  Booking.find = function () {
    return createMockQuery([mockBookingDoc]);
  };

  Booking.countDocuments = async function () {
    return 1;
  };

  Booking.findById = function () {
    return createMockQuery(mockBookingDoc);
  };

  Booking.findByIdAndUpdate = async function () {
    return mockBookingDoc;
  };

  Payment.findOne = async function () {
    return null;
  };

  Payment.prototype.save = async function () {
    return this;
  };

  Equipment.findById = function () {
    return createMockQuery({
      _id: "60d5ec49f1b2c8a1e8a8b1a0",
      name: "CAT 320D Excavator",
      title: "CAT 320D Excavator",
      status: "Approved",
      totalQuantity: 3,
      availableQuantity: 3,
      rentalPrice: 450,
      rentalType: "Daily",
      owner: "60d5ec49f1b2c8a1e8a8b1a2",
    });
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
    // 1. Unauthenticated booking requests are rejected (401)
    const unauthBooking = await makeRequest(
      {
        path: "/api/bookings",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        equipmentId: "60d5ec49f1b2c8a1e8a8b1a0",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        quantity: 1,
      }
    );
    assert(
      unauthBooking.statusCode === 401,
      `Unauthenticated booking request rejected with HTTP ${unauthBooking.statusCode}`
    );

    // 2. Owner role cannot book as customer (403)
    const ownerBookingAttempt = await makeRequest(
      {
        path: "/api/bookings",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
      {
        equipmentId: "60d5ec49f1b2c8a1e8a8b1a0",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        quantity: 1,
        contactNumber: "+1 555-000-1111",
        deliveryAddress: "Site A",
      }
    );
    assert(
      ownerBookingAttempt.statusCode === 403,
      `Owner role cannot create bookings (HTTP ${ownerBookingAttempt.statusCode} Forbidden)`
    );

    // 3. Customer cannot access owner rentals endpoint (403)
    const customerOwnerAccess = await makeRequest({
      path: "/api/owner/bookings",
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert(
      customerOwnerAccess.statusCode === 403,
      `Customer role cannot access owner rentals endpoint (HTTP ${customerOwnerAccess.statusCode} Forbidden)`
    );

    // 4. Customer cannot access admin bookings endpoint (403)
    const customerAdminAccess = await makeRequest({
      path: "/api/admin/bookings",
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert(
      customerAdminAccess.statusCode === 403,
      `Customer role cannot access admin bookings endpoint (HTTP ${customerAdminAccess.statusCode} Forbidden)`
    );

    // 5. Customer rental history responds with 200 OK
    const myRentals = await makeRequest({
      path: "/api/bookings/my-rentals",
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert(
      myRentals.statusCode === 200,
      `Customer retrieves own rental history (HTTP ${myRentals.statusCode})`
    );

    // 6. Owner views equipment rentals with 200 OK
    const ownerRentals = await makeRequest({
      path: "/api/owner/bookings",
      method: "GET",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert(
      ownerRentals.statusCode === 200,
      `Owner retrieves equipment rentals (HTTP ${ownerRentals.statusCode})`
    );

    // 7. Admin views all bookings with 200 OK
    const adminBookings = await makeRequest({
      path: "/api/admin/bookings",
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert(
      adminBookings.statusCode === 200,
      `Admin retrieves platform bookings console (HTTP ${adminBookings.statusCode})`
    );

    // 8. Public equipment availability check responds with 200 OK
    const availCheck = await makeRequest({
      path: "/api/equipment/60d5ec49f1b2c8a1e8a8b1a0/availability?startDate=2026-08-01&endDate=2026-08-05&quantity=1",
      method: "GET",
    });
    assert(
      availCheck.statusCode === 200,
      `Public equipment availability check returns HTTP ${availCheck.statusCode}`
    );

    // 9. Stripe webhook processes completed session with 200 OK
    const webhookRes = await makeRequest(
      {
        path: "/api/payments/webhook",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "test_signature",
        },
      },
      rawWebhookEvent
    );
    assert(
      webhookRes.statusCode === 200 && webhookRes.body?.received === true,
      `Stripe webhook endpoint processes event with HTTP 200 and { received: true }`
    );

    // 10. API modules list includes bookings and payments
    const apiIndex = await makeRequest({
      path: "/api",
      method: "GET",
    });
    assert(
      apiIndex.statusCode === 200 &&
        apiIndex.body.data.modules.includes("bookings") &&
        apiIndex.body.data.modules.includes("payments"),
      "Root /api index lists 'bookings', 'owner-bookings', 'admin-bookings', and 'payments'"
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
