import { CsShell } from "@/components/CsShell";

export default function CsLayout({ children }: { children: React.ReactNode }) {
  return <CsShell>{children}</CsShell>;
}
