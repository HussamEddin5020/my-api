// queries/userQueries.js

export const createUser = `
  INSERT INTO users (name, email, phone, password_hash, type, status)
  VALUES (?, ?, ?, ?, ?, ?)
`;

export const findUserByEmail = `
  SELECT * FROM users WHERE email = ?
`;

export const findUserByPhone = `
  SELECT * FROM users WHERE phone = ?
`;

export const findUserById = `
  SELECT id, name, email, phone, type, status, created_at, updated_at
  FROM users
  WHERE id = ?
`;

export const getAllUsers = `
  SELECT id, name, email, phone, type, status, created_at, updated_at
  FROM users
`;

export const updateUser = `
  UPDATE users
  SET name = ?, email = ?, phone = ?, type = ?, status = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

export const deleteUser = `
  DELETE FROM users WHERE id = ?
`;


// queries/userPermissionQueries.js

export const getUserPermissions = `
  SELECT a.name AS action, p.name AS permission
  FROM user_permissions up
  JOIN actions a ON up.action_id = a.id
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = ?
`;
