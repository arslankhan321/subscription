<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Deferred subscription webhooks
    |--------------------------------------------------------------------------
    |
    | These webhooks are registered programmatically when a shop creates its
    | first selling plan. APP_UNINSTALLED remains in config/shopify-app.php.
    |
    */
    'webhooks' => [
        [
            'topic' => 'SUBSCRIPTION_CONTRACTS_CREATE',
            'name' => 'Subscription contracts create',
            'address' => '/webhook/subscription-contracts',
        ],
        [
            'topic' => 'SUBSCRIPTION_CONTRACTS_UPDATE',
            'name' => 'Subscription contracts update',
            'address' => '/webhook/webhook-subscription-update',
        ],
        [
            'topic' => 'SUBSCRIPTION_CONTRACTS_CANCEL',
            'name' => 'Subscription contracts cancel',
            'address' => '/webhook/webhook-subscription-cancel',
        ],
        [
            'topic' => 'ORDERS_CREATE',
            'name' => 'Orders create',
            'address' => '/webhook/orders-create',
        ],
        [
            'topic' => 'SUBSCRIPTION_BILLING_CYCLES_SKIP',
            'name' => 'Subscription billing cycles skip',
            'address' => '/webhook/subscription-skip',
        ],
        [
            'topic' => 'SUBSCRIPTION_BILLING_CYCLES_UNSKIP',
            'name' => 'Subscription billing cycles unskip',
            'address' => '/webhook/subscription-un-skip',
        ],
        [
            'topic' => 'SUBSCRIPTION_BILLING_ATTEMPTS_SUCCESS',
            'name' => 'Subscription billing attempts success',
            'address' => '/webhook/billing-attempt-success',
        ],
        [
            'topic' => 'SUBSCRIPTION_BILLING_ATTEMPTS_FAILURE',
            'name' => 'Subscription billing attempts failure',
            'address' => '/webhook/billing-attempt-fail',
        ],
    ],
];
