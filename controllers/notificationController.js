import db from "../database/database.js";

// Get all notifications for the logged-in user
export const getUserNotifications = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ message: "Unauthorized" });

    const sql = `
      SELECT 
        n.notification_id,
        n.item_id,
        n.type,
        n.status,
        DATE_FORMAT(n.created_at, '%b %d, %Y %h:%i %p') AS created_at,
        CASE 
          WHEN n.type = 'Event' THEN e.title
          WHEN n.type = 'Announcement' THEN a.title
        END AS title,
        CASE 
          WHEN n.type = 'Event' THEN e.description
          WHEN n.type = 'Announcement' THEN a.description
        END AS description,
        CASE 
          WHEN n.type = 'Event' THEN e.remarks
          WHEN n.type = 'Announcement' THEN a.remarks
        END AS remarks
      FROM notification n
      LEFT JOIN event e ON n.item_id = e.event_id AND n.type = 'Event'
      LEFT JOIN announcement a ON n.item_id = a.announcement_id AND n.type = 'Announcement'
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `;

    const [rows] = await db.query(sql, [user_id]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// Get a single notification by ID
export const getNotificationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        n.notification_id,
        n.user_id,
        n.item_id,
        n.type,
        n.status,
        DATE_FORMAT(n.created_at, '%b %d, %Y %h:%i %p') AS created_at,
        
        CASE 
          WHEN n.type = 'Event' THEN e.title
          WHEN n.type = 'Announcement' THEN a.title
        END AS title,

        CASE 
          WHEN n.type = 'Event' THEN e.description
          WHEN n.type = 'Announcement' THEN a.description
        END AS description,

        CASE 
          WHEN n.type = 'Event' THEN e.remarks
          WHEN n.type = 'Announcement' THEN a.remarks
        END AS remarks

      FROM notification n
      LEFT JOIN event e 
        ON n.item_id = e.event_id AND n.type = 'Event'
      LEFT JOIN announcement a 
        ON n.item_id = a.announcement_id AND n.type = 'Announcement'
      WHERE n.notification_id = ?
    `;

    const [rows] = await db.query(sql, [id]);

    if (!rows.length)
      return res.status(404).json({ message: "Notification not found" });

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error fetching notification details:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;

    const sql = `DELETE FROM notification WHERE notification_id = ? AND user_id = ?`;
    const [result] = await db.query(sql, [id, user_id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Notification not found" });

    return res.status(200).json({ message: "Notification deleted successfully" });
  } catch (err) {
    console.error("Error deleting notification:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;

    const sql = `UPDATE notification SET status = 'read' WHERE notification_id = ? AND user_id = ?`;
    const [result] = await db.query(sql, [id, user_id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Notification not found or not owned by user" });

    return res.status(200).json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const user_id = req.user?.id;

    const sql = `UPDATE notification SET status = 'read' WHERE user_id = ?`;
    await db.query(sql, [user_id]);

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Create notifications for students when a new approved item is added
export const createNotificationForStudents = async (type, itemId, io = null) => {
  try {
    // Get all students (role_id = 1)
    const [students] = await db.query(
      "SELECT user_id FROM user WHERE role_id = 1"
    );

    if (!students.length) return;

    // Insert notification for each student
    const notificationValues = students.map((s) => [
      s.user_id,
      itemId,
      type,
      "unread", // status
      new Date(), // created_at
    ]);

    const sql = `
      INSERT INTO notification (user_id, item_id, type, status, created_at)
      VALUES ?
    `;

    await db.query(sql, [notificationValues]);

    console.log(`${students.length} notifications created for students`);

    // --- EMIT REAL-TIME NOTIFICATIONS ---
    if (io) {
      students.forEach((student) => {
        io.to(student.user_id.toString()).emit("newNotification", {
          user_id: student.user_id,
          item_id: itemId,
          type,
          status: "unread",
          created_at: new Date(),
        });
      });
    }

  } catch (err) {
    console.error("Error creating notifications for students:", err);
  }
};