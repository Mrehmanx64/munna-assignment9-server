import readline from "readline";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models/userModel";

/**
 * Rentora — Secure One-Time Platform Administrator Bootstrap Script
 *
 * Requirements:
 * 1. CLI / Server-side script only (never exposed over HTTP/REST).
 * 2. Refuses execution if any administrator account already exists.
 * 3. Hashes password using bcrypt (matching BetterAuth & AuthService standards).
 * 4. Never logs plaintext passwords or sensitive secrets.
 * 5. Accepts credentials via environment variables or interactive prompt.
 */

// Helper to prompt interactively via readline
const promptUser = (query: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

const runBootstrap = async (): Promise<void> => {
  console.log(`
=============================================================
🔐 Rentora — One-Time Platform Administrator Bootstrap
=============================================================
`);

  try {
    // 1. Connect to MongoDB
    console.log("⏳ Connecting to database...");
    await connectDatabase();

    // 2. Security Gate: Verify no administrator already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.error(
        `❌ Bootstrap Aborted: An administrator account already exists on this platform (${existingAdmin.email}).`
      );
      console.error(
        "   For security reasons, this bootstrap script can only be executed on an uninitialized platform."
      );
      console.error(
        "   To manage roles on an active platform, log in with existing administrative credentials."
      );
      await disconnectDatabase();
      process.exit(1);
    }

    // 3. Obtain Credentials (Env Vars or Interactive Input)
    let email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
    let password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    let name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Platform Administrator";

    if (!email || !password) {
      if (process.stdin.isTTY) {
        console.log("ℹ️  Interactive mode detected. Please supply administrator credentials:\n");
        if (!name) {
          const promptedName = await promptUser("Enter Administrator Full Name [Platform Administrator]: ");
          if (promptedName) name = promptedName;
        }
        if (!email) {
          email = await promptUser("Enter Administrator Email: ");
        }
        if (!password) {
          password = await promptUser("Enter Administrator Password (min 8 chars): ");
        }
      } else {
        console.error("❌ Bootstrap Aborted: Missing required credentials.");
        console.error("   Please provide credentials via environment variables:");
        console.error("   BOOTSTRAP_ADMIN_EMAIL=admin@domain.com BOOTSTRAP_ADMIN_PASSWORD=SecurePass123! npm run bootstrap:admin");
        await disconnectDatabase();
        process.exit(1);
      }
    }

    // 4. Input Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("❌ Bootstrap Aborted: Invalid email address format.");
      await disconnectDatabase();
      process.exit(1);
    }

    if (!password || password.length < 8) {
      console.error("❌ Bootstrap Aborted: Password must be at least 8 characters long.");
      await disconnectDatabase();
      process.exit(1);
    }

    // 5. Ensure email is not already taken by a customer or owner
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.error(
        `❌ Bootstrap Aborted: A user account with email '${email}' already exists with role '${existingUser.role}'.`
      );
      await disconnectDatabase();
      process.exit(1);
    }

    // 6. Secure Password Hashing
    console.log("⏳ Hashing administrative credentials with bcrypt...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Create Admin User Record
    const adminUser = await User.create({
      name,
      email: email.toLowerCase(),
      role: "admin",
      emailVerified: true,
      phone: "+1 (555) 000-0001",
      address: "Rentora Headquarters — Platform Operations",
    });

    // 8. Create Credential Account Record in BetterAuth Collection
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("account").insertOne({
        userId: adminUser._id.toString(),
        accountId: adminUser._id.toString(),
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(`
=============================================================
✅ Initial Platform Administrator Provisioned Successfully
=============================================================
  🆔 User ID : ${adminUser._id.toString()}
  👤 Name    : ${adminUser.name}
  📧 Email   : ${adminUser.email}
  🛡️  Role    : admin
  ✅ Status  : Verified & Active
=============================================================
⚠️  Security Notice:
  - This script cannot be executed again.
  - Store your administrative credentials securely in your password manager.
=============================================================
`);

    await disconnectDatabase();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Fatal error during admin bootstrap:", err.message);
    try {
      await disconnectDatabase();
    } catch {
      // Ignore disconnect error
    }
    process.exit(1);
  }
};

// Execute bootstrap
runBootstrap();
