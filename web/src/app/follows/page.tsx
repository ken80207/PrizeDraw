"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFollowStore } from "@/stores/followStore";
import { useAuthStore } from "@/stores/authStore";
import type { FollowPlayerDto } from "@/services/followService";

const PAGE_LIMIT = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────

function PlayerAvatar({
  avatarUrl,
  nickname,
  size = "md",
}: {
  avatarUrl: string | null;
  nickname: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-9 h-9 text-sm" : "w-11 h-11 text-base";
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-[#ffc174] to-[#f59e0b] flex items-center justify-center text-[#472a00] font-bold shrink-0 overflow-hidden`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={nickname} className="w-full h-full object-cover" />
      ) : (
        <span>{nickname?.charAt(0)?.toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player row item
// ─────────────────────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  onFollow,
  onUnfollow,
  loading,
}: {
  player: FollowPlayerDto;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  loading: boolean;
}) {
  const t = useTranslations("follow");
  const isFollowing = player.isFollowing;

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[#1e1e32] hover:bg-[#252540] transition-colors">
      <PlayerAvatar avatarUrl={player.avatarUrl} nickname={player.nickname} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#e2e0fc] truncate">{player.nickname}</p>
        <p className="text-xs text-[#d8c3ad]/60 font-mono tracking-wider">{player.playerCode}</p>
      </div>
      <button
        onClick={() =>
          isFollowing ? onUnfollow(player.playerId) : onFollow(player.playerId)
        }
        disabled={loading}
        className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-50 ${
          isFollowing
            ? "border border-[#534434]/40 text-[#d8c3ad] hover:border-[#ffb4ab]/40 hover:text-[#ffb4ab]"
            : "amber-gradient text-[#472a00] hover:opacity-90 shadow-md"
        }`}
      >
        {isFollowing ? t("unfollow") : t("follow")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FollowsPage() {
  const t = useTranslations("follow");
  const player = useAuthStore((s) => s.player);

  const {
    followingList,
    followingTotal,
    followingLoading,
    followersList,
    followersTotal,
    followersLoading,
    searchResult,
    searchLoading,
    fetchFollowing,
    fetchFollowers,
    search,
    clearSearch,
    follow,
    unfollow,
  } = useFollowStore();

  const [activeTab, setActiveTab] = useState<"following" | "followers">("following");
  const [searchCode, setSearchCode] = useState("");
  const [followingOffset, setFollowingOffset] = useState(0);
  const [followersOffset, setFollowersOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadFollowing = useCallback(
    (offset: number) => {
      fetchFollowing(PAGE_LIMIT, offset);
    },
    [fetchFollowing],
  );

  const loadFollowers = useCallback(
    (offset: number) => {
      fetchFollowers(PAGE_LIMIT, offset);
    },
    [fetchFollowers],
  );

  useEffect(() => {
    loadFollowing(0);
    loadFollowers(0);
  }, [loadFollowing, loadFollowers]);

  function handleSearch() {
    const code = searchCode.trim();
    if (!code) return;
    search(code);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  async function handleFollow(playerId: string) {
    setActionLoading(playerId);
    try {
      await follow(playerId);
      // Refresh lists so isFollowing flags stay in sync
      loadFollowing(followingOffset);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnfollow(playerId: string) {
    setActionLoading(playerId);
    try {
      await unfollow(playerId);
      loadFollowing(followingOffset);
    } finally {
      setActionLoading(null);
    }
  }

  function handleLoadMoreFollowing() {
    const next = followingOffset + PAGE_LIMIT;
    setFollowingOffset(next);
    loadFollowing(next);
  }

  function handleLoadMoreFollowers() {
    const next = followersOffset + PAGE_LIMIT;
    setFollowersOffset(next);
    loadFollowers(next);
  }

  const hasMoreFollowing = followingTotal > followingList.length;
  const hasMoreFollowers = followersTotal > followersList.length;

  return (
    <div className="min-h-screen bg-[#111125]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[#ffc174] text-3xl leading-none">
              group
            </span>
            <h1 className="font-headline font-extrabold text-3xl text-[#e2e0fc] tracking-tight">
              {t("following")} / {t("followers")}
            </h1>
          </div>
          {player && (
            <p className="text-sm text-[#d8c3ad] mt-1 ml-10">
              {t("followingCount", { count: player.followingCount ?? 0 })}
              {"　"}
              {t("followerCount", { count: player.followerCount ?? 0 })}
            </p>
          )}
        </div>

        {/* Search section */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <h2 className="font-headline text-base font-bold text-[#e2e0fc] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-xl">
              person_search
            </span>
            {t("search")}
          </h2>

          {/* Search input row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#0c0c1f] rounded-xl px-3 py-2.5">
              <span className="material-symbols-outlined text-[#d8c3ad]/50 text-base shrink-0">
                search
              </span>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => {
                  setSearchCode(e.target.value);
                  if (!e.target.value.trim()) clearSearch();
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("searchPlaceholder")}
                className="flex-1 bg-transparent text-sm text-[#e2e0fc] placeholder:text-[#d8c3ad]/40 focus:outline-none"
              />
              {searchCode && (
                <button
                  onClick={() => {
                    setSearchCode("");
                    clearSearch();
                  }}
                  className="text-[#d8c3ad]/40 hover:text-[#d8c3ad] transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchCode.trim() || searchLoading}
              className="px-4 py-2.5 rounded-xl amber-gradient text-[#472a00] text-sm font-bold disabled:opacity-40 transition-opacity shrink-0"
            >
              {searchLoading ? (
                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-base">search</span>
              )}
            </button>
          </div>

          {/* Search result */}
          {searchLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#d8c3ad]/60">
              <span className="material-symbols-outlined animate-spin text-base">
                progress_activity
              </span>
              搜尋中…
            </div>
          )}

          {!searchLoading && searchResult === null && searchCode.trim() && (
            <p className="mt-4 text-sm text-[#d8c3ad]/60 text-center py-4">
              {t("noResults")}
            </p>
          )}

          {!searchLoading && searchResult && (
            <div className="mt-4">
              <PlayerRow
                player={searchResult}
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
                loading={actionLoading === searchResult.playerId}
              />
            </div>
          )}
        </section>

        {/* Tabs */}
        <section className="bg-[#1e1e32] rounded-2xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[#2a2a45]">
            {(["following", "followers"] as const).map((tab) => {
              const count =
                tab === "following" ? followingTotal : followersTotal;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3.5 text-sm font-bold transition-all relative ${
                    isActive
                      ? "text-[#ffc174]"
                      : "text-[#d8c3ad]/60 hover:text-[#d8c3ad]"
                  }`}
                >
                  {t(tab)}
                  <span
                    className={`ml-1.5 text-xs tabular-nums ${
                      isActive ? "text-[#ffc174]/70" : "text-[#d8c3ad]/40"
                    }`}
                  >
                    {count}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-[#ffc174]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-2">
            {activeTab === "following" && (
              <>
                {followingLoading && followingList.length === 0 ? (
                  <SkeletonList count={4} />
                ) : followingList.length === 0 ? (
                  <EmptyState message={t("emptyFollowing")} icon="person_add" />
                ) : (
                  <>
                    {followingList.map((p) => (
                      <PlayerRow
                        key={p.playerId}
                        player={p}
                        onFollow={handleFollow}
                        onUnfollow={handleUnfollow}
                        loading={actionLoading === p.playerId}
                      />
                    ))}
                    {hasMoreFollowing && (
                      <LoadMoreButton
                        loading={followingLoading}
                        onClick={handleLoadMoreFollowing}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {activeTab === "followers" && (
              <>
                {followersLoading && followersList.length === 0 ? (
                  <SkeletonList count={4} />
                ) : followersList.length === 0 ? (
                  <EmptyState message={t("emptyFollowers")} icon="group_add" />
                ) : (
                  <>
                    {followersList.map((p) => (
                      <PlayerRow
                        key={p.playerId}
                        player={p}
                        onFollow={handleFollow}
                        onUnfollow={handleUnfollow}
                        loading={actionLoading === p.playerId}
                      />
                    ))}
                    {hasMoreFollowers && (
                      <LoadMoreButton
                        loading={followersLoading}
                        onClick={handleLoadMoreFollowers}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Supporting components
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonList({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[#1e1e32] animate-pulse"
        >
          <div className="w-11 h-11 rounded-full bg-[#2a2a45] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#2a2a45] rounded w-1/3" />
            <div className="h-2.5 bg-[#2a2a45] rounded w-1/5" />
          </div>
          <div className="w-16 h-7 rounded-full bg-[#2a2a45]" />
        </div>
      ))}
    </>
  );
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 rounded-full bg-[#0c0c1f] flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-[#d8c3ad]/20">{icon}</span>
      </div>
      <p className="text-sm text-[#d8c3ad]/50">{message}</p>
    </div>
  );
}

function LoadMoreButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="pt-2 flex justify-center">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-6 py-2 rounded-full text-sm font-bold text-[#ffc174] border border-[#ffc174]/20 hover:bg-[#ffc174]/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined animate-spin text-base">
              progress_activity
            </span>
            載入中…
          </span>
        ) : (
          "載入更多"
        )}
      </button>
    </div>
  );
}
