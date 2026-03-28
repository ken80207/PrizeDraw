const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface LiveDrawItem {
  sessionId: string;
  playerId: string;
  nickname: string;
  campaignId: string;
  campaignTitle: string;
  quantity: number;
}

interface LiveDrawsResponse {
  items: LiveDrawItem[];
}

export async function fetchLiveDraws(): Promise<LiveDrawItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/live-draws`);
  if (!res.ok) return [];
  const data: LiveDrawsResponse = await res.json();
  return data.items ?? [];
}
