'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/apiClient';
import { CampaignCard, type CampaignCardData } from '@/components/CampaignCard';
import { CampaignCardSkeleton } from '@/components/LoadingSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

interface FavoriteCampaignDto {
  id: string;
  title: string;
  type: 'KUJI' | 'UNLIMITED';
  coverImageUrl?: string | null;
  pricePerDraw: number;
  status: string;
  remainingTickets?: number;
  totalTickets?: number;
  viewerCount?: number;
  isHot?: boolean;
  isFavorited: boolean;
}

interface FavoritesResponse {
  favorites: FavoriteCampaignDto[];
  totalCount: number;
  page: number;
  size: number;
}

type TabType = 'all' | 'kuji' | 'unlimited';

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toCardData(dto: FavoriteCampaignDto): CampaignCardData {
  return {
    id: dto.id,
    title: dto.title,
    type: dto.type === 'UNLIMITED' ? '無限賞' : '一番賞',
    coverImageUrl: dto.coverImageUrl,
    pricePerDraw: dto.pricePerDraw,
    status: dto.status,
    remainingTickets: dto.remainingTickets,
    totalTickets: dto.totalTickets,
    viewerCount: dto.viewerCount,
    isHot: dto.isHot,
    isFavorited: dto.isFavorited,
  };
}

function isUnavailable(status: string): boolean {
  return status === 'SOLD_OUT' || status === 'INACTIVE' || status === 'SUSPENDED';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: '進行中',
    SOLD_OUT: '已售完',
    INACTIVE: '已下架',
    SUSPENDED: '已暫停',
    DRAFT: '草稿',
  };
  return map[status] ?? status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [tab, setTab] = useState<TabType>('all');
  const [favorites, setFavorites] = useState<FavoriteCampaignDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const loadFavorites = useCallback(async (currentPage: number, currentTab: TabType) => {
    setLoading(true);
    setError(null);
    try {
      const typeParam =
        currentTab === 'kuji' ? 'kuji' : currentTab === 'unlimited' ? 'unlimited' : undefined;
      const query = new URLSearchParams({
        page: String(currentPage),
        size: String(PAGE_SIZE),
        ...(typeParam ? { type: typeParam } : {}),
      });
      const data = await apiClient.get<FavoritesResponse>(
        `/api/v1/players/me/favorites?${query.toString()}`,
      );
      setFavorites(data.favorites ?? []);
      setTotalCount(data.totalCount ?? 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '載入失敗，請稍後再試';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites(page, tab);
    }
  }, [isAuthenticated, page, tab, loadFavorites]);

  function handleTabChange(newTab: TabType) {
    setTab(newTab);
    setPage(1);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!isAuthenticated) {
    return null;
  }

  const TABS: { id: TabType; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'kuji', label: '一番賞' },
    { id: 'unlimited', label: '無限賞' },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl text-red-500 leading-none">♥</span>
              <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
                我的收藏
              </h1>
            </div>
            <p className="text-sm text-on-surface-variant mt-1 ml-10">
              {loading ? '' : `共 ${totalCount} 個活動`}
            </p>
          </div>

          {/* Type filter tabs */}
          <div className="flex bg-surface-container-low p-1.5 rounded-full shadow-inner self-start shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  tab === t.id
                    ? 'bg-surface-container-highest text-primary shadow-lg'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-surface-container-high flex items-center justify-between">
            <span className="text-sm text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </span>
            <button
              onClick={() => loadFavorites(page, tab)}
              className="text-sm font-bold text-primary hover:opacity-80"
            >
              重試
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mb-6">
              <span className="text-5xl text-on-surface-variant opacity-20 leading-none">♡</span>
            </div>
            <h3 className="font-headline font-bold text-2xl text-on-surface mb-2">
              還沒有收藏的活動
            </h3>
            <p className="text-on-surface-variant max-w-xs mx-auto mb-8 text-sm">
              還沒有收藏的活動，去逛逛吧！
            </p>
            <Link
              href="/campaigns"
              className="px-8 py-3 rounded-full amber-gradient text-on-primary font-bold text-sm uppercase tracking-widest shadow-xl"
            >
              瀏覽活動
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favorites.map((fav) => {
                const unavailable = isUnavailable(fav.status);
                return (
                  <div
                    key={fav.id}
                    className={`relative ${unavailable ? 'opacity-50' : ''}`}
                  >
                    {unavailable && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-surface-container-highest text-on-surface-variant">
                          {statusLabel(fav.status)}
                        </span>
                      </div>
                    )}
                    <CampaignCard campaign={toCardData(fav)} />
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-sm font-bold text-on-surface disabled:opacity-40 hover:bg-surface-container-high transition-colors"
                >
                  上一頁
                </button>
                <span className="text-sm text-on-surface-variant tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-sm font-bold text-on-surface disabled:opacity-40 hover:bg-surface-container-high transition-colors"
                >
                  下一頁
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
