/**
 * Role-Based Access Control (RBAC) Permission Matrix
 */

export type UserRole = 'super_admin' | 'restaurant_owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';

export const PERMISSION_MATRIX: Record<UserRole, string[]> = {
  super_admin: [
    'restaurants.view', 'restaurants.manage', 'subscriptions.manage', 'analytics.view', 'restaurants.suspend',
    'menu.view', 'menu.manage', 'orders.view', 'orders.update', 'payments.settle', 'reports.view', 'staff.manage',
    'requests.handle', 'themes.manage'
  ],
  restaurant_owner: [
    'menu.view', 'menu.manage', 'orders.view', 'orders.update', 'payments.settle', 'reports.view', 'staff.manage',
    'requests.handle', 'subscriptions.manage', 'themes.manage'
  ],
  manager: [
    'menu.view', 'menu.manage', 'orders.view', 'orders.update', 'payments.settle', 'reports.view',
    'requests.handle', 'themes.manage'
  ],
  cashier: [
    'orders.view', 'payments.settle'
  ],
  kitchen: [
    'orders.view', 'orders.update'
  ],
  waiter: [
    'orders.view', 'requests.handle'
  ]
};

export function hasPermission(role: UserRole, permission: string): boolean {
  if (!role) return false;
  const permissions = PERMISSION_MATRIX[role] || [];
  return permissions.includes(permission);
}

/**
 * Validates role and restaurant context for request
 */
export async function authorizeUser(
  supabaseAdmin: any,
  userId: string,
  requiredPermission: string,
  targetRestaurantId?: string
): Promise<{ authorized: boolean; role?: UserRole; restaurantId?: string; error?: string }> {
  
  // Fetch user profile
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role, restaurant_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return { authorized: false, error: "User profile not found." };
  }

  if (!user.is_active) {
    return { authorized: false, error: "User account is suspended." };
  }

  const role = user.role as UserRole;

  // 1. Check permission matrix
  if (!hasPermission(role, requiredPermission)) {
    return { authorized: false, role, error: "Unauthorized access: permission denied." };
  }

  // 2. Validate tenant isolation context
  if (role !== 'super_admin' && targetRestaurantId && user.restaurant_id !== targetRestaurantId) {
    return { authorized: false, role, error: "Unauthorized access: restaurant context mismatch." };
  }

  return { 
    authorized: true, 
    role, 
    restaurantId: user.restaurant_id 
  };
}
