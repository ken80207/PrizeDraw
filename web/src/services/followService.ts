import { apiClient } from "./apiClient";

export interface FollowPlayerDto {
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  playerCode: string;
  isFollowing: boolean;
}

export interface FollowListResponse {
  items: FollowPlayerDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface FollowStatusResponse {
  isFollowing: boolean;
}

export interface BatchFollowStatusResponse {
  statuses: Record<string, boolean>;
}

export interface PlayerSearchResponse {
  player: FollowPlayerDto | null;
}

// POST /api/v1/follows/{playerId}
export async function followPlayer(playerId: string): Promise<void> {
  await apiClient.post(`/api/v1/follows/${playerId}`);
}

// DELETE /api/v1/follows/{playerId}
export async function unfollowPlayer(playerId: string): Promise<void> {
  await apiClient.delete(`/api/v1/follows/${playerId}`);
}

// GET /api/v1/follows/following?limit=20&offset=0
export async function getFollowing(
  limit = 20,
  offset = 0,
): Promise<FollowListResponse> {
  return apiClient.get<FollowListResponse>(
    `/api/v1/follows/following?limit=${limit}&offset=${offset}`,
  );
}

// GET /api/v1/follows/followers?limit=20&offset=0
export async function getFollowers(
  limit = 20,
  offset = 0,
): Promise<FollowListResponse> {
  return apiClient.get<FollowListResponse>(
    `/api/v1/follows/followers?limit=${limit}&offset=${offset}`,
  );
}

// GET /api/v1/follows/{playerId}/status
export async function getFollowStatus(playerId: string): Promise<boolean> {
  const response = await apiClient.get<FollowStatusResponse>(
    `/api/v1/follows/${playerId}/status`,
  );
  return response.isFollowing;
}

// POST /api/v1/follows/batch-status
export async function batchFollowStatus(
  playerIds: string[],
): Promise<Record<string, boolean>> {
  const response = await apiClient.post<BatchFollowStatusResponse>(
    `/api/v1/follows/batch-status`,
    { playerIds },
  );
  return response.statuses;
}

// GET /api/v1/players/search?code={code}
export async function searchPlayerByCode(
  code: string,
): Promise<FollowPlayerDto | null> {
  const response = await apiClient.get<PlayerSearchResponse>(
    `/api/v1/players/search?code=${encodeURIComponent(code)}`,
  );
  return response.player;
}
