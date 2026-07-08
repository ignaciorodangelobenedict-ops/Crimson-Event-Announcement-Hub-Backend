import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

import {
    getUserNotifications,
    getNotificationDetails,
    deleteNotification,
    markNotificationRead,
    markAllNotificationsRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", verifyToken, getUserNotifications);
router.get("/:id", verifyToken, getNotificationDetails);
router.put("/read/:id", verifyToken, markNotificationRead);
router.put("/read-all", verifyToken, markAllNotificationsRead);
router.delete("/:id", verifyToken, deleteNotification);

export default router;
