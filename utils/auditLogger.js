// utils/auditLogger.js
import pool from "../config/db.js";

// 🔹 System Users Audit (structural changes: create/update/delete)
export async function logSystemAudit({ actorUserId, entityType, entityId, action, oldData, newData, conn }) {
  const executor = conn || pool;  // use same transaction if provided
  try {
    await executor.query(
      `INSERT INTO user_audit_logs (actor_user_id, entity_type, entity_id, action, old_data, new_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorUserId || null,
        entityType,
        entityId,
        action,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null
      ]
    );
  } catch (err) {
    console.error("User Audit log error:", err);
  }
}

// 🔹 Customers Audit (structural changes: register/update/delete)
export async function logCustomerAudit({ actorCustomerId, entityType, entityId, action, oldData, newData, conn }) {
  const executor = conn || pool; // use transaction conn if passed
  try {
    await executor.query(
      `INSERT INTO customer_audit_logs (actor_customer_id, entity_type, entity_id, action, old_data, new_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorCustomerId || null,
        entityType,
        entityId,
        action,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null
      ]
    );
  } catch (err) {
    console.error("Customer Audit log error:", err);
  }
}

// 🔹 NEW: User Activity Log (behavioral actions: update user, change permissions, manage customer, etc.)
export async function logUserActivity({ actorUserId, actionType, targetEntityType, targetEntityId, details }) {
  try {
    await pool.query(
      `INSERT INTO user_activity_log 
        (actor_user_id, action_type, target_entity_type, target_entity_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        actorUserId,
        actionType,
        targetEntityType,
        targetEntityId,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (err) {
    console.error("User Activity log error:", err);
  }
}
