#!/usr/bin/env node
/**
 * Database Connection Verification Script
 * Run this to verify your PostgreSQL connection before starting the backend
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

console.log("🔐 GeoSecure Database Connection Test\n");
console.log("Environment Configuration:");
console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"}`);
console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
console.log(`  PORT: ${process.env.PORT || 3000}\n`);

const connectionString = `${process.env.DATABASE_URL}`;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in .env file");
  process.exit(1);
}

try {
  console.log("Connecting to PostgreSQL Database...");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  // Test connection
  await prisma.$queryRaw`SELECT 1`;
  console.log("✅ Database connection successful!\n");

  // Check user table
  const userCount = await prisma.user.count();
  console.log(`✅ User table exists. Current users: ${userCount}\n`);

  console.log("═══════════════════════════════════════");
  console.log("✨ All systems ready!");
  console.log("═══════════════════════════════════════");
  console.log("\nYou can now start the backend with: npm run dev");

  await prisma.$disconnect();
} catch (error) {
  console.error("❌ Connection Error:", error.message);
  console.error("\nTroubleshooting:");
  console.error("1. Verify DATABASE_URL in .env is correct");
  console.error("2. Check if PostgreSQL database is accessible");
  console.error("3. Ensure all migrations have been applied: npx prisma migrate deploy");
  process.exit(1);
}
