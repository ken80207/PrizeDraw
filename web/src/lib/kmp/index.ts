/**
 * KMP-JS bridge for PrizeDraw validation logic.
 *
 * This module lazy-loads the Kotlin/JS compiled output from `kmp-shared-js` and
 * exposes a stable TypeScript interface. If the KMP module is unavailable (e.g.
 * during tests or before the first build), it falls back to a pure-JS implementation
 * that mirrors the same business rules.
 *
 * Usage:
 * ```typescript
 * const v = await getValidation();
 * if (v.canAffordDraw(balance, price, qty)) { ... }
 * ```
 *
 * In production the KMP bundle lives at:
 *   `kmp-shared-js/build/dist/js/productionLibrary/prizedraw-kmp.js`
 * Configure your Next.js / Webpack setup to copy or alias that file.
 */

// ---------------------------------------------------------------------------
// Public interface — matches the KMP @JsExport surface exactly
// ---------------------------------------------------------------------------

export interface PrizeDrawValidation {
  /** Returns true when balance >= pricePerDraw * quantity. */
  canAffordDraw(balance: number, pricePerDraw: number, quantity: number): boolean;

  /**
   * Total cost for quantity draws at pricePerDraw with an optional discountBps.
   * discountBps = 0 means no discount. Result is ceiling-rounded.
   */
  calculateTotalCost(pricePerDraw: number, quantity: number, discountBps: number): number;

  /** Discounted unit price for a single draw after applying discountBps. */
  calculateDiscountedPrice(originalPrice: number, discountBps: number): number;

  /**
   * Returns true when the IntArray of probabilities sums to exactly 1 000 000 bps
   * (100% prize coverage).
   */
  validateProbabilitySum(probabilities: number[]): boolean;

  /**
   * Formats a basis-point probability as a percentage string with 4 decimal places.
   * Example: 50000 → "5.0000%"
   */
  formatProbabilityBps(bps: number): string;

  /** Returns true when phone is a valid E.164 number (e.g. "+886912345678"). */
  isValidPhone(phone: string): boolean;

  /**
   * Formats a Taiwan E.164 number for display (e.g. "+886912345678" → "0912-345-678").
   * Non-Taiwan numbers are returned unchanged.
   */
  formatPhoneForDisplay(phone: string): string;

  /**
   * Returns true when the coupon has expired.
   * Pass -1 for validUntilEpochMs to represent "never expires".
   */
  isCouponExpired(validUntilEpochMs: number): boolean;

  /** Calculates the discount amount (in points) for originalPrice at discountRateBps. */
  calculateCouponDiscount(originalPrice: number, discountRateBps: number): number;
}

// ---------------------------------------------------------------------------
// Module cache — populated on first call to getValidation()
// ---------------------------------------------------------------------------

let _validation: PrizeDrawValidation | null = null;

/**
 * Returns the PrizeDrawValidation implementation, preferring the KMP/JS compiled
 * module and falling back to the pure-JS implementation if the KMP bundle is
 * not available (e.g. local dev without a prior Gradle build).
 */
export async function getValidation(): Promise<PrizeDrawValidation> {
  if (_validation !== null) return _validation;

  try {
    // Dynamic import — resolved by Webpack/Next.js at bundle time.
    // The KMP output path is relative to the Next.js public directory or a
    // configured Webpack alias `@kmp` → `kmp-shared-js/build/dist/js/productionLibrary`.
    // KMP artifact is generated at build time and is not present in the source tree.
    // We use a variable path to avoid TypeScript module resolution errors.
    const kmpPath =
      "../../../../../../kmp-shared-js/build/dist/js/productionLibrary/prizedraw-kmp.js" as string;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const mod = (await (new Function("p", "return import(p)")(kmpPath) as Promise<unknown>)) as Record<string, unknown>;
    // The KMP JS IR compiler nests exports under the package path.
    const kmpObj = (mod as unknown as { com?: { prizedraw?: { shared?: { PrizeDrawValidation?: PrizeDrawValidation } } } })?.com?.prizedraw?.shared?.PrizeDrawValidation as
      | PrizeDrawValidation
      | undefined;

    if (kmpObj != null) {
      _validation = kmpObj;
      return _validation;
    }
    // KMP module loaded but object not found — use fallback.
  } catch {
    // KMP module not built yet or path unavailable — use fallback silently.
  }

  _validation = fallbackValidation;
  return _validation;
}

/**
 * Synchronous accessor for the validation implementation.
 *
 * Returns `null` until `getValidation()` has been awaited at least once.
 * Prefer `getValidation()` in async contexts; use this only when async is
 * unavoidable (e.g. form-field onChange handlers that must be synchronous).
 */
export function getValidationSync(): PrizeDrawValidation {
  return _validation ?? fallbackValidation;
}

// ---------------------------------------------------------------------------
// Pure-JS fallback — identical business rules, no KMP dependency
// ---------------------------------------------------------------------------

const fallbackValidation: PrizeDrawValidation = {
  canAffordDraw: (balance, pricePerDraw, quantity) =>
    balance >= pricePerDraw * quantity,

  calculateTotalCost: (pricePerDraw, quantity, discountBps) => {
    const gross = pricePerDraw * quantity;
    if (discountBps <= 0) return gross;
    // Ceiling: Math.ceil(gross * (10_000 - discount) / 10_000)
    return Math.ceil((gross * (10_000 - discountBps)) / 10_000);
  },

  calculateDiscountedPrice: (originalPrice, discountBps) => {
    const clamped = Math.max(1, Math.min(9_999, discountBps));
    return Math.ceil((originalPrice * (10_000 - clamped)) / 10_000);
  },

  validateProbabilitySum: (probabilities) => {
    if (probabilities.length === 0) return false;
    return probabilities.reduce((sum, p) => sum + p, 0) === 1_000_000;
  },

  formatProbabilityBps: (bps) => {
    const pct = (bps / 1_000_000) * 100;
    return `${pct.toFixed(4)}%`;
  },

  isValidPhone: (phone) => /^\+[1-9]\d{6,14}$/.test(phone),

  formatPhoneForDisplay: (phone) => {
    if (!phone.startsWith("+886")) return phone;
    const local = "0" + phone.slice(4); // "+886912345678" → "0912345678"
    if (local.length !== 10) return phone;
    return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7)}`;
  },

  isCouponExpired: (validUntilEpochMs) => {
    if (validUntilEpochMs < 0) return false;
    return Date.now() > validUntilEpochMs;
  },

  calculateCouponDiscount: (originalPrice, discountRateBps) => {
    if (discountRateBps <= 0) return 0;
    return Math.floor((originalPrice * discountRateBps) / 10_000);
  },
};
