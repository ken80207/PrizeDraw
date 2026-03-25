package com.prizedraw.shared.i18n

/**
 * Canonical string constant keys for all user-facing strings in the PrizeDraw platform.
 *
 * These keys must exactly match those defined in the server-side
 * `i18n/messages_zh_TW.properties` and `i18n/messages_en.properties` bundles.
 *
 * Usage on mobile (with Lyricist or custom provider):
 * ```kotlin
 * val title = strings[I18nKeys.Push.KUJI_YOUR_TURN_TITLE]
 * ```
 *
 * Usage on web (with next-intl):
 * ```typescript
 * const t = useTranslations()
 * t(I18nKeys.Auth.LOGIN_FAILED)
 * ```
 */
public object I18nKeys {
    /** General / shared error keys. */
    public object Error {
        public const val INTERNAL: String = "error.internal"
        public const val NOT_FOUND: String = "error.not_found"
        public const val UNAUTHORIZED: String = "error.unauthorized"
        public const val FORBIDDEN: String = "error.forbidden"
        public const val VALIDATION: String = "error.validation"
        public const val BAD_REQUEST: String = "error.bad_request"
    }

    /** Field-level validation message keys. */
    public object Validation {
        public const val REQUIRED: String = "validation.required"
        public const val MIN_LENGTH: String = "validation.min_length"
        public const val MAX_LENGTH: String = "validation.max_length"
        public const val INVALID_FORMAT: String = "validation.invalid_format"
        public const val INVALID_UUID: String = "validation.invalid_uuid"
        public const val PHONE_FORMAT: String = "validation.phone_format"
        public const val EMAIL_FORMAT: String = "validation.email_format"
        public const val AMOUNT_POSITIVE: String = "validation.amount_positive"
        public const val AMOUNT_RANGE: String = "validation.amount_range"
    }

    /** Authentication message keys. */
    public object Auth {
        public const val LOGIN_FAILED: String = "auth.login_failed"
        public const val TOKEN_EXPIRED: String = "auth.token_expired"
        public const val TOKEN_INVALID: String = "auth.token_invalid"
        public const val TOKEN_REPLAY: String = "auth.token_replay"
        public const val PHONE_ALREADY_BOUND: String = "auth.phone_already_bound"
        public const val PHONE_NOT_VERIFIED: String = "auth.phone_not_verified"
        public const val OTP_SENT: String = "auth.otp_sent"
        public const val OTP_INVALID: String = "auth.otp_invalid"
        public const val OTP_EXPIRED: String = "auth.otp_expired"
        public const val ACCOUNT_INACTIVE: String = "auth.account_inactive"
        public const val ACCOUNT_NOT_FOUND: String = "auth.account_not_found"
        public const val LOGOUT_SUCCESS: String = "auth.logout_success"
    }

    /** Player profile message keys. */
    public object Player {
        public const val NOT_FOUND: String = "player.not_found"
        public const val PROFILE_UPDATED: String = "player.profile_updated"
        public const val INSUFFICIENT_DRAW_POINTS: String = "player.insufficient_draw_points"
        public const val INSUFFICIENT_REVENUE_POINTS: String = "player.insufficient_revenue_points"
    }

    /** Campaign message keys. */
    public object Campaign {
        public const val NOT_FOUND: String = "campaign.not_found"
        public const val NOT_ACTIVE: String = "campaign.not_active"
        public const val SOLD_OUT: String = "campaign.sold_out"
        public const val SUSPENDED: String = "campaign.suspended"
        public const val DRAFT: String = "campaign.draft"
        public const val STATUS_UPDATED: String = "campaign.status_updated"
        public const val ALREADY_ACTIVE: String = "campaign.already_active"
        public const val PROBABILITY_INVALID: String = "campaign.probability_invalid"

