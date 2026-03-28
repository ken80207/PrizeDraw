/**
 * Shared type definitions for auth store — mirrors the server-side PlayerDto contract.
 */
export interface PlayerDto {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  drawPointsBalance: number;
  revenuePointsBalance: number;
  preferredAnimationMode: string;
  locale: string;
  isActive: boolean;
  createdAt: string;
  playerCode: string;
  followerCount: number;
  followingCount: number;
}
