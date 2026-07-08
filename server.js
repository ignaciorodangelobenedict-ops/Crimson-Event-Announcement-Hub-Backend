import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import compression from "compression";
import cookieParser from "cookie-parser";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http"; // <-- add this
import { Server as SocketIOServer } from "socket.io"; // <-- add this
import db from "./database/database.js";

// --- Routes ---
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import eventRoutes from "./routes/event.js";
import adminRoutes from "./routes/admin.js";
import announcementRoutes from "./routes/announcement.js";
import pendingRouter from "./routes/pending.js";
import dashboardCountRoutes from "./routes/dashboardCounts.js";
import rejectedRouter from "./routes/rejected.js";
import notificationRouter from "./routes/notification.js";
import archiveRouter from "./routes/archive.js";
import categoryRoutes from "./routes/category.js";
import commentsRouter from "./routes/comments.js";
import { googleSignup } from "./auth/googleAuth.js";

const app = express();

// --- Security Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  // Allow cross-origin resource sharing for static assets (images) so
  // frontend apps hosted on a different origin can load them.
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// --- Middleware ---
app.use(cors({ 
  origin: process.env.FRONTEND_URL || "http://localhost:5173", 
  credentials: true 
}));
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message === "File type not allowed") {
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

// --- Static folders ---
// Add lightweight CORS headers specifically for static upload routes
const uploadCors = (req, res, next) => {
  const origin = process.env.FRONTEND_URL || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
};

app.use("/uploads/profiles", uploadCors, express.static(path.join(path.resolve(), "uploads/profiles")));
app.use("/uploads/events", uploadCors, express.static(path.join(path.resolve(), "uploads/events")));
app.use("/uploads/announcements", uploadCors, express.static(path.join(path.resolve(), "uploads/announcements")));

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/pending", pendingRouter);
app.use("/api/rejected", rejectedRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/archived", archiveRouter);
app.use("/api/categories", categoryRoutes);
app.use("/api/comments", commentsRouter);
app.use("/api", dashboardCountRoutes);
app.post("/auth/google/signup", googleSignup);

// Health check route for deployment platforms (keeps it lightweight)
app.get("/", async (req, res) => {
  try {
    // quick DB check
    await db.query("SELECT 1");
    return res.status(200).json({ status: "ok", db: "connected", uptime: process.uptime() });
  } catch (err) {
    return res.status(200).json({ status: "ok", db: "unreachable", error: err.message });
  }
});

// --- Create HTTP server for Socket.IO ---
const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// --- Socket.IO connection ---
io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join", (userId) => {
        if (userId) {
            socket.join(userId.toString());
            console.log(`Socket ${socket.id} joined room ${userId}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Make io globally accessible (so controllers can emit)
app.set("io", io);

// --- Start server ---
const PORT = process.env.PORT || 5100;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the server at http://localhost:${PORT}`);
});
