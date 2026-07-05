import db from "../database/database.js"; 
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mailer.js"; // adjust path if needed
import { body, validationResult } from "express-validator";

// Validation rules
const signupValidation = [
  body('firstname').isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastname').isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('department').optional().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('role_id').isIn(['1', '2']).withMessage('Invalid role'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
];

const resetPasswordValidation = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      firstname,
      lastname,
      email,
      phone,
      department,
      password,
      role_id,
      student_id
    } = req.body;

    // ✅ Required fields check
    if (!firstname || !lastname || !email || !password)
      return res.status(400).json({ msg: "All fields required" });

    // ✅ Check if email exists
    const [existing] = await db.query(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );
    if (existing.length > 0)
      return res.status(400).json({ msg: "Email already in use" });

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Determine role and status logic
    const actualRole = role_id === "2" ? null : role_id;
    const status = role_id === "2" ? "Pending" : "Active";
    const applyingFor = role_id === "2" ? "Organizer" : null;

    // ✅ Insert user into DB
    await db.query(
      `INSERT INTO user 
      (firstname, lastname, email, phone, department, student_id, password, role_id, status, applying_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstname,
        lastname,
        email,
        phone,
        department,
        student_id || "",
        hashedPassword,
        actualRole,
        status,
        applyingFor
      ]
    );

    // ✅ Send email notification
    try {
      let emailResult;
      if (role_id === "2") {
        // Organizer application
        emailResult = await sendEmail(
          email,
          "Organizer Application Received",
          `<h1>Hello ${firstname}!</h1>
           <p>Your application to become an Organizer has been received.</p>
           <p>Waiting for admin approval.</p>`
        );
        console.log("📧 Organizer signup email result:", emailResult);
      } else {
        // Regular signup
        emailResult = await sendEmail(
          email,
          "Welcome to Our System",
          `<h1>Welcome ${firstname}!</h1>
           <p>Your account has been successfully created and is now active.</p>`
        );
        console.log("📧 User signup email result:", emailResult);
      }
      
      if (!emailResult.success) {
        console.warn("⚠️ Email sending failed:", emailResult);
      }
    } catch (err) {
      console.error("❌ Failed to send signup email:", err);
      // Note: We do not fail signup if email fails
    }

    // ✅ Return response
    const message =
      role_id === "2"
        ? "Organizer application received. Waiting for admin approval."
        : "Signup successful.";

    return res.json({ msg: message });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};


// Login
export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ msg: "Email and password required" });

  try {
    const [results] = await db.query("SELECT * FROM user WHERE email = ?", [email]);
    if (results.length === 0)
      return res.status(400).json({ msg: "User not found" });

    const user = results[0];

    // 🔴 Banned check
    if (user.status === "banned") {
      return res.status(403).json({ msg: "Your account has been banned." });
    }

    // 🔍 Password verification
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    // ⏳ Optional inactivity check/update
    await db.query(
      "UPDATE user SET last_active = NOW() WHERE user_id = ?",
      [user.user_id]
    );

    // ⭐ Issue token with role_id included
    const token = jwt.sign(
      { id: user.user_id, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        status: user.status,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: "Email is required" });
  }

  try {
    // Check if user exists
    const [results] = await db.query("SELECT * FROM user WHERE email = ?", [email]);
    if (results.length === 0) {
      return res.status(400).json({ msg: "Email not found in our system" });
    }

    const user = results[0];

    // Generate a reset token that expires in 1 hour
    const resetToken = jwt.sign(
      { id: user.user_id, email: user.email },
      process.env.JWT_RESET_SECRET || process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Send email with reset link
    try {
      await sendEmail(
        email,
        "Password Reset Request",
        `<h2>Password Reset Request</h2>
         <p>Hi ${user.firstname},</p>
         <p>We received a request to reset your password. Click the link below to proceed:</p>
         <p><a href="${resetLink}" style="background-color: #C8102E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
         <p>This link will expire in 1 hour.</p>
         <p>If you didn't request this, you can safely ignore this email.</p>`
      );

      return res.json({ msg: "Password reset link has been sent to your email" });
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      return res.status(500).json({ msg: "Failed to send reset email" });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ msg: "Token and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ msg: "Password must be at least 6 characters" });
  }

  try {
    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET || process.env.JWT_SECRET);
    const userId = decoded.id;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password in database
    await db.query(
      "UPDATE user SET password = ? WHERE user_id = ?",
      [hashedPassword, userId]
    );

    // Send confirmation email
    try {
      const [userResult] = await db.query(
        "SELECT email, firstname FROM user WHERE user_id = ?",
        [userId]
      );

      if (userResult.length > 0) {
        await sendEmail(
          userResult[0].email,
          "Password Reset Successful",
          `<h2>Password Reset Confirmation</h2>
           <p>Hi ${userResult[0].firstname},</p>
           <p>Your password has been successfully reset.</p>
           <p>If you didn't request this change, please contact support immediately.</p>`
        );
      }
    } catch (emailErr) {
      console.error("Confirmation email error:", emailErr);
      // Don't fail the password reset if email fails
    }

    return res.json({ msg: "Password reset successfully" });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ msg: "Reset link has expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({ msg: "Invalid reset link" });
    }
    console.error("Reset password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
