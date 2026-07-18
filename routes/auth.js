import express from "express";
import { signup, login, forgotPassword, resetPassword, sendEmailVerificationCode, sendMfaVerificationCode, verifyMfaCode } from "../controllers/authController.js";
import { testEmailService } from "../utils/mailer.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/send-verification-code", sendEmailVerificationCode);
router.post("/send-mfa-code", sendMfaVerificationCode);
router.post("/verify-mfa-code", verifyMfaCode);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// 🧪 TEST ENDPOINT - Test email service
router.get("/test-email", async (req, res) => {
  try {
    console.log("📧 Email diagnostic test requested...");
    const diagnostics = await testEmailService();
    
    return res.json({
      success: true,
      message: "Email service diagnostic complete",
      diagnostics
    });
  } catch (error) {
    console.error("Diagnostic test error:", error);
    return res.status(500).json({
      success: false,
      message: "Diagnostic test failed",
      error: error.message
    });
  }
});

export default router;
