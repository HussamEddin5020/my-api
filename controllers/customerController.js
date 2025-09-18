import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import {
  createCustomer,
  getCustomerByUserId,
  getAllCustomers,
  updateCustomerAddress,
  deleteCustomer,
  getCustomerDetails,
  getAllCustomerDetails
} from "../queries/customerQueries.js";

import { logCustomerAudit, logSystemAudit, logUserActivity } from "../utils/auditLogger.js";

// Register Customer (users + addresses + customers)
export async function registerCustomer(req, res) {
  const { name, email, phone, password, city_id, area_id, street } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT id FROM users WHERE email = ? OR phone = ?`,
      [email, phone]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, type, status)
       VALUES (?, ?, ?, ?, 'customer', 'active')`,
      [name, email, phone, hashedPassword]
    );
    const userId = userResult.insertId;

    const [addrResult] = await conn.query(
      `INSERT INTO addresses (city_id, area_id, street)
       VALUES (?, ?, ?)`,
      [city_id, area_id, street]
    );
    const addressId = addrResult.insertId;

    const [custResult] = await conn.query(createCustomer, [userId, addressId]);
    const customerId = custResult.insertId;


    await conn.commit();

    res.status(201).json({
      message: "Customer registered successfully",
      userId,
      addressId,
      customerId
    });
  } catch (err) {
    await conn.rollback();
    console.error("Register customer error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}

// 🔹 Update customer address
// 🔹 Update customer address with diff-style logging
export async function updateCustomerById(req, res) {
  try {
    const { id } = req.params; // customer_id
    const { city_id, area_id, street } = req.body;

    // Get old data
    const [oldRows] = await pool.query(
      `SELECT a.* FROM addresses a
       JOIN customers c ON c.address_id = a.id
       WHERE c.id = ?`,
      [id]
    );
    if (oldRows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const oldData = oldRows[0];

    // Update
    await pool.query(updateCustomerAddress, [city_id, area_id, street, oldData.id]);

    // Get new data
    const [newRows] = await pool.query(`SELECT * FROM addresses WHERE id = ?`, [oldData.id]);
    const newData = newRows[0];

    // 🔹 Build diff object
    const changes = [];
    ["city_id", "area_id", "street"].forEach((field) => {
      if (oldData[field] !== newData[field]) {
        changes.push({
          field,
          old: oldData[field],
          new: newData[field],
        });
      }
    });

    // ✅ system audit log
    await logSystemAudit({
      actorUserId: req.user.id,   // the admin/staff user
      entityType: "customer",
      entityId: id,
      action: "UPDATE",
      oldData: null,
      newData: { changes }, // 🔥 only diffs
    });

    // ✅ activity log
    await logUserActivity({
      actorUserId: req.user.id,
      actionType: "UPDATE_CUSTOMER",
      targetEntityType: "customer",
      targetEntityId: id,
      details: { changes }, // 🔥 only diffs
    });

    res.json({ message: "Customer address updated successfully" });
  } catch (err) {
    console.error("Update customer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}



// 🔹 Delete customer
// 🔹 Delete customer with diff-style logging
export async function deleteCustomerById(req, res) {
  try {
    const { id } = req.params; // customer_id

    const [oldRows] = await pool.query(getCustomerByUserId, [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const oldData = oldRows[0];

    await pool.query(deleteCustomer, [id]);

    // 🔹 Build diff as "deleted"
    const changes = Object.keys(oldData).map((field) => ({
      field,
      old: oldData[field],
      new: null, // record is deleted
    }));

    // ✅ system audit log
    await logSystemAudit({
      actorUserId: req.user.id,
      entityType: "customer",
      entityId: id,
      action: "DELETE",
      oldData: null,
      newData: { changes }, // 🔥 all deleted fields
    });

    // ✅ activity log
    await logUserActivity({
      actorUserId: req.user.id,
      actionType: "DELETE_CUSTOMER",
      targetEntityType: "customer",
      targetEntityId: id,
      details: { changes },
    });

    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}



// Delete customer


// Get customer details by ID
export async function getCustomerDetailsApi(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(getCustomerDetails, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get customer details error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all customers
export async function getCustomers(req, res) {
  try {
    const [rows] = await pool.query(getAllCustomers);
    res.json(rows);
  } catch (err) {
    console.error("Get customers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get single customer by ID
export async function getCustomer(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(getCustomerDetails, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Get customer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Get all customer details (this was missing export)
export async function getAllCustomerDetailsApi(req, res) {
  try {
    const [rows] = await pool.query(getAllCustomerDetails);
    res.json(rows);
  } catch (err) {
    console.error("Get all customer details error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