        /** Campaign status display labels. */
        public object Status {
            public const val DRAFT: String = "campaign.status.draft"
            public const val ACTIVE: String = "campaign.status.active"
            public const val SUSPENDED: String = "campaign.status.suspended"
            public const val SOLD_OUT: String = "campaign.status.sold_out"
        }
    }

    /** Kuji draw message keys. */
    public object DrawKuji {
        public const val QUEUE_FULL: String = "draw.kuji.queue_full"
        public const val NOT_IN_QUEUE: String = "draw.kuji.not_in_queue"
        public const val SESSION_EXPIRED: String = "draw.kuji.session_expired"
        public const val TICKET_NOT_AVAILABLE: String = "draw.kuji.ticket_not_available"
        public const val TICKET_NOT_FOUND: String = "draw.kuji.ticket_not_found"
        public const val QUANTITY_EXCEEDED: String = "draw.kuji.quantity_exceeded"
        public const val INSUFFICIENT_REMAINING: String = "draw.kuji.insufficient_remaining"
        public const val SUCCESS: String = "draw.kuji.success"
        public const val MULTI_SUCCESS: String = "draw.kuji.multi_success"
    }

    /** Unlimited draw message keys. */
    public object DrawUnlimited {
        public const val RATE_LIMITED: String = "draw.unlimited.rate_limited"
        public const val SUCCESS: String = "draw.unlimited.success"
        public const val COUPON_INVALID: String = "draw.unlimited.coupon_invalid"
        public const val COUPON_EXPIRED: String = "draw.unlimited.coupon_expired"
    }

    /** Prize instance message keys. */
    public object Prize {
        public const val NOT_FOUND: String = "prize.not_found"
        public const val NOT_OWNED: String = "prize.not_owned"
        public const val STATE_INVALID: String = "prize.state_invalid"

        /** Prize grade display label keys. */
        public object Grade {
            public const val A: String = "prize.grade.a"
            public const val B: String = "prize.grade.b"
            public const val C: String = "prize.grade.c"
            public const val D: String = "prize.grade.d"
            public const val E: String = "prize.grade.e"
            public const val F: String = "prize.grade.f"
            public const val LAST: String = "prize.grade.last"
            public const val BONUS: String = "prize.grade.bonus"
        }

        /** Prize state display label keys. */
        public object State {
            public const val HOLDING: String = "prize.state.holding"
            public const val TRADING: String = "prize.state.trading"
            public const val EXCHANGING: String = "prize.state.exchanging"
            public const val PENDING_BUYBACK: String = "prize.state.pending_buyback"
            public const val PENDING_SHIPMENT: String = "prize.state.pending_shipment"
            public const val SHIPPED: String = "prize.state.shipped"
            public const val DELIVERED: String = "prize.state.delivered"
            public const val SOLD: String = "prize.state.sold"
            public const val RECYCLED: String = "prize.state.recycled"
        }
    }

    /** Trade marketplace message keys. */
    public object Trade {
        public const val LISTING_NOT_FOUND: String = "trade.listing_not_found"
        public const val LISTING_NOT_AVAILABLE: String = "trade.listing_not_available"
        public const val CANNOT_BUY_OWN: String = "trade.cannot_buy_own"
        public const val PURCHASE_SUCCESS: String = "trade.purchase_success"
        public const val LIST_SUCCESS: String = "trade.list_success"
        public const val CANCEL_SUCCESS: String = "trade.cancel_success"
        public const val SELLER_NOT_FOUND: String = "trade.seller_not_found"
        public const val CONCURRENT_PURCHASE: String = "trade.concurrent_purchase"
    }

    /** Exchange message keys. */
    public object Exchange {
        public const val OFFER_NOT_FOUND: String = "exchange.offer_not_found"
        public const val CANNOT_EXCHANGE_OWN: String = "exchange.cannot_exchange_own"
        public const val RECIPIENT_NOT_FOUND: String = "exchange.recipient_not_found"
        public const val OFFER_EXPIRED: String = "exchange.offer_expired"
        public const val OFFER_CANCELLED: String = "exchange.offer_cancelled"
        public const val ACCEPTED: String = "exchange.accepted"
        public const val REJECTED: String = "exchange.rejected"
        public const val COUNTER_PROPOSED: String = "exchange.counter_proposed"
    }

