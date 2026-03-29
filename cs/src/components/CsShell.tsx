"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CsSidebar } from "./CsSidebar";
import { CsTopBar } from "./CsTopBar";

interface CsShellProps {
  children: React.ReactNode;
}

export function CsShell({ children }: CsShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("csAccessToken");
    if (!token) {
      router.push("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <CsTopBar />
      <div className="flex flex-1 overflow-hidden">
        <CsSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
