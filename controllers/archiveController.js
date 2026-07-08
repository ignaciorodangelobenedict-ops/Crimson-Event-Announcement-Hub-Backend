// archiveController.js
import { updateArchivedStatus } from "../service/archiveService.js";
import db from "../database/database.js";

export const archiveController = async (req, res) => {
  try {
    await updateArchivedStatus();

    const type = req.query.type === 'Event' || req.query.type === 'Announcement' ? req.query.type : 'all';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 10);
    const offset = (page - 1) * pageSize;

    let items = [];
    let totalItems = 0;

    if (type === 'Event' || type === 'Announcement') {
      const table = type === 'Event' ? 'event' : 'announcement';
      const dateField = type === 'Event' ? 'event_date' : 'created_at';
      const idField = type === 'Event' ? 'event_id' : 'announcement_id';

      const [rows] = await db.execute(`
        SELECT
          ${idField} AS id,
          title,
          '${type}' AS type,
          DATE_FORMAT(${dateField}, '%b %d, %Y') AS date
        FROM ${table}
        WHERE status = 'archived'
        ORDER BY ${dateField} DESC
        LIMIT ? OFFSET ?
      `, [pageSize, offset]);

      const [[{ total_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM ${table} WHERE status = 'archived'
      `);

      items = rows;
      totalItems = total_count;
    } else {
      const [rows] = await db.execute(`
        SELECT id, title, type, date FROM (
          SELECT event_id AS id, title, 'Event' AS type,
            DATE_FORMAT(event_date, '%b %d, %Y') AS date,
            event_date AS sort_date
          FROM event WHERE status = 'archived'
          UNION ALL
          SELECT announcement_id AS id, title, 'Announcement' AS type,
            DATE_FORMAT(created_at, '%b %d, %Y') AS date,
            created_at AS sort_date
          FROM announcement WHERE status = 'archived'
        ) AS combined
        ORDER BY sort_date DESC
        LIMIT ? OFFSET ?
      `, [pageSize, offset]);

      const [[{ total_count: event_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM event WHERE status = 'archived'
      `);
      const [[{ total_count: announcement_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM announcement WHERE status = 'archived'
      `);

      items = rows;
      totalItems = event_count + announcement_count;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    res.json({
      success: true,
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        type,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch archived items",
    });
  }
};

export const deleteArchivedItem = async (req, res) => {
  const { id, type } = req.body;
  const user_id = req.user?.id;
  const isAdmin = req.user?.role === 'admin'; // assuming you have role stored in JWT

  if (!user_id) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    if (type === 'Event') {
      // Admin can delete any, user can delete only their own
      const [rows] = await db.execute(
        "SELECT user_id FROM event WHERE event_id = ?",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, message: "Event not found" });
      if (!isAdmin && rows[0].user_id !== user_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete this event" });
      }

      await db.execute("DELETE FROM event WHERE event_id = ?", [id]);

    } else if (type === 'Announcement') {
      const [rows] = await db.execute(
        "SELECT user_id FROM announcement WHERE announcement_id = ?",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, message: "Announcement not found" });
      if (!isAdmin && rows[0].user_id !== user_id) {
        return res.status(403).json({ success: false, message: "Forbidden: Cannot delete this announcement" });
      }

      await db.execute("DELETE FROM announcement WHERE announcement_id = ?", [id]);
    }

    res.json({ success: true, message: "Deleted successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
};


export const archiveControllerByUser = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await updateArchivedStatus();

    const type = req.query.type === 'Event' || req.query.type === 'Announcement' ? req.query.type : 'all';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 10);
    const offset = (page - 1) * pageSize;

    let items = [];
    let totalItems = 0;

    if (type === 'Event' || type === 'Announcement') {
      const table = type === 'Event' ? 'event' : 'announcement';
      const dateField = type === 'Event' ? 'event_date' : 'created_at';
      const idField = type === 'Event' ? 'event_id' : 'announcement_id';

      const [rows] = await db.execute(`
        SELECT
          ${idField} AS id,
          title,
          '${type}' AS type,
          DATE_FORMAT(${dateField}, '%b %d, %Y') AS date
        FROM ${table}
        WHERE status = 'archived' AND user_id = ?
        ORDER BY ${dateField} DESC
        LIMIT ? OFFSET ?
      `, [user_id, pageSize, offset]);

      const [[{ total_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM ${table} WHERE status = 'archived' AND user_id = ?
      `, [user_id]);

      items = rows;
      totalItems = total_count;
    } else {
      const [rows] = await db.execute(`
        SELECT id, title, type, date FROM (
          SELECT event_id AS id, title, 'Event' AS type,
            DATE_FORMAT(event_date, '%b %d, %Y') AS date,
            event_date AS sort_date
          FROM event WHERE status = 'archived' AND user_id = ?
          UNION ALL
          SELECT announcement_id AS id, title, 'Announcement' AS type,
            DATE_FORMAT(created_at, '%b %d, %Y') AS date,
            created_at AS sort_date
          FROM announcement WHERE status = 'archived' AND user_id = ?
        ) AS combined
        ORDER BY sort_date DESC
        LIMIT ? OFFSET ?
      `, [user_id, user_id, pageSize, offset]);

      const [[{ total_count: event_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM event WHERE status = 'archived' AND user_id = ?
      `, [user_id]);
      const [[{ total_count: announcement_count }]] = await db.execute(`
        SELECT COUNT(*) AS total_count FROM announcement WHERE status = 'archived' AND user_id = ?
      `, [user_id]);

      items = rows;
      totalItems = event_count + announcement_count;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    res.json({
      success: true,
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        type,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch archived items",
    });
  }
};

