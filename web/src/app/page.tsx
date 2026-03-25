"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CampaignCard, type CampaignCardData } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/LoadingSkeleton";
import { apiClient } from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentWinner {
  nickname: string;
  grade: string;
  prizeName: string;
}

// ---------------------------------------------------------------------------
// Winner Marquee
// ---------------------------------------------------------------------------

function WinnerMarquee({ winners }: { winners: RecentWinner[] }) {
  if (winners.length === 0) return null;
  const doubled = [...winners, ...winners];
  return (
    <div className="overflow-hidden">
      <div className="flex gap-10 whitespace-nowrap" style={{ animation: "marquee 30s linear infinite" }}>
        {doubled.map((w, i) => (
          <span key={i} className="text-sm text-gray-700 dark:text-gray-300 shrink-0">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{w.nickname}</span>{" "}
            抽到{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">{w.grade}</span>{" "}
            {w.prizeName}！
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<CampaignCardData[]>([]);
  const [winners, setWinners] = useState<RecentWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiClient.get<{ items: CampaignCardData[] }>(
          "/api/v1/campaigns?status=active&limit=8",
        );
        if (!cancelled) setCampaigns(data.items ?? []);
      } catch {
        // Silently fall back to empty
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const data = await apiClient.get<{ items: RecentWinner[] }>(
          "/api/v1/leaderboard/recent-winners?limit=10",
        );
        if (!cancelled) setWinners(data.items ?? []);
      } catch {
        // ignore
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const displayWinners =
    winners.length > 0
      ? winners
      : [
          { nickname: "Player888", grade: "A賞", prizeName: "限定公仔" },
          { nickname: "Lucky777", grade: "B賞", prizeName: "精緻模型" },
          { nickname: "DrawMaster", grade: "Last賞", prizeName: "特別版" },
          { nickname: "AcePlayer", grade: "A賞", prizeName: "稀有手辦" },
          { nickname: "StarDraw", grade: "C賞", prizeName: "吊飾組" },
        ];

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <div className="text-6xl mb-4">🎰</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 drop-shadow-lg">
            PrizeDraw
          </h1>
          <p className="text-lg sm:text-xl text-indigo-100 max-w-2xl mx-auto mb-8">
            台灣最好玩的線上一番賞平台。即時抽獎、管理賞品、交易市集，全部在這裡！
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/campaigns"
              className="px-8 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold text-base hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              🎫 立即抽獎
            </Link>
            <Link
              href="/campaigns?type=unlimited"
              className="px-8 py-3.5 rounded-2xl bg-white/20 text-white font-bold text-base hover:bg-white/30 transition-all border border-white/40"
            >
              🎲 無限賞體驗
            </Link>
          </div>
        </div>
      </section>

      {/* ── 熱門活動橫向捲動 ─────────────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🔥 熱門活動
          </h2>
          <Link
            href="/campaigns"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            查看全部 →
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[260px] shrink-0">
                <CampaignCardSkeleton />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm gap-2">
            <span className="text-3xl">📭</span>
            <span>目前沒有進行中的活動，敬請期待！</span>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {campaigns.map((c) => (
              <div key={c.id} className="min-w-[260px] shrink-0">
                <CampaignCard campaign={c} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 玩法說明 ─────────────────────────────────────────────────── */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-8">
            玩法說明
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🎫</div>
              <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">一番賞</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                每個籤盒有固定數量的籤，每張籤對應一個賞品。加入排隊後輪到你時，選擇想要的籤（或隨機抽取），開出賞品存入賞品庫。先到先得，售完即止！
              </p>
              <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-5">
                {["明確知道每個賞品的位置分佈", "可自選籤或快速多抽", "即時觀看他人抽獎"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/campaigns?type=ichiban"
                className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                瀏覽一番賞活動
              </Link>
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/50 p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🎲</div>
              <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mb-3">無限賞</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                根據機率即開即玩，無需排隊。每次抽獎立即揭曉結果，可進行多連抽。賞品無上限供應，想抽幾次就抽幾次！
              </p>
              <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-5">
                {["無需排隊，即開即玩", "透明機率表公開揭示", "支援 ×3/×5/×10 連抽"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/campaigns?type=unlimited"
                className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                瀏覽無限賞活動
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 最近大獎得主跑馬燈 ───────────────────────────────────────── */}
      <section className="py-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-y border-indigo-100 dark:border-indigo-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-base">🏆</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">最近大獎得主</span>
          </div>
          <WinnerMarquee winners={displayWinners} />
        </div>
      </section>

      {/* ── 功能亮點 ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-10">
          為什麼選擇 PrizeDraw？
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { icon: "🛒", title: "交易市集", desc: "賞品直接在平台交易，安全有保障", href: "/trade" },
            { icon: "🔄", title: "賞品交換", desc: "與其他玩家互換喜愛的賞品", href: "/exchange" },
            { icon: "📦", title: "實體寄送", desc: "申請寄送服務，實體賞品直送到府", href: "/prizes" },
            { icon: "💳", title: "收益提領", desc: "交易所得可直接提領至銀行帳戶", href: "/wallet" },
          ].map((f) => (
            <Link key={f.href} href={f.href} className="group">
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-center hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200 group-hover:-translate-y-1">
                <div className="text-4xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
