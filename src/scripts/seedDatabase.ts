import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/userModel";
import { Equipment } from "../models/equipmentModel";

export const seedDatabase = async () => {
  // 1. Strict Production Guard: Database seeding is forbidden in production
  if (env.NODE_ENV === "production" || process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL: Database seeding is strictly disabled in production environments.");
    throw new Error("Database seeding is prohibited when NODE_ENV=production");
  }

  // 2. Require explicit development seed credentials via environment variables
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const seedOwnerEmail = process.env.SEED_OWNER_EMAIL?.trim();
  const seedOwnerPassword = process.env.SEED_OWNER_PASSWORD?.trim();
  const seedCustomerEmail = process.env.SEED_CUSTOMER_EMAIL?.trim();
  const seedCustomerPassword = process.env.SEED_CUSTOMER_PASSWORD?.trim();

  if (!seedAdminEmail || !seedAdminPassword) {
    console.error("❌ Seeding Aborted: Explicit development seed credentials are required.");
    console.error("   Please provide SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in development environment.");
    throw new Error("Missing required seed credentials: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be defined.");
  }

  console.log("⏳ Connecting to MongoDB Atlas:", env.MONGODB_URI.replace(/:([^@]+)@/, ":****@"));
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  // 3. Prepare users to seed using explicit environment variables only
  const usersToSeed: Array<{
    name: string;
    email: string;
    password: string;
    role: "admin" | "customer" | "owner";
    avatarUrl: string;
    phone: string;
    address: string;
    emailVerified: boolean;
  }> = [
    {
      name: "Platform Administrator",
      email: seedAdminEmail,
      password: seedAdminPassword,
      role: "admin",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
      phone: "+1 (555) 901-2345",
      address: "Rentora HQ, 100 Pine Street, San Francisco, CA",
      emailVerified: true,
    },
  ];

  if (seedOwnerEmail && seedOwnerPassword) {
    usersToSeed.push({
      name: "Marcus Vance",
      email: seedOwnerEmail,
      password: seedOwnerPassword,
      role: "owner",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      phone: "+1 (555) 876-5432",
      address: "1850 Industrial Parkway, Oakland, CA 94607",
      emailVerified: true,
    });
  }

  if (seedCustomerEmail && seedCustomerPassword) {
    usersToSeed.push({
      name: "Alexander Hayes",
      email: seedCustomerEmail,
      password: seedCustomerPassword,
      role: "customer",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      phone: "+1 (555) 234-5678",
      address: "742 Montgomery St, San Francisco, CA 94111",
      emailVerified: true,
    });
  }

  const seededUsers: Record<string, any> = {};

  for (const u of usersToSeed) {
    let userDoc = await User.findOne({ email: u.email });
    if (!userDoc) {
      userDoc = await User.create({
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        phone: u.phone,
        address: u.address,
        emailVerified: u.emailVerified,
      });
      console.log(`✅ Created user: ${u.email} (${u.role})`);
    } else {
      console.log(`ℹ️ User already exists: ${u.email} — preserving existing role and security profile.`);
      // Security: NEVER automatically promote existing accounts to Admin
      // Security: NEVER overwrite existing user passwords
    }
    seededUsers[u.role] = userDoc;

    // Ensure BetterAuth account entry exists with password only if no account exists
    const existingAccount = await db.collection("account").findOne({ userId: userDoc._id.toString() });
    if (!existingAccount) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await db.collection("account").insertOne({
        userId: userDoc._id.toString(),
        accountId: userDoc.email,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`  🔑 Created credential auth record for ${u.email}`);
    } else {
      console.log(`  🔒 Preserved existing authentication record for ${u.email}`);
    }
  }

  // 2. Seed Equipment
  const owner = seededUsers["owner"];
  const equipmentCount = await Equipment.countDocuments();

  if (equipmentCount === 0 && owner) {
    const sampleEquipment = [
      {
        name: "CAT 320 GC Hydraulic Excavator",
        title: "CAT 320 GC Hydraulic Excavator",
        slug: "cat-320-gc-hydraulic-excavator",
        description: "Standard-tail swing excavator engineered for high production earthmoving, deep trenching, and civil utility construction. Equipped with Grade Assist, Cat Payload weighing system, and an ultra-quiet pressurized ROPS cab with touch display.",
        category: "Construction Equipment",
        location: "Oakland Yard, CA",
        rentalPrice: 650,
        rentalType: "Daily",
        availableQuantity: 3,
        totalQuantity: 4,
        condition: "Excellent",
        brand: "Caterpillar",
        model: "320 GC",
        imageUrl: "https://images.unsplash.com/photo-1768085091650-e8e89ef57b76?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0",
        images: [
          "https://images.unsplash.com/photo-1768085091650-e8e89ef57b76?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0",
          "https://images.unsplash.com/photo-1779285756094-85ddc78ead65?q=80&w=1356&auto=format&fit=crop&ixlib=rb-4.1.0"
        ],
        rentalTerms: "Valid commercial contractor license required. Fuel replacement fee applies if returned below initial tank level.",
        owner: owner._id,
        status: "Approved",
        featured: true,
      },
      {
        name: "ARRI ALEXA Mini LF Cinema Production Kit",
        title: "ARRI ALEXA Mini LF Cinema Production Kit",
        slug: "arri-alexa-mini-lf-cinema-kit",
        description: "Large-format 4.5K ARRI sensor paired with robust carbon-fiber housing. Delivers natural skin tones, high dynamic range (>14 stops), and clean low-light rendition for feature productions and commercials.",
        category: "Photography Equipment",
        location: "Burbank Studios, CA",
        rentalPrice: 920,
        rentalType: "Daily",
        availableQuantity: 2,
        totalQuantity: 2,
        condition: "Like New",
        brand: "ARRI",
        model: "ALEXA Mini LF",
        imageUrl: "https://images.unsplash.com/photo-1607276159787-9ef4db5c0d0b?q=80&w=765&auto=format&fit=crop&ixlib=rb-4.1.0",
        images: [
          "https://images.unsplash.com/photo-1607276159787-9ef4db5c0d0b?q=80&w=765&auto=format&fit=crop&ixlib=rb-4.1.0",
          "https://images.unsplash.com/photo-1497015289639-54688650d173?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0"
        ],
        rentalTerms: "Production insurance certificate required prior to dispatch. Must be handled by certified camera technician.",
        owner: owner._id,
        status: "Approved",
        featured: true,
      },
      {
        name: "Generac Mega-Watt Mobile Power Generator",
        title: "Generac Mega-Watt Mobile Power Generator",
        slug: "generac-mega-watt-mobile-power-generator",
        description: "Heavy-duty trailer-mounted sound attenuated tier 4 diesel generator for municipal grid support, construction job sites, and large-scale industrial events.",
        category: "Electronics",
        location: "San Jose, CA",
        rentalPrice: 420,
        rentalType: "Daily",
        availableQuantity: 4,
        totalQuantity: 5,
        condition: "Excellent",
        brand: "Generac",
        model: "MMW350",
        imageUrl: "https://images.unsplash.com/photo-1780445392484-38a4852a1fd8?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0",
        images: [
          "https://images.unsplash.com/photo-1780445392484-38a4852a1fd8?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0"
        ],
        rentalTerms: "Daily fluid level inspections required. Delivered with 100% full diesel tank.",
        owner: owner._id,
        status: "Approved",
        featured: false,
      }
    ];

    await Equipment.insertMany(sampleEquipment);
    console.log(`✅ Seeded ${sampleEquipment.length} approved equipment items!`);
  } else {
    console.log(`ℹ️ Equipment collection already has ${equipmentCount} items.`);
  }

  console.log("🎉 Database seeding completed successfully!");
  await mongoose.disconnect();
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}
