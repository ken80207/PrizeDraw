/**
 * Follow state store backed by Zustand.
 *
 * Manages following/followers lists, player search, and a follow-status
 * cache keyed by playerId — used by the chat room to render follow buttons
 * without individual per-player round trips.
 */

import { create } from "zustand";
import type { FollowPlayerDto } from "@/services/followService";
import {
  followPlayer,
  unfollowPlayer,
  getFollowing,
  getFollowers,
  searchPlayerByCode,
  batchFollowStatus,
} from "@/services/followService";

export interface FollowStore {
  // Following list
  followingList: FollowPlayerDto[];
  followingTotal: number;
  followingLoading: boolean;

  // Followers list
  followersList: FollowPlayerDto[];
  followersTotal: number;
  followersLoading: boolean;

  // Search
  searchResult: FollowPlayerDto | null;
  searchLoading: boolean;

  // Chat room follow status cache (playerId → isFollowing)
  followStatusCache: Record<string, boolean>;

  // Actions
  fetchFollowing: (limit?: number, offset?: number) => Promise<void>;
  fetchFollowers: (limit?: number, offset?: number) => Promise<void>;
  follow: (playerId: string) => Promise<void>;
  unfollow: (playerId: string) => Promise<void>;
  search: (code: string) => Promise<void>;
  clearSearch: () => void;
  preloadFollowStatuses: (playerIds: string[]) => Promise<void>;
  isFollowing: (playerId: string) => boolean;
}

export const useFollowStore = create<FollowStore>((set, get) => ({
  followingList: [],
  followingTotal: 0,
  followingLoading: false,

  followersList: [],
  followersTotal: 0,
  followersLoading: false,

  searchResult: null,
  searchLoading: false,

  followStatusCache: {},

  async fetchFollowing(limit = 20, offset = 0) {
    set({ followingLoading: true });
    try {
      const response = await getFollowing(limit, offset);
      set({ followingList: response.items, followingTotal: response.total });
    } finally {
      set({ followingLoading: false });
    }
  },

  async fetchFollowers(limit = 20, offset = 0) {
    set({ followersLoading: true });
    try {
      const response = await getFollowers(limit, offset);
      set({ followersList: response.items, followersTotal: response.total });
    } finally {
      set({ followersLoading: false });
    }
  },

  async follow(playerId: string) {
    await followPlayer(playerId);
    set((state) => ({
      followStatusCache: { ...state.followStatusCache, [playerId]: true },
    }));
  },

  async unfollow(playerId: string) {
    await unfollowPlayer(playerId);
    set((state) => ({
      followStatusCache: { ...state.followStatusCache, [playerId]: false },
    }));
  },

  async search(code: string) {
    set({ searchLoading: true });
    try {
      const result = await searchPlayerByCode(code);
      set({ searchResult: result });
    } finally {
      set({ searchLoading: false });
    }
  },

  clearSearch() {
    set({ searchResult: null });
  },

  async preloadFollowStatuses(playerIds: string[]) {
    const statuses = await batchFollowStatus(playerIds);
    set((state) => ({
      followStatusCache: { ...state.followStatusCache, ...statuses },
    }));
  },

  isFollowing(playerId: string) {
    return get().followStatusCache[playerId] ?? false;
  },
}));
