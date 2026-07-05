import db from "./database/database.js";
import bcrypt from "bcryptjs";
import "dotenv/config";

// Test admin credentials
const testAdmin = {
  firstname: "Test",
  lastname: "Admin",
  email: "testadmin@crimson.com",
  password: "Admin@12345",
  phone: "0000000000",
  department: "Administration",
  role_id: 3, // Admin role
  status: "Active"
};

async function createTestAdmin() {
  try {
    console.log("🔄 Creating test admin account...\n");

    // Check if email already exists
    const [existing] = await db.query(
      "SELECT * FROM user WHERE email = ?",
      [testAdmin.email]
    );

    if (existing.length > 0) {
      console.log("❌ Email already exists in database!");
      console.log("Existing account:", existing[0]);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(testAdmin.password, 10);

    // Insert admin into database
    await db.query(
      `INSERT INTO user 
      (firstname, lastname, email, phone, department, student_id, password, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testAdmin.firstname,
        testAdmin.lastname,
        testAdmin.email,
        testAdmin.phone,
        testAdmin.department,
        "",
        hashedPassword,
        testAdmin.role_id,
        testAdmin.status
      ]
    );

    console.log("✅ Test Admin Account Created Successfully!\n");
    console.log("═══════════════════════════════════════════");
    console.log("📧 EMAIL:    " + testAdmin.email);
    console.log("🔑 Admin created successfully. Please change the default password immediately.");
    console.log("═══════════════════════════════════════════\n");
    console.log("Login URL: http://localhost:5173/login");
    console.log("⚠️  Save these credentials - you'll need them to test the admin dashboard!\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin account:", err.message);
    process.exit(1);
  }
}

createTestAdmin();
