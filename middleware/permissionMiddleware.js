// middleware/permissionMiddleware.js

export function checkPermission(action, permission) {
  return (req, res, next) => {
    try {
      // req.user جه من authMiddleware بعد فك التوكن
      const user = req.user;

      if (!user || !user.permissions) {
        return res.status(403).json({ error: "No permissions found" });
      }

      // example: "open_box:delete"
      const permKey = `${action}:${permission}`;

      if (user.permissions.includes(permKey)) {
        return next(); // ✅ عنده الصلاحية
      }

      return res.status(403).json({ error: "Forbidden: insufficient permission" });
    } catch (err) {
      console.error("Permission check error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
