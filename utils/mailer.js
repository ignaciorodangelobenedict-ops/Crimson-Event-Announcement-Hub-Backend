import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(to, subject, message) {
  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    html: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to:", to);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("❌ Error sending email:", {
      to,
      from: process.env.SENDER_EMAIL,
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: error.message,
      stack: error.stack,
    };
  }
}

// Diagnostic function to test email service
export async function testEmailService() {
  console.log("🔍 Testing SMTP email configuration...");

  const smtpHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const smtpUserConfigured = !!process.env.SMTP_USER;
  const smtpPasswordConfigured = !!process.env.SMTP_PASSWORD;
  const senderEmail = process.env.SENDER_EMAIL;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUserConfigured,
    smtpPasswordConfigured,
    senderEmailConfigured: !!senderEmail,
    senderEmail,
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    console.log("🔧 Verifying SMTP transporter...");
    await transporter.verify();

    const testMsg = {
      from: senderEmail,
      to: senderEmail,
      subject: "Brevo SMTP Test Email",
      html: `<h2>Brevo SMTP Configuration Test</h2><p>If you received this, your email service is working!</p><p>Time: ${new Date().toISOString()}</p>`,
    };

    console.log("📧 Attempting to send test email...");
    await transporter.sendMail(testMsg);

    diagnostics.emailSendTest = {
      success: true,
      message: "Test email sent successfully",
    };
    console.log("✅ Test email sent successfully!");
  } catch (error) {
    diagnostics.emailSendTest = {
      success: false,
      message: error.message,
      stack: error.stack,
    };
    console.error("❌ Test email failed:", error.message);
  }

  return diagnostics;
}
