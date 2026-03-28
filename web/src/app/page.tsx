"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CampaignCard, type CampaignCardData } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/LoadingSkeleton";
import { apiClient } from "@/services/apiClient";
import { useAuthStore } from "@/stores/authStore";
import LiveMarquee from "@/components/feed/LiveMarquee";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const t = useTranslations("home");
  const tb = useTranslations("brand");

  const player = useAuthStore((state) => state.player);
  const currentPlayerId: string | null = player?.id ?? null;

  const [campaigns, setCampaigns] = useState<CampaignCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [kujiRes, unlimitedRes] = await Promise.all([
          apiClient.get<CampaignCardData[]>("/api/v1/campaigns/kuji").catch(() => [] as CampaignCardData[]),
          apiClient.get<CampaignCardData[]>("/api/v1/campaigns/unlimited").catch(() => [] as CampaignCardData[]),
        ]);
        const kujiWithType = (kujiRes ?? []).map((c) => ({ ...c, type: "一番賞" as const }));
        const unlimitedWithType = (unlimitedRes ?? []).map((c) => ({ ...c, type: "無限賞" as const }));
        if (!cancelled) setCampaigns([...kujiWithType, ...unlimitedWithType].slice(0, 8));
      } catch {
        // Silently fall back to empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="p-6 lg:p-10">
        <div className="relative w-full h-[400px] lg:h-[500px] rounded-lg lg:rounded-xl overflow-hidden group">
          {/* Fallback gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high via-surface-container to-surface-container-low" />

          {/* Cover image if campaigns are loaded */}
          {campaigns[0]?.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaigns[0].coverImageUrl}
              alt={t("featuredEvent")}
              className="absolute inset-0 w-full h-full object-cover brightness-50 transition-transform duration-700 group-hover:scale-105"
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dim via-transparent to-transparent" />

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 p-8 lg:p-12 w-full max-w-2xl">
            <span className="inline-block px-4 py-1 mb-4 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-bold uppercase tracking-widest font-headline">
              {t("featuredEvent")}
            </span>
            <h2 className="text-4xl lg:text-6xl font-black font-headline text-white mb-4 leading-tight">
              {campaigns[0]?.title ?? t("heroTitle")}
            </h2>
            <p className="text-on-surface-variant text-lg mb-8 max-w-md">
              {t("heroDescription")}
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href={campaigns[0] ? `/campaigns/${campaigns[0].id}` : "/campaigns"}
                className="px-8 py-4 bg-gradient-to-tr from-primary to-primary-container text-on-primary font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                {t("drawNow")}{campaigns[0] ? ` - ${campaigns[0].pricePerDraw} pts` : ""}
              </Link>
              <Link
                href="/campaigns"
                className="px-8 py-4 border border-outline-variant/30 text-white font-bold rounded-xl hover:bg-white/5 transition-colors"
              >
                {t("viewPrizeList")}
              </Link>
            </div>
          </div>

          {/* Carousel indicators */}
          <div className="absolute right-12 bottom-12 hidden lg:flex flex-col gap-3">
            <div className="w-1 h-12 bg-primary rounded-full" />
            <div className="w-1 h-12 bg-white/20 rounded-full" />
            <div className="w-1 h-12 bg-white/20 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── Live Feed Marquee ────────────────────────────────────────── */}
      <LiveMarquee currentPlayerId={currentPlayerId} />

      {/* ── Ichiban Kuji Section ─────────────────────────────────────── */}
      <section className="p-6 lg:p-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="text-3xl font-black font-headline text-white tracking-tight">
              {t("ichibanKuji")}
            </h3>
            <p className="text-on-surface-variant">{t("ichibanSubtitle")}</p>
          </div>
          <Link
            href="/campaigns?type=ichiban"
            className="text-primary font-bold flex items-center gap-1 hover:underline"
          >
            {t("viewPrizeList")}{" "}
            <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.filter((c) => c.type === "一番賞").length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-xl bg-surface-container text-on-surface-variant text-sm gap-3">
            <span className="material-symbols-outlined text-4xl opacity-40">confirmation_number</span>
            <span>{t("noCampaignsYet")}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {campaigns
              .filter((c) => c.type === "一番賞")
              .slice(0, 4)
              .map((c, idx) => (
                <div key={c.id} className={idx === 0 ? "gold-glow" : ""}>
                  <CampaignCard campaign={c} />
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ── Infinite Kuji Section ────────────────────────────────────── */}
      <section className="p-6 lg:p-10">
        <div className="flex items-center gap-4 mb-8">
          <span className="material-symbols-outlined text-4xl text-tertiary">all_inclusive</span>
          <div>
            <h3 className="text-3xl font-black font-headline text-white tracking-tight">
              {t("infiniteKuji")}
            </h3>
            <p className="text-on-surface-variant">{t("infiniteSubtitle")}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.filter((c) => c.type === "無限賞").length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-xl bg-surface-container text-on-surface-variant text-sm gap-3">
            <span className="material-symbols-outlined text-4xl opacity-40">all_inclusive</span>
            <span>{t("noCampaignsYet")}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {campaigns
              .filter((c) => c.type === "無限賞")
              .slice(0, 3)
              .map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
          </div>
        )}
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="p-10 border-t border-white/5 opacity-40 text-center">
        <p className="text-sm font-headline tracking-widest uppercase text-on-surface">
          {tb("copyright")}
        </p>
        <p className="text-[10px] mt-2 text-on-surface-variant">
          {t("footerTagline")}
        </p>
      </footer>
    </div>
  );
}
