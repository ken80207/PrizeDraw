package com.prizedraw.contracts.endpoints

public object PlayerEndpoints {
    public const val ME: String = "/api/v1/players/me"
    public const val ME_PRIZES: String = "/api/v1/players/me/prizes"
    public const val ME_PRIZE_DETAIL: String = "/api/v1/players/me/prizes/{prizeId}"
    public const val ME_WALLET: String = "/api/v1/players/me/wallet"
    public const val ME_COUPONS: String = "/api/v1/players/me/coupons"
    public const val ME_ANIMATION_PREFERENCE: String = "/api/v1/players/me/preferences/animation"
    public const val PUBLIC_PRIZES: String = "/api/v1/players/{playerId}/prizes/public"
    public const val ME_LEVEL: String = "/api/v1/players/me/level"
    public const val ME_XP_HISTORY: String = "/api/v1/players/me/xp-history"
}
