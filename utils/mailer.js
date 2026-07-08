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
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
  },
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT) || 20000,
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT) || 20000,
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT) || 20000,
  logger: process.env.SMTP_DEBUG === "true",
  debug: process.env.SMTP_DEBUG === "true",
});

async function sendViaBrevoApi(to, subject, message) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Crimson Event Hub",
        email: senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: message,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Brevo API request failed with status ${response.status}`);
  }

  return {
    success: true,
    message: "Email sent successfully via Brevo API",
    details: data,
  };
}

export async function sendEmail(to, subject, message) {
  const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER;

  try {
    if (process.env.BREVO_API_KEY) {
      const result = await sendViaBrevoApi(to, subject, message);
      console.log("✅ Email sent successfully via Brevo API to:", to);
      return result;
    }

    const mailOptions = {
      from: senderEmail,
      to,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to:", to);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("❌ Error sending email:", {
      to,
      from: senderEmail,
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
  console.log("🔍 Testing email configuration...");

  const smtpHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const smtpUserConfigured = !!process.env.SMTP_USER;
  const smtpPasswordConfigured = !!process.env.SMTP_PASSWORD;
  const brevoApiConfigured = !!process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    deliveryMethod: brevoApiConfigured ? "brevo-api" : "smtp",
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUserConfigured,
    smtpPasswordConfigured,
    brevoApiConfigured,
    senderEmailConfigured: !!senderEmail,
    senderEmail,
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    if (brevoApiConfigured) {
      console.log("📧 Attempting to send test email via Brevo API...");
      const result = await sendViaBrevoApi(senderEmail, "Brevo API Test Email", `<h2>Brevo API Configuration Test</h2><p>If you received this, your email service is working!</p><p>Time: ${new Date().toISOString()}</p>`);
      diagnostics.emailSendTest = {
        success: true,
        message: result.message,
        details: result.details,
      };
      console.log("✅ Test email sent successfully via Brevo API!");
    } else {
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
    }
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
