// queries/orderQueries.js

// إنشاء طلب جديد
export const createOrder = `
  INSERT INTO orders (creator_user_id, creator_customer_id, customer_id, collection_id, position_id)
  VALUES (?, ?, ?, ?, ?)
`;

// تحديث حالة الطلب
export const updateOrderPosition = `
  UPDATE orders SET position_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`;

// حذف الطلب
export const deleteOrder = `
  DELETE FROM orders WHERE id = ?
`;

// جلب طلب معين
export const getOrderById = `
  SELECT o.*, op.name as position_name
  FROM orders o
  JOIN order_position op ON o.position_id = op.id
  WHERE o.id = ?
`;


// جلب طلب كامل بكل تفاصيله
export const getFullOrderById = `
  SELECT 
    o.id AS order_id,
    o.created_at AS order_created,
    o.updated_at AS order_updated,
    c.id AS collection_id,
    cu.id AS customer_id,
    cu.user_id AS customer_user_id,
    u.name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    op.name AS current_status,
    od.id AS detail_id,
    od.image_url,
    od.title,
    od.description,
    od.notes,
    od.color,
    od.size,
    od.capacity,
    od.prepaid_value,
    od.original_product_price,
    od.commission,
    od.total
  FROM orders o
  LEFT JOIN collections c ON o.collection_id = c.id
  LEFT JOIN customers cu ON o.customer_id = cu.id
  LEFT JOIN users u ON cu.user_id = u.id
  LEFT JOIN order_position op ON o.position_id = op.id
  LEFT JOIN order_details od ON o.id = od.order_id
  WHERE o.id = ?
`;

// timeline (history) للطلب
export const getOrderHistoryById = `
  SELECT 
    h.id,
    h.old_position_id,
    h.new_position_id,
    op_old.name AS old_position,
    op_new.name AS new_position,
    h.changed_by,
    u.name AS changed_by_name,
    h.changed_at
  FROM order_history h
  LEFT JOIN order_position op_old ON h.old_position_id = op_old.id
  LEFT JOIN order_position op_new ON h.new_position_id = op_new.id
  LEFT JOIN users u ON h.changed_by = u.id
  WHERE h.order_id = ?
  ORDER BY h.changed_at ASC
`;


// جلب تفاصيل الطلب قبل التعديل
export const getOrderDetailById = `
  SELECT * FROM order_details WHERE id = ?
`;

// تحديث تفاصيل الطلب
export const updateOrderDetail = `
  UPDATE order_details
  SET image_url = ?, title = ?, description = ?, notes = ?, color = ?, size = ?, capacity = ?,
      prepaid_value = ?, original_product_price = ?, commission = ?, total = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;


// إدخال تفاصيل المنتجات
export const insertOrderDetails = `
  INSERT INTO order_details 
  (order_id, image_url, title, description, notes, color, size, capacity, prepaid_value, original_product_price, commission, total)
  VALUES ?
`;
