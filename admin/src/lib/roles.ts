export type StaffRole = 'CUSTOMER_SERVICE' | 'OPERATOR' | 'ADMIN' | 'OWNER';

export const ROLE_HIERARCHY: Record<StaffRole, number> = {
  CUSTOMER_SERVICE: 0,
  OPERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasMinRole(userRole: StaffRole, requiredRole: StaffRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  minRole: StaffRole;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: '📊', label: '總覽', minRole: 'OPERATOR' },
  { href: '/campaigns', icon: '🎰', label: '活動管理', minRole: 'OPERATOR' },
  { href: '/shipping', icon: '📦', label: '出貨管理', minRole: 'OPERATOR' },
  { href: '/withdrawals', icon: '💰', label: '提領審核', minRole: 'ADMIN' },
  { href: '/players', icon: '👥', label: '玩家管理', minRole: 'OPERATOR' },
  { href: '/trade', icon: '💱', label: '交易監控', minRole: 'OPERATOR' },
  { href: '/prizes', icon: '🏆', label: '賞品管理', minRole: 'OPERATOR' },
  { href: '/coupons', icon: '🎟', label: '優惠券', minRole: 'OPERATOR' },
  { href: '/leaderboard', icon: '🏅', label: '排行榜', minRole: 'OPERATOR' },
  { href: '/banners', icon: '🖼', label: '輪播橫幅', minRole: 'OPERATOR' },
  { href: '/payments', icon: '💳', label: '金流紀錄', minRole: 'ADMIN' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/staff', icon: '🔐', label: '人員管理', minRole: 'ADMIN' },
  { href: '/audit', icon: '📋', label: '稽核紀錄', minRole: 'ADMIN' },
  { href: '/announcements', icon: '📢', label: '公告管理', minRole: 'OPERATOR' },
  { href: '/feature-flags', icon: '🚩', label: 'Feature Flags', minRole: 'ADMIN' },
  { href: '/settings', icon: '⚙', label: '系統設定', minRole: 'ADMIN' },
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  CUSTOMER_SERVICE: '客服人員',
  OPERATOR: '營運員工',
  ADMIN: '管理員',
  OWNER: '老闆',
};
