// middleware/checkPermission.js
import pool from "../config/db.js";

// higher-order function: تستدعى في الراوت
export function checkPermission(actionName, permissionName) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id; // جاي من authMiddleware (JWT)

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: missing user" });
      }

      // 1) هات action_id
      const [actionRows] = await pool.query(
        "SELECT id FROM actions WHERE name = ?",
        [actionName]
      );
      if (actionRows.length === 0) {
        return res.status(403).json({ error: `Action '${actionName}' not found` });
      }
      const actionId = actionRows[0].id;

      // 2) هات permission_id
      const [permRows] = await pool.query(
        "SELECT id FROM permissions WHERE name = ?",
        [permissionName]
      );
      if (permRows.length === 0) {
        return res.status(403).json({ error: `Permission '${permissionName}' not found` });
      }
      const permissionId = permRows[0].id;

      // 3) تحقق من user_permissions
      const [rows] = await pool.query(
        `SELECT 1 FROM user_permissions 
         WHERE user_id = ? AND action_id = ? AND permission_id = ?`,
        [userId, actionId, permissionId]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // ✅ مسموح
      next();
    } catch (err) {
      console.error("Permission check error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
