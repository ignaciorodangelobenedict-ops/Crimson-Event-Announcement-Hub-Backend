import express from "express";
import announcementUpload from "../middleware/announcementUpload.js";
import { 
  createAnnouncement, 
  getApprovedAnnouncements,
  getApprovedOrPendingAnnouncements, 
  getAnnouncementById,
  approveAnnouncement,
  getAnnouncementCategories
} from "../controllers/announcementController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create announcement
router.post(
    "/create",
    verifyToken,
    announcementUpload.single("attachment"),
    createAnnouncement
);

// Fetch approved announcements
router.get("/approved", getApprovedAnnouncements);

// Fetch announcement categories from announcement_category table
router.get("/categories", getAnnouncementCategories);

// Fetch approved OR pending announcements
router.get("/", verifyToken, getApprovedOrPendingAnnouncements);

// Approve announcement (Admin / Organizer)
router.put("/approve/:announcement_id", verifyToken, approveAnnouncement);

// Fetch single announcement
router.get("/:id", verifyToken, getAnnouncementById);

export default router;
