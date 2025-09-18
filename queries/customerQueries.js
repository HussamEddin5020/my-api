// queries/customerQueries.js

// إنشاء عميل جديد (محتاج user_id + address_id)
export const createCustomer = `
  INSERT INTO customers (user_id, address_id)
  VALUES (?, ?)
`;

// الحصول على عميل عبر user_id مع تفاصيل العنوان
export const getCustomerByUserId = `
  SELECT 
    c.id AS customer_id,
    u.id AS user_id,
    u.name, 
    u.email, 
    u.phone,
    ci.name AS city,
    ar.name AS area,
    a.street
  FROM customers c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN addresses a ON c.address_id = a.id
  LEFT JOIN cities ci ON a.city_id = ci.id
  LEFT JOIN areas ar ON a.area_id = ar.id
  WHERE u.id = ?
`;

// الحصول على كل العملاء مع العناوين
export const getAllCustomers = `
  SELECT 
    c.id AS customer_id,
    u.id AS user_id,
    u.name, 
    u.email, 
    u.phone,
    ci.name AS city,
    ar.name AS area,
    a.street
  FROM customers c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN addresses a ON c.address_id = a.id
  LEFT JOIN cities ci ON a.city_id = ci.id
  LEFT JOIN areas ar ON a.area_id = ar.id
`;

// تحديث عنوان العميل (تحديث address)
export const updateCustomerAddress = `
  UPDATE addresses
  SET city_id = ?, area_id = ?, street = ?, created_at = created_at
  WHERE id = ?
`;

// حذف عميل (هيشيل الـ record في customers)
export const deleteCustomer = `
  DELETE FROM customers WHERE user_id = ?
`;


export const getCustomerDetails = `
  SELECT 
    c.id AS customer_id,
    u.id AS user_id,
    u.name, 
    u.email, 
    u.phone,
    ci.name AS city,
    ar.name AS area,
    a.street,
    c.created_at,
    c.updated_at
  FROM customers c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN addresses a ON c.address_id = a.id
  LEFT JOIN cities ci ON a.city_id = ci.id
  LEFT JOIN areas ar ON a.area_id = ar.id
  WHERE c.id = ?
`;


export const getAllCustomerDetails = `
  SELECT 
    c.id AS customer_id,
    u.id AS user_id,
    u.name, 
    u.email, 
    u.phone,
    ci.name AS city,
    ar.name AS area,
    a.street,
    c.created_at,
    c.updated_at
  FROM customers c
  JOIN users u ON c.user_id = u.id
  LEFT JOIN addresses a ON c.address_id = a.id
  LEFT JOIN cities ci ON a.city_id = ci.id
  LEFT JOIN areas ar ON a.area_id = ar.id
  ORDER BY c.created_at DESC
`;
