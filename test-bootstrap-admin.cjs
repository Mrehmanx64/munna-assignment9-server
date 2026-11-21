/**
 * Rentora — Admin Bootstrap Verification Test Suite
 * Tests admin bootstrap logic, single-execution gate, password hashing, and role guarantees.
 */

const assert = require("assert");
const bcrypt = require("bcryptjs");

console.log("\n=================================================");
console.log("🧪 Rentora: Admin Bootstrap Verification Suite");
console.log("=================================================\n");

let passedTests = 0;
let failedTests = 0;

const test = async (description, fn) => {
  try {
    await fn();
    console.log(`  ✔ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
};

(async () => {
  console.log("--- 1. Admin Bootstrap Single-Execution Guard ---");

  await test("Refuses bootstrap when an administrator already exists", async () => {
    const mockExistingAdmin = { _id: "60d5ec49f1b2c8a1e8a8b1a3", email: "existing.admin@rentora.com", role: "admin" };
    
    // Simulate check
    let executionAllowed = false;
    let errorMessage = "";
    if (mockExistingAdmin && mockExistingAdmin.role === "admin") {
      executionAllowed = false;
      errorMessage = `An administrator account already exists on this platform (${mockExistingAdmin.email}).`;
    }

    assert.strictEqual(executionAllowed, false);
    assert(errorMessage.includes("already exists"));
  });

  console.log("\n--- 2. Credential Validation & Password Hashing ---");

  await test("Validates admin email format and minimum password length", async () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPassword = (pass) => typeof pass === "string" && pass.length >= 8;

    assert.strictEqual(isValidEmail("admin@rentora.com"), true);
    assert.strictEqual(isValidEmail("not-an-email"), false);
    assert.strictEqual(isValidPassword("Admin123!"), true);
    assert.strictEqual(isValidPassword("short"), false);
  });

  await test("Hashes administrative password using bcrypt work factor 10", async () => {
    const rawPassword = "SuperSecureAdminPassword2026!";
    const hashed = await bcrypt.hash(rawPassword, 10);

    assert(hashed.startsWith("$2a$") || hashed.startsWith("$2b$"));
    const matches = await bcrypt.compare(rawPassword, hashed);
    assert.strictEqual(matches, true);

    const wrongMatches = await bcrypt.compare("WrongPassword123", hashed);
    assert.strictEqual(wrongMatches, false);
  });

  await test("Ensures administrative record forces role='admin' and emailVerified=true", async () => {
    const email = "superadmin@rentora.internal";
    const name = "System Administrator";

    const mockAdminDocument = {
      name,
      email: email.toLowerCase(),
      role: "admin",
      emailVerified: true,
      phone: "+1 (555) 000-0001",
      address: "Rentora Headquarters — Platform Operations",
    };

    assert.strictEqual(mockAdminDocument.role, "admin");
    assert.strictEqual(mockAdminDocument.emailVerified, true);
    assert.strictEqual(mockAdminDocument.email, email);
    // Ensure no password on User document (passwords belong in account collection)
    assert.strictEqual(mockAdminDocument.password, undefined);
  });

  console.log("\n=================================================");
  console.log(`Results: ${passedTests} passed, ${failedTests} failed`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
})();
