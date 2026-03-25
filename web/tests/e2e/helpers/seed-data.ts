/**
 * Seed data constants for E2E tests.
 *
 * These accounts and campaigns are created by the global-setup script before
 * the test suite runs. All IDs are populated at runtime via globalThis after
 * the seed API calls complete — see global-setup.ts for the population logic.
 */

export const TEST_ACCOUNTS = {
  playerA: {
    nickname: '玩家小明',
    provider: 'GOOGLE' as const,
    idToken: 'test-player-a-token',
    phone: '+886912000001',
    otp: '123456', // mock OTP in test mode
  },
  playerB: {
    nickname: '玩家小花',
    provider: 'GOOGLE' as const,
    idToken: 'test-player-b-token',
    phone: '+886912000002',
    otp: '123456',
  },
  playerC: {
    nickname: '觀戰者小王',
    provider: 'GOOGLE' as const,
    idToken: 'test-player-c-token',
    phone: '+886912000003',
    otp: '123456',
  },
  staff: {
    email: 'cs@prizedraw.tw',
    password: 'Test1234!',
    role: 'CUSTOMER_SERVICE' as const,
  },
  admin: {
    email: 'admin@prizedraw.tw',
    password: 'Admin1234!',
    role: 'ADMIN' as const,
  },
};

export const TEST_CAMPAIGNS = {
  kuji: {
    title: '測試一番賞 — E2E',
    pricePerDraw: 100,
    drawSessionSeconds: 300,
    ticketBoxes: [
      {
        name: '籤盒 A',
        totalTickets: 10,
        prizes: [
          { grade: 'A賞', name: '限定公仔', count: 1, buybackPrice: 500 },
          { grade: 'B賞', name: '精緻模型', count: 2, buybackPrice: 200 },
          { grade: 'C賞', name: '吊飾組', count: 3, buybackPrice: 50 },
          { grade: 'D賞', name: '貼紙包', count: 4, buybackPrice: 10 },
        ],
      },
    ],
  },
  unlimited: {
    title: '測試無限賞 — E2E',
    pricePerDraw: 50,
    rateLimitPerSecond: 5,
    prizes: [
      { grade: 'A賞', name: '超稀有公仔', probabilityBps: 5000 }, // 0.5%
      { grade: 'B賞', name: '精品模型', probabilityBps: 30000 }, // 3%
      { grade: 'C賞', name: '造型吊飾', probabilityBps: 165000 }, // 16.5%
      { grade: 'D賞', name: '隨機貼紙', probabilityBps: 800000 }, // 80%
    ],
  },
};

/**
 * Runtime IDs populated by global-setup after seeding.
 * Access as: import { SEEDED_IDS } from './seed-data';
 */
export const SEEDED_IDS: {
  kujiCampaignId: string;
  unlimitedCampaignId: string;
  playerAToken: string;
  playerBToken: string;
  playerCToken: string;
  adminToken: string;
  staffToken: string;
} = {
  kujiCampaignId: process.env.TEST_KUJI_CAMPAIGN_ID ?? '',
  unlimitedCampaignId: process.env.TEST_UNLIMITED_CAMPAIGN_ID ?? '',
  playerAToken: process.env.TEST_PLAYER_A_TOKEN ?? '',
  playerBToken: process.env.TEST_PLAYER_B_TOKEN ?? '',
  playerCToken: process.env.TEST_PLAYER_C_TOKEN ?? '',
  adminToken: process.env.TEST_ADMIN_TOKEN ?? '',
  staffToken: process.env.TEST_STAFF_TOKEN ?? '',
};
