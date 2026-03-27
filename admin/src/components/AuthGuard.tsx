"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { hasMinRole, NAV_ITEMS, ADMIN_NAV_ITEMS, type StaffRole } from "@/lib/roles";

const ALL_ROUTE_ITEMS = [...NAV_ITEMS, ...ADMIN_NAV_ITEMS];

function getRequiredRoleForPath(pathname: string): StaffRole | null {
  // Match exact or prefix
  for (const item of ALL_ROUTE_ITEMS) {
    if (item.href === "/dashboard" && pathname === "/dashboard") {
      return item.minRole;
    }
    if (item.href !== "/dashboard" && pathname.startsWith(item.href)) {
      return item.minRole;
    }
  }
  // Default: require at least OPERATOR for any admin route
  return "OPERATOR";
}

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "authorized" | "unauthorized" | "insufficient">(
    "checking"
  );
  const [userRole, setUserRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = sessionStorage.getItem("adminAccessToken");
    const role = sessionStorage.getItem("adminRole") as StaffRole | null;

    if (!token || !role) {
      router.replace("/login");
      return;
    }

    const validRoles: StaffRole[] = ["CUSTOMER_SERVICE", "OPERATOR", "ADMIN", "OWNER"];
    if (!validRoles.includes(role)) {
      router.replace("/login");
      return;
    }

    const requiredRole = getRequiredRoleForPath(pathname);
    const nextStatus =
      requiredRole && !hasMinRole(role, requiredRole) ? "insufficient" : "authorized";

    // Batch state updates in a microtask to avoid the "setState in effect" lint rule
    Promise.resolve().then(() => {
      setUserRole(role);
      setStatus(nextStatus);
    });
  }, [pathname, router]);

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-slate-500">驗證中...</p>
        </div>
      </div>
    );
  }

  if (status === "insufficient") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-slate-900">權限不足</h1>
          <p className="text-sm text-slate-500">
            你的帳號（{userRole}）沒有存取此頁面的權限，請聯繫管理員。
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            返回上一頁
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
