"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { authStore, subscribeToAuthStore } from "@/stores/authStore";
import type { PlayerDto } from "@/stores/authStore";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  iconFilled?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "home", icon: "home", iconFilled: "home" },
  { href: "/trade", labelKey: "market", icon: "storefront", iconFilled: "storefront" },
  { href: "/leaderboard", labelKey: "leaderboard", icon: "emoji_events", iconFilled: "emoji_events" },
  { href: "/prizes", labelKey: "myPrizes", icon: "inventory_2", iconFilled: "inventory_2" },
  { href: "/wallet", labelKey: "wallet", icon: "account_balance_wallet", iconFilled: "account_balance_wallet" },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/", labelKey: "home", icon: "home" },
  { href: "/trade", labelKey: "market", icon: "storefront" },
  { href: "/leaderboard", labelKey: "leaderboard", icon: "leaderboard" },
  { href: "/settings", labelKey: "my", icon: "person" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function SideNav({ pathname, player }: { pathname: string; player: PlayerDto | null }) {
  const tn = useTranslations("nav");
  const tb = useTranslations("brand");
  const tc = useTranslations("common");

  return (
    <aside className="hidden lg:flex flex-col p-6 gap-8 h-screen w-64 fixed left-0 top-0 bg-surface-dim shadow-[20px_0_40px_rgba(0,0,0,0.4)] z-50"
      style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            gallery_thumbnail
          </span>
        </div>
        <div>
          <h1 className="text-xl font-black text-primary-container tracking-tighter leading-tight font-headline">
            {tb("title")}
          </h1>
          <p className="font-headline tracking-wider uppercase text-[10px] font-bold text-secondary/60">
            {tb("subtitle")}
          </p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-full font-headline tracking-wider uppercase text-xs font-bold transition-all duration-300 ${
                active
                  ? "bg-primary-container/10 text-primary-container"
                  : "text-secondary/60 hover:text-secondary hover:bg-white/5"
              }`}
              style={active ? { border: "1px solid rgba(245,158,11,0.2)" } : undefined}
            >
              <span
                className="material-symbols-outlined"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span>{tn(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      {player ? (
        <Link
          href="/settings"
          className="p-4 bg-surface-container-low rounded-2xl flex items-center gap-3"
          style={{ border: "1px solid rgba(83,68,52,0.1)" }}
        >
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold overflow-hidden">
            {player.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatarUrl} alt={player.nickname} className="w-full h-full object-cover" />
            ) : (
              player.nickname.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{player.nickname}</p>
            <p className="text-[10px] text-secondary/60">{tc("collector")}</p>
          </div>
          <span className="material-symbols-outlined text-secondary/40 text-sm">settings</span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="p-4 rounded-2xl amber-gradient text-on-primary font-bold text-center font-headline"
        >
          {tb("enterGallery")}
        </Link>
      )}
    </aside>
  );
}

function MobileTopBar({ player }: { player: PlayerDto | null }) {
  const tb = useTranslations("brand");
  const tc = useTranslations("common");

  return (
    <header className="fixed top-0 w-full z-50 flex lg:hidden justify-between items-center px-6 py-4 glass-panel shadow-xl">
      <Link href="/" className="text-lg font-bold bg-gradient-to-tr from-primary to-primary-container bg-clip-text text-transparent font-headline">
        {tb("mobileTitle")}
      </Link>
      <div className="flex items-center gap-4">
        {player && (
          <Link href="/wallet" className="flex items-center gap-1 bg-primary/10 px-3 py-1 rounded-full">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance_wallet
            </span>
            <span className="text-primary text-xs font-bold">
              {player.drawPointsBalance?.toLocaleString() ?? "0"} {tc("pts")}
            </span>
          </Link>
        )}
        <Link href="/settings">
          <span className="material-symbols-outlined text-secondary">notifications</span>
        </Link>
      </div>
    </header>
  );
}

function MobileBottomBar({ pathname }: { pathname: string }) {
  const tn = useTranslations("nav");

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-8 py-4 lg:hidden z-50 rounded-t-[3rem] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
      style={{ background: "rgba(26,26,46,0.8)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}>
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center">
            {active ? (
              <span className="flex items-center justify-center bg-gradient-to-tr from-primary to-primary-container text-surface-dim rounded-full p-2 h-12 w-12 scale-110">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {item.icon}
                </span>
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined text-secondary/50">{item.icon}</span>
                <span className="font-label text-[10px] font-medium tracking-[0.05em] text-secondary/50">
                  {tn(item.labelKey)}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [player, setPlayer] = useState<PlayerDto | null>(() => authStore.player);

  useEffect(() => {
    const unsub = subscribeToAuthStore(() => {
      setPlayer(authStore.player);
    });
    return unsub;
  }, []);

  // Auth pages (login, phone-binding) get no shell
  const isAuthPage = pathname.startsWith("/login") || pathname.includes("(auth)");
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <SideNav pathname={pathname} player={player} />
      <MobileTopBar player={player} />
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-12 pt-20 lg:pt-0">
        {children}
      </main>
      <MobileBottomBar pathname={pathname} />
    </>
  );
}
