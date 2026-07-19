import db from "../database/database.js"; // your mysql2/promise pool
import path from "path";
import fs from "fs";
import { createNotificationForStudents } from "./notificationController.js";

// Controller for creating announcement
export const createAnnouncement = async (req, res) => {
    try {
        console.log("REQ BODY:", req.body);
        console.log("REQ FILE:", req.file);

        // Get logged-in user info from JWT middleware
        const user_id = req.user?.id;
        const role_id = req.user?.role_id; // make sure verifyToken sets this
        if (!user_id || !role_id) {
            return res.status(401).json({ message: "Unauthorized: no user info found" });
        }

        const { title, description, category, author } = req.body;

        if (!title || !description || !category) {
            return res.status(400).json({ message: "Title, description, category, and author are required" });
        }

        let file_name = null;
        let file_path = null;

        if (req.file) {
            file_name = req.file.originalname;
            file_path = req.file.filename;
        }

        // Determine approval status based on role
        const approval_status = role_id === 3 ? 'Approved' : 'Pending';
        const status = 'Active';

        const sql = `
            INSERT INTO announcement
            (user_id, title, category, author, description, file_name, file_path, approval_status, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(sql, [
            user_id,
            title,
            category,
            author,
            description,
            file_name,
            file_path,
            approval_status,
            status,
        ]);

        console.log("DB result:", result);

        return res.status(200).json({
            message: "Announcement successfully created!",
            announcement_id: result.insertId,
            approval_status, // optionally return status to frontend
        });

    } catch (err) {
        console.error("FULL ERROR:", err);

        // Remove uploaded file if DB insert fails
        if (req.file) {
            const fileFullPath = path.join(process.cwd(), "uploads/announcements", req.file.filename);
            if (fs.existsSync(fileFullPath)) fs.unlinkSync(fileFullPath);
        }

        return res.status(500).json({
            message: "Server error while creating announcement",
            error: err.message,
        });
    }
};


// Fetch only approved announcements
export const getApprovedAnnouncements = async (req, res) => {
    try {
        const sql = `
            SELECT announcement_id, title, category, author, description, status, approval_status, created_at 
            FROM announcement 
            WHERE approval_status = 'Approved'
              AND (status IS NULL OR LOWER(status) != 'archived')
            ORDER BY created_at DESC
        `;

        const [rows] = await db.query(sql);

        return res.status(200).json(rows);
    } catch (err) {
        console.error("ERROR FETCHING APPROVED ANNOUNCEMENTS:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAnnouncementCategories = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, category_name, description, created_at
             FROM announcement_category
             ORDER BY category_name ASC`
        );

        return res.status(200).json(rows);
    } catch (err) {
        console.error("ERROR FETCHING ANNOUNCEMENT CATEGORIES:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ---------------------------
// NEW: Fetch Approved OR Pending
// ---------------------------
export const getApprovedOrPendingAnnouncements = async (req, res) => {
    try {
        const user_id = req.user?.id;
        const role_id = req.user?.role_id;

        if (!user_id || !role_id) {
            return res.status(401).json({ message: "Unauthorized: no user info found" });
        }

        let sql = `
            SELECT announcement_id, title, category, author, status, description, file_name, file_path, approval_status, created_at
            FROM announcement
        `;
        let params = [];

        if (role_id !== 3) {
            // Normal user → only their own announcements
            sql += ` WHERE user_id = ?`;
            params.push(user_id);
        } else {
            // Admin → sees all announcements
            sql += ` WHERE 1=1`; // effectively no filter
        }

        // Only include active, non-archived announcements for management views
        sql += ` AND approval_status IN ('Approved', 'Rejected')`;
        sql += ` AND (status IS NULL OR LOWER(status) != 'archived')`;

        // Order by newest first
        sql += ` ORDER BY created_at DESC`;

        const [rows] = await db.query(sql, params);

        return res.status(200).json(rows);
    } catch (err) {
        console.error("ERROR FETCHING ANNOUNCEMENTS:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT announcement_id, title, category, author, description, file_name, file_path, approval_status, status, created_at
      FROM announcement
      WHERE announcement_id = ?
    `;

    const [rows] = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const announcement = rows[0];

    // Optional: add a download URL for frontend
    if (announcement.file_path) {
      announcement.file_url = `/uploads/announcements/${announcement.file_path}`;
    }

    return res.json(announcement);
  } catch (err) {
    console.error("ERROR FETCHING ANNOUNCEMENT BY ID:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const approveAnnouncement = async (req, res) => {
  try {
    const { announcement_id } = req.params;
    const io = req.app.get("io"); // get the socket instance

    const sql = `UPDATE announcement SET status = 'approve' WHERE announcement_id = ? AND status != 'archive'`;
    await db.query(sql, [announcement_id]);

    // Create notifications and emit
    await createNotificationForStudents("Announcement", announcement_id, io);

    res.status(200).json({ message: "Announcement approved and notifications sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
