import jwt from "jsonwebtoken";
import db from "../database/database.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleSignup = async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({
      success: false,
      message: "Missing Google credential in request body.",
    });
  }

  try {
    // Step 1: Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const google_id = payload.sub;
    const firstname = payload.given_name;
    const lastname = payload.family_name;
    const email = payload.email;
    const profile_image = payload.picture.replace("s96-c", "s200-c");

    // Safety check
    if (!google_id || !email) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token. Could not extract user information.",
      });
    }

    // Step 2: Check if user already exists (CRITICAL: Search by google_id OR email)
    const [existing] = await db.query(
      "SELECT * FROM user WHERE google_id = ? OR email = ?",
      [google_id, email]
    );

    let user;
    let message;

    if (existing.length > 0) {
      // ⭐ LOGIN/LINK: User exists
      user = existing[0];

      if (user.status === "banned") {
        return res.status(403).json({
        success: false,
        message: "Your account has been banned. Access denied."
        });
    }

      message = "Login successful";

      await db.query(
        "UPDATE user SET last_active = NOW() WHERE user_id = ?",
        [user.user_id]
      );


      // CRITICAL LINKING: If the user exists by email but not by google_id, update their record
      // This links their existing local account to their Google account.
      if (!user.google_id) {
        await db.query("UPDATE user SET google_id = ? WHERE user_id = ?", [
          google_id,
          user.user_id,
        ]);
        // Update the local object for JWT generation
        user.google_id = google_id; 
      }
    } else {
      // ⭐ SIGNUP: Create new user using Google data
      message = "Signup successful";

      const [result] = await db.query(
        `INSERT INTO user 
          (google_id, role_id, firstname, lastname, email, profile_image, picture, student_id, birthday, gender, year_level, course, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          google_id,
          1, // default role_id (e.g., 3 = student)
          firstname,
          lastname,
          email,
          profile_image,
          profile_image || null,
          null,
          null,
          null,
          null,
          null,
          "active"
        ]
      );

      // Construct the full user object for the response
      user = {
        user_id: result.insertId,
        google_id,
        firstname,
        lastname,
        email,
        profile_image,
        role_id: 1,
        status: "active",
      };
    }

    // Step 3: Generate JWT token
    const token = jwt.sign(
      { id: user.user_id, email: user.email, role: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Step 4: Send success response
    res.json({
      success: true,
      message,
      user,
      token
    });

  } catch (err) {
    // Distinguish between token verification errors (401) and server errors (500)
    let statusCode = 500;
    let errorMessage = "Authentication failed. An internal error occurred.";

    if (err.message.includes("Invalid token") || err.message.includes("idToken must be a string") || err.message.includes("Token used too late")) {
      statusCode = 401; // Unauthorized
      errorMessage = "Google token is invalid or expired. Please try again.";
    } else if (err.code === 'ER_DUP_ENTRY') {
      // Example check for database unique constraint violation
      statusCode = 409; 
      errorMessage = "Conflict: User already exists with this email or ID.";
    }

    console.error(`Google Signup Error (${statusCode}):`, err);
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};