package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class PaymentGateway {
    ECPAY,
    NEWEBPAY,
    STRIPE,
    APPLEPAY,
    GOOGLEPAY,
}

@Serializable
public enum class PaymentOrderStatus {
    PENDING,
    PAID,
    FAILED,
    REFUNDED,
}

@Serializable
public enum class OAuthProvider {
    GOOGLE,
    APPLE,
    LINE,
}

@Serializable
public enum class StaffRole {
    CUSTOMER_SERVICE,
    OPERATOR,
    MANAGER,
    ADMIN,
    OWNER,
}
