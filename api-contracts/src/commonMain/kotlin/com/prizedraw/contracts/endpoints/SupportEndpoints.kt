package com.prizedraw.contracts.endpoints

public object SupportEndpoints {
    public const val BASE: String = "/api/v1/support"
    public const val TICKETS: String = "$BASE/tickets"
    public const val TICKET_BY_ID: String = "$BASE/tickets/{ticketId}"
    public const val REPLY: String = "$BASE/tickets/{ticketId}/reply"
    public const val CLOSE: String = "$BASE/tickets/{ticketId}/close"
}