    /** Buyback message keys. */
    public object Buyback {
        public const val NOT_ELIGIBLE: String = "buyback.not_eligible"
        public const val SUCCESS: String = "buyback.success"
        public const val ALREADY_REQUESTED: String = "buyback.already_requested"
    }

    /** Shipping message keys. */
    public object Shipping {
        public const val ORDER_NOT_FOUND: String = "shipping.order_not_found"
        public const val ORDER_CREATED: String = "shipping.order_created"
        public const val ALREADY_SHIPPED: String = "shipping.already_shipped"
        public const val TRACKING_UPDATED: String = "shipping.tracking_updated"
        public const val DELIVERED: String = "shipping.delivered"
    }

    /** Payment message keys. */
    public object Payment {
        public const val ORDER_NOT_FOUND: String = "payment.order_not_found"
        public const val ORDER_FAILED: String = "payment.order_failed"
        public const val ORDER_ALREADY_PAID: String = "payment.order_already_paid"
        public const val GATEWAY_ERROR: String = "payment.gateway_error"
        public const val POINTS_CREDITED: String = "payment.points_credited"
        public const val REFUND_SUCCESS: String = "payment.refund_success"
    }

    /** Withdrawal message keys. */
    public object Withdrawal {
        public const val REQUEST_SUBMITTED: String = "withdrawal.request_submitted"
        public const val APPROVED: String = "withdrawal.approved"
        public const val REJECTED: String = "withdrawal.rejected"
        public const val INSUFFICIENT_BALANCE: String = "withdrawal.insufficient_balance"
        public const val NOT_FOUND: String = "withdrawal.not_found"
        public const val ALREADY_PROCESSED: String = "withdrawal.already_processed"
    }

    /** Coupon message keys. */
    public object Coupon {
        public const val NOT_FOUND: String = "coupon.not_found"
        public const val ALREADY_USED: String = "coupon.already_used"
        public const val EXPIRED: String = "coupon.expired"
        public const val NOT_APPLICABLE: String = "coupon.not_applicable"
        public const val MAX_USES_REACHED: String = "coupon.max_uses_reached"
        public const val REDEEMED: String = "coupon.redeemed"
        public const val DISCOUNT_CODE_INVALID: String = "coupon.discount_code_invalid"
        public const val DISCOUNT_CODE_EXHAUSTED: String = "coupon.discount_code_exhausted"
    }

    /** Customer support message keys. */
    public object Support {
        public const val TICKET_CREATED: String = "support.ticket_created"
        public const val TICKET_NOT_FOUND: String = "support.ticket_not_found"
        public const val TICKET_CLOSED: String = "support.ticket_closed"
        public const val REPLY_SENT: String = "support.reply_sent"
        public const val CANNOT_REPLY_CLOSED: String = "support.cannot_reply_closed"
    }

    /** Queue system message keys. */
    public object Queue {
        public const val JOINED: String = "queue.joined"
        public const val ACTIVATED: String = "queue.activated"
        public const val COMPLETED: String = "queue.completed"
        public const val ABANDONED: String = "queue.abandoned"
        public const val EVICTED: String = "queue.evicted"
        public const val POSITION_UPDATED: String = "queue.position_updated"
    }

    /** Push notification message keys. */
    public object Push {
        /** Kuji draw push notifications. */
        public object Kuji {
            public const val YOUR_TURN_TITLE: String = "push.kuji.your_turn.title"
            public const val YOUR_TURN_BODY: String = "push.kuji.your_turn.body"
            public const val DRAW_RESULT_TITLE: String = "push.kuji.draw_result.title"
            public const val DRAW_RESULT_BODY: String = "push.kuji.draw_result.body"
            public const val SOLD_OUT_TITLE: String = "push.kuji.sold_out.title"
            public const val SOLD_OUT_BODY: String = "push.kuji.sold_out.body"
        }

