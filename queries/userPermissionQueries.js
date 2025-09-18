// queries/userPermissionQueries.js

export const getUserPermissions = `
  SELECT a.name AS action, p.name AS permission
  FROM user_permissions up
  JOIN actions a ON up.action_id = a.id
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = ?
`;

// queries/userPermissionQueries.js

// queries/userPermissionQueries.js

export const getUserPermissionsById = `
  SELECT a.id AS action_id, a.name AS action, p.id AS permission_id, p.name AS permission
  FROM user_permissions up
  JOIN actions a ON up.action_id = a.id
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = ?
`;
