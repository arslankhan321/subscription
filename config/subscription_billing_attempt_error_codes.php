<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Shopify SubscriptionBillingAttemptErrorCode
    |--------------------------------------------------------------------------
    | Source: https://shopify.dev/docs/api/admin-graphql/latest/enums/SubscriptionBillingAttemptErrorCode
    |
    | Keep this list in sync with Shopify's enum values.
    */
    'all' => [
        'AMOUNT_TOO_LARGE',
        'AMOUNT_TOO_SMALL',
        'AUTHENTICATION_ERROR',
        'AUTHENTICATION_FAILED',
        'AUTHENTICATION_REQUIRED',
        'BUYER_CANCELED_PAYMENT_METHOD',
        'CALL_ISSUER',
        'CANCELLED_PAYMENT',
        'CARD_DECLINED',
        'CARD_NUMBER_INCORRECT',
        'CONFIRMATION_REJECTED',
        'CUSTOMER_INVALID',
        'CUSTOMER_NOT_FOUND',
        'DO_NOT_HONOR',
        'EXPIRED_BUYER_ACTION',
        'EXPIRED_CARD',
        'EXPIRED_PAYMENT_METHOD',
        'FRAUD_SUSPECTED',
        'FREE_GIFT_CARD_NOT_ALLOWED',
        'GENERIC_ERROR',
        'INCORRECT_ADDRESS',
        'INCORRECT_NUMBER',
        'INCORRECT_ZIP',
        'INSUFFICIENT_FUNDS',
        'INSUFFICIENT_INVENTORY',
        'INVALID_BILLING_ADDRESS',
        'INVALID_CURRENCY',
        'INVALID_CUSTOMER_BILLING_AGREEMENT',
        'INVALID_EXPIRY_DATE',
        'INVALID_NUMBER',
        'INVALID_PAYMENT_METHOD',
        'INVALID_PURCHASE_TYPE',
        'INVALID_SHIPPING_ADDRESS',
        'INVENTORY_ALLOCATIONS_NOT_FOUND',
        'INVOICE_ALREADY_PAID',
        'MERCHANT_ACCOUNT_ERROR',
        'MERCHANT_RULE',
        'NON_TEST_ORDER_LIMIT_REACHED',
        'OFF_SESSION_REJECTED',
        'PAYMENT_METHOD_DECLINED',
        'PAYMENT_METHOD_INCOMPATIBLE_WITH_GATEWAY_CONFIG',
        'PAYMENT_METHOD_NOT_FOUND',
        'PAYMENT_METHOD_NOT_SPECIFIED',
        'PAYMENT_METHOD_UNSUPPORTED',
        'PAYMENT_PROVIDER_ERROR',
        'PAYMENT_PROVIDER_IS_NOT_ENABLED',
        'PAYPAL_ERROR_GENERAL',
        'PROCESSING_ERROR',
        'PURCHASE_TYPE_NOT_SUPPORTED',
        'RETRY_DECLINED',
        'TEST_MODE',
        'TRANSACTION_LIMIT_EXCEEDED',
        'TRANSIENT_ERROR',
        'UNEXPECTED_ERROR',
    ],

    /*
    |--------------------------------------------------------------------------
    | Retryable codes
    |--------------------------------------------------------------------------
    | These are the errors we consider safe/meaningful to retry automatically.
    | Start conservative; expand as needed.
    */
    'retryable' => [
        'INSUFFICIENT_FUNDS',
        'TRANSIENT_ERROR',
        'PROCESSING_ERROR',
        'PAYMENT_PROVIDER_ERROR',
        'GENERIC_ERROR',
        'UNEXPECTED_ERROR',
        'RETRY_DECLINED',
    ],

    /*
    |--------------------------------------------------------------------------
    | Blocked (merchant/customer must fix)
    |--------------------------------------------------------------------------
    | We may want to keep these un-resolved so we can pick them up again once
    | the merchant/customer fixes the issue.
    */
    'blocked_but_recheckable' => [
        'PAYMENT_PROVIDER_IS_NOT_ENABLED',
        'AUTHENTICATION_REQUIRED',
        'OFF_SESSION_REJECTED',
        'EXPIRED_BUYER_ACTION',
        'PAYMENT_METHOD_NOT_SPECIFIED',
        'PAYMENT_METHOD_NOT_FOUND',
        'INVALID_PAYMENT_METHOD',
        'EXPIRED_PAYMENT_METHOD',
    ],
];