"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  placeholder?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { href: "/tickets", icon: "📋", label: "工單佇列" },
  { href: "/players", icon: "🔍", label: "玩家查詢" },
  {
    href: "/line-messages",
    icon: "💬",
    label: "LINE 訊息",
    placeholder: true,
  },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/settings", icon: "⚙", label: "個人設定" },
];

interface CsSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function CsSidebar({ mobileOpen, onClose }: CsSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/tickets") return pathname === "/tickets" || pathname.startsWith("/tickets/");
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link
      href={item.placeholder ? "#" : item.href}
      onClick={item.placeholder ? (e) => e.preventDefault() : onClose}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        item.placeholder
          ? "cursor-not-allowed text-slate-400"
          : isActive(item.href)
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
      aria-disabled={item.placeholder}
    >
      <span className="w-5 text-center text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
      {item.placeholder && (
        <span className="ml-auto rounded bg-slate-200 px-1 py-0.5 text-xs text-slate-400">
          即將推出
        </span>
      )}
    </Link>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="my-3 border-t border-slate-200" />

        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-400">v1.0.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-52 flex-shrink-0 border-r border-slate-200 lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative z-50 flex h-full w-52 flex-col border-r border-slate-200 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
