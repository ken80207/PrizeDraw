"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  hasMinRole,
  type NavItem,
  type StaffRole,
} from "@/lib/roles";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<StaffRole>("OPERATOR");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("adminRole") as StaffRole | null;
      if (stored && stored in { CUSTOMER_SERVICE: 1, OPERATOR: 1, ADMIN: 1, OWNER: 1 }) {
        Promise.resolve().then(() => setUserRole(stored));
      }
    }
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => hasMinRole(userRole, item.minRole));
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => hasMinRole(userRole, item.minRole));
  const showAdminSection = hasMinRole(userRole, "ADMIN");

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link
      href={item.href}
      onClick={onClose}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive(item.href)
          ? "bg-indigo-600 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className="w-5 text-center text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-bold">
          P
        </div>
        <span className="text-sm font-semibold text-white">PrizeDraw Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {showAdminSection && visibleAdminItems.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-700" />
            {visibleAdminItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 px-4 py-3">
        <p className="text-xs text-slate-500">v1.0.0 · Production</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col bg-slate-900">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-slate-900">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
