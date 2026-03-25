"use client";

import { useState } from "react";
import { CsSidebar } from "./CsSidebar";
import { CsTopBar } from "./CsTopBar";

interface CsShellProps {
  children: React.ReactNode;
}

export function CsShell({ children }: CsShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