        /** Trade push notifications. */
        public object Trade {
            public const val PURCHASE_TITLE: String = "push.trade.purchase.title"
            public const val PURCHASE_BODY: String = "push.trade.purchase.body"
            public const val SOLD_TITLE: String = "push.trade.sold.title"
            public const val SOLD_BODY: String = "push.trade.sold.body"
        }

        /** Exchange push notifications. */
        public object Exchange {
            public const val RECEIVED_TITLE: String = "push.exchange.received.title"
            public const val RECEIVED_BODY: String = "push.exchange.received.body"
            public const val ACCEPTED_TITLE: String = "push.exchange.accepted.title"
            public const val ACCEPTED_BODY: String = "push.exchange.accepted.body"
            public const val REJECTED_TITLE: String = "push.exchange.rejected.title"
            public const val REJECTED_BODY: String = "push.exchange.rejected.body"
        }

        /** Shipping push notifications. */
        public object Shipping {
            public const val SHIPPED_TITLE: String = "push.shipping.shipped.title"
            public const val SHIPPED_BODY: String = "push.shipping.shipped.body"
            public const val DELIVERED_TITLE: String = "push.shipping.delivered.title"
            public const val DELIVERED_BODY: String = "push.shipping.delivered.body"
        }

        /** Payment push notifications. */
        public object Payment {
            public const val SUCCESS_TITLE: String = "push.payment.success.title"
            public const val SUCCESS_BODY: String = "push.payment.success.body"
        }

        /** Withdrawal push notifications. */
        public object Withdrawal {
            public const val APPROVED_TITLE: String = "push.withdrawal.approved.title"
            public const val APPROVED_BODY: String = "push.withdrawal.approved.body"
        }

        /** Support push notifications. */
        public object Support {
            public const val REPLY_TITLE: String = "push.support.reply.title"
            public const val REPLY_BODY: String = "push.support.reply.body"
        }
    }

    /** Email subject line keys. */
    public object Email {
        public const val SUBJECT_WELCOME: String = "email.subject.welcome"
        public const val SUBJECT_PHONE_OTP: String = "email.subject.phone_otp"
        public const val SUBJECT_DRAW_RESULT: String = "email.subject.draw_result"
        public const val SUBJECT_TRADE_SOLD: String = "email.subject.trade_sold"
        public const val SUBJECT_SHIPPING_UPDATE: String = "email.subject.shipping_update"
        public const val SUBJECT_WITHDRAWAL_APPROVED: String = "email.subject.withdrawal_approved"
        public const val SUBJECT_WITHDRAWAL_REJECTED: String = "email.subject.withdrawal_rejected"
        public const val SUBJECT_SUPPORT_REPLY: String = "email.subject.support_reply"
    }

    /** Leaderboard display label keys. */
    public object Leaderboard {
        public const val TYPE_DRAW_COUNT: String = "leaderboard.type.draw_count"
        public const val TYPE_PRIZE_GRADE: String = "leaderboard.type.prize_grade"
        public const val TYPE_TRADE_VOLUME: String = "leaderboard.type.trade_volume"
        public const val PERIOD_TODAY: String = "leaderboard.period.today"
        public const val PERIOD_THIS_WEEK: String = "leaderboard.period.this_week"
        public const val PERIOD_THIS_MONTH: String = "leaderboard.period.this_month"
        public const val PERIOD_ALL_TIME: String = "leaderboard.period.all_time"
        public const val NO_RANK: String = "leaderboard.no_rank"
    }

    /** Feature flag message keys. */
    public object Feature {
        public const val DISABLED: String = "feature.disabled"
    }
}
