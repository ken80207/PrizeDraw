/**
 * Direct API helpers for test setup — bypass the UI for operations that are
 * pure infrastructure (top-ups, campaign creation, balance checks, etc.).
 *
 * All functions accept an authorization token obtained via auth.ts helpers.
 */

const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PointsBalance {
  draw: number;
  revenue: number;
}

export interface PrizeInventoryItem {
  id: string;
  grade: string;
  name: string;
  campaignTitle: string;
  status: string;
  buybackPrice: number;
}

export interface CampaignCreatePayload {
  type: 'KUJI' | 'UNLIMITED';
  title: string;
  pricePerDraw: number;
  drawSessionSeconds?: number;
  rateLimitPerSecond?: number;
  ticketBoxes?: TicketBoxPayload[];
  prizes?: UnlimitedPrizePayload[];
}

export interface TicketBoxPayload {
  name: string;
  totalTickets: number;
  prizes: {
    grade: string;
    name: string;
    count: number;
    buybackPrice: number;
  }[];
}

export interface UnlimitedPrizePayload {
  grade: string;
  name: string;
  probabilityBps: number;
}

export interface ListingItem {
  id: string;
  prizeId: string;
  price: number;
  seller: { id: string; nickname: string };
  status: string;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/**
 * Create a kuji campaign via the admin API.
 * Returns the new campaign ID.
 */
export async function createKujiCampaign(
  adminToken: string,
  campaign: CampaignCreatePayload,
): Promise<string> {
  const res = await apiFetch('/api/v1/admin/campaigns', {
    method: 'POST',
    token: adminToken,
    body: campaign,
  });

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Publish a draft campaign so players can see and interact with it.
 */
export async function publishCampaign(adminToken: string, campaignId: string): Promise<void> {
  await apiFetch(`/api/v1/admin/campaigns/${campaignId}/publish`, {
    method: 'POST',
    token: adminToken,
  });
}

/**
 * Suspend an active campaign.
 */
export async function suspendCampaign(adminToken: string, campaignId: string): Promise<void> {
  await apiFetch(`/api/v1/admin/campaigns/${campaignId}/suspend`, {
    method: 'POST',
    token: adminToken,
  });
}

// ---------------------------------------------------------------------------
// Points & Wallet
// ---------------------------------------------------------------------------

/**
 * Top up draw points for a player by using the test payment mock endpoint.
 * This endpoint is only available when the server runs with APP_ENV=test.
 */
export async function topUpPoints(playerToken: string, amount: number): Promise<void> {
  await apiFetch('/api/v1/payments/mock-topup', {
    method: 'POST',
    token: playerToken,
    body: { amount, pointType: 'DRAW' },
  });
}

/**
 * Top up revenue points directly (used to set up withdrawal tests).
 */
export async function topUpRevenuePoints(playerToken: string, amount: number): Promise<void> {
  await apiFetch('/api/v1/payments/mock-topup', {
    method: 'POST',
    token: playerToken,
    body: { amount, pointType: 'REVENUE' },
  });
}

/**
 * Fetch the current draw-point and revenue-point balances for the authenticated player.
 */
export async function getPlayerBalance(playerToken: string): Promise<PointsBalance> {
  const res = await apiFetch('/api/v1/wallet/balance', {
    method: 'GET',
    token: playerToken,
  });
  return res.json() as Promise<PointsBalance>;
}

// ---------------------------------------------------------------------------
// Prize Inventory
// ---------------------------------------------------------------------------

/**
 * Fetch the prize inventory for the authenticated player.
 */
export async function getPrizeInventory(playerToken: string): Promise<PrizeInventoryItem[]> {
  const res = await apiFetch('/api/v1/prizes', {
    method: 'GET',
    token: playerToken,
  });
  const data = (await res.json()) as { items: PrizeInventoryItem[] } | PrizeInventoryItem[];
  return Array.isArray(data) ? data : data.items;
}

// ---------------------------------------------------------------------------
// Trade / Marketplace
// ---------------------------------------------------------------------------

/**
 * List a prize on the marketplace.
 * Returns the listing ID.
 */
export async function createListing(
  playerToken: string,
  prizeId: string,
  price: number,
): Promise<string> {
  const res = await apiFetch('/api/v1/trade/listings', {
    method: 'POST',
    token: playerToken,
    body: { prizeId, price },
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Fetch all active listings on the marketplace.
 */
export async function getListings(playerToken: string): Promise<ListingItem[]> {
  const res = await apiFetch('/api/v1/trade/listings', {
    method: 'GET',
    token: playerToken,
  });
  const data = (await res.json()) as { items: ListingItem[] } | ListingItem[];
  return Array.isArray(data) ? data : data.items;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

/**
 * Create a discount coupon via the admin API.
 * Returns the coupon ID.
 */
export async function createCoupon(
  adminToken: string,
  payload: {
    code: string;
    discountPercent: number;
    usageLimit: number;
    expiresAt?: string;
  },
): Promise<string> {
  const res = await apiFetch('/api/v1/admin/coupons', {
    method: 'POST',
    token: adminToken,
    body: payload,
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

/**
 * Create an unlimited campaign via the admin API.
 */
export async function createUnlimitedCampaign(
  adminToken: string,
  campaign: CampaignCreatePayload,
): Promise<string> {
  const res = await apiFetch('/api/v1/admin/campaigns/unlimited', {
    method: 'POST',
    token: adminToken,
    body: campaign,
  });
  const data = (await res.json()) as { campaign?: { id: string }; id?: string };
  return data.campaign?.id ?? data.id ?? '';
}

/**
 * Get campaign status from admin API.
 */
export async function getCampaignStatus(
  adminToken: string,
  campaignId: string,
): Promise<string> {
  const res = await apiFetch(`/api/v1/admin/campaigns/${campaignId}`, {
    method: 'GET',
    token: adminToken,
  });
  const data = (await res.json()) as { status: string };
  return data.status;
}

/**
 * Draw a kuji ticket via the draw service API.
 */
export async function drawKujiTicket(
  playerToken: string,
  ticketBoxId: string,
  quantity: number = 1,
  ticketIds: string[] = [],
): Promise<Record<string, unknown>> {
  const res = await apiFetch('/api/v1/draws/kuji', {
    method: 'POST',
    token: playerToken,
    body: { ticketBoxId, quantity, ticketIds },
  });
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Draw unlimited prizes.
 */
export async function drawUnlimited(
  playerToken: string,
  campaignId: string,
  count: number = 1,
): Promise<Record<string, unknown>> {
  const res = await apiFetch('/api/v1/draws/unlimited', {
    method: 'POST',
    token: playerToken,
    body: { campaignId, count },
  });
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Join queue for a kuji campaign.
 */
export async function joinQueue(
  playerToken: string,
  ticketBoxId: string,
): Promise<Record<string, unknown>> {
  const res = await apiFetch('/api/v1/draws/kuji/queue/join', {
    method: 'POST',
    token: playerToken,
    body: { ticketBoxId },
  });
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Publish a campaign by changing status to ACTIVE.
 * Handles the actual PATCH endpoint with confirmLowMargin.
 */
export async function activateCampaign(
  adminToken: string,
  campaignId: string,
  type: 'kuji' | 'unlimited' = 'kuji',
): Promise<void> {
  await apiFetch(`/api/v1/admin/campaigns/${campaignId}/status?type=${type}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE', confirmLowMargin: true },
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

interface FetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
}

async function apiFetch(path: string, options: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options.method} ${path} failed with status ${res.status}: ${text}`);
  }

  return res;
}
