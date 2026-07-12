<?php

namespace App\Services\Shopify;

use App\Models\User;

class ShopifySubscriptionContractService
{
    public function __construct(
        protected ShopifyGraphqlService $graphql
    ) {}

    public function fetchContract(User $shop, string $contractGid): ?array
    {
        $query = <<<'GQL'
        query getSubscriptionContract($id: ID!) {
            subscriptionContract(id: $id) {
                id
                revisionId
                status
                currencyCode
                createdAt
                updatedAt
                nextBillingDate
                note
                lastPaymentStatus
                lastBillingAttemptErrorType
                billingPolicy {
                    interval
                    intervalCount
                    minCycles
                    maxCycles
                }
                deliveryPolicy {
                    interval
                    intervalCount
                }
                deliveryPrice {
                    amount
                    currencyCode
                }
                customer {
                    id
                    email
                    firstName
                    lastName
                    phone
                }
                originOrder {
                    id
                    legacyResourceId
                    name
                }
                deliveryMethod {
                    ... on SubscriptionDeliveryMethodShipping {
                        __typename
                        shippingOption {
                            title
                        }
                        address {
                            firstName
                            lastName
                            company
                            address1
                            address2
                            city
                            province
                            provinceCode
                            country
                            countryCode
                            zip
                            phone
                        }
                    }
                    ... on SubscriptionDeliveryMethodLocalDelivery {
                        __typename
                        localDeliveryOption {
                            title
                        }
                        address {
                            firstName
                            lastName
                            company
                            address1
                            address2
                            city
                            province
                            provinceCode
                            country
                            countryCode
                            zip
                            phone
                        }
                    }
                    ... on SubscriptionDeliveryMethodPickup {
                        __typename
                        pickupOption {
                            title
                        }
                    }
                }
                lines(first: 50) {
                    edges {
                        node {
                            id
                            quantity
                            title
                            variantTitle
                            sku
                            productId
                            variantId
                            sellingPlanId
                            sellingPlanName
                            requiresShipping
                            currentPrice {
                                amount
                                currencyCode
                            }
                            variantImage {
                                url
                            }
                        }
                    }
                }
                orders(first: 50) {
                    edges {
                        node {
                            id
                            legacyResourceId
                            name
                            displayFinancialStatus
                            displayFulfillmentStatusf
                            processedAt
                            createdAt
                            totalPriceSet {
                                shopMoney {
                                    amount
                                    currencyCode
                                }
                            }
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $contractGid,
        ]);

        return $data['subscriptionContract'] ?? null;
    }

    /**
     * Fetch billing cycles with cursor pagination.
     * Uses page-derived cycle indexes (Shopify cycles start at 1).
     *
     * @return array{cycles: array<int, array>, page_info: array{has_next_page: bool, has_previous_page: bool, start_cursor: ?string, end_cursor: ?string, page: int, per_page: int, start_index: int, end_index: int}}
     */
    public function fetchBillingCycles(
        User $shop,
        string $contractGid,
        int $page = 1,
        int $perPage = 10,
        ?string $after = null
    ): array {
        $page = max(1, $page);
        $perPage = min(50, max(1, $perPage));
        $startIndex = (($page - 1) * $perPage) + 1;
        $endIndex = $page * $perPage;

        $query = <<<'GQL'
        query subscriptionBillingCycles(
            $contractId: ID!
            $first: Int!
            $after: String
            $startIndex: Int!
            $endIndex: Int!
        ) {
            subscriptionBillingCycles(
                first: $first
                after: $after
                contractId: $contractId
                billingCyclesIndexRangeSelector: { startIndex: $startIndex, endIndex: $endIndex }
                sortKey: CYCLE_INDEX
            ) {
                edges {
                    cursor
                    node {
                        cycleIndex
                        billingAttemptExpectedDate
                        cycleStartAt
                        cycleEndAt
                        skipped
                        edited
                        status
                        billingAttempts(first: 1, reverse: true) {
                            edges {
                                node {
                                    id
                                    ready
                                    errorMessage
                                    order {
                                        id
                                        name
                                        displayFinancialStatus
                                    }
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'contractId' => $contractGid,
            'first' => $perPage,
            'after' => $after,
            'startIndex' => $startIndex,
            'endIndex' => $endIndex,
        ]);

        $connection = $data['subscriptionBillingCycles'] ?? [];
        $edges = $connection['edges'] ?? [];
        $pageInfo = $connection['pageInfo'] ?? [];

        $cycles = collect($edges)
            ->map(fn (array $edge) => $this->normalizeBillingCycle($edge['node'] ?? []))
            ->filter()
            ->values()
            ->all();

        return [
            'cycles' => $cycles,
            'page_info' => [
                'has_next_page' => count($cycles) >= $perPage || (bool) ($pageInfo['hasNextPage'] ?? false),
                'has_previous_page' => $page > 1 || (bool) ($pageInfo['hasPreviousPage'] ?? false),
                'start_cursor' => $pageInfo['startCursor'] ?? null,
                'end_cursor' => $pageInfo['endCursor'] ?? null,
                'page' => $page,
                'per_page' => $perPage,
                'start_index' => $startIndex,
                'end_index' => $endIndex,
            ],
        ];
    }

    /**
     * Fallback fetch using a date range around the next billing date.
     *
     * @return array{cycles: array<int, array>, page_info: array{has_next_page: bool, has_previous_page: bool, start_cursor: ?string, end_cursor: ?string, page: int, per_page: int}}
     */
    public function fetchBillingCyclesByDateRange(
        User $shop,
        string $contractGid,
        string $startDate,
        string $endDate,
        int $perPage = 10,
        ?string $after = null
    ): array {
        $perPage = min(50, max(1, $perPage));

        $query = <<<'GQL'
        query subscriptionBillingCyclesByDate(
            $contractId: ID!
            $first: Int!
            $after: String
            $startDate: DateTime!
            $endDate: DateTime!
        ) {
            subscriptionBillingCycles(
                first: $first
                after: $after
                contractId: $contractId
                billingCyclesDateRangeSelector: { startDate: $startDate, endDate: $endDate }
                sortKey: CYCLE_INDEX
            ) {
                edges {
                    cursor
                    node {
                        cycleIndex
                        billingAttemptExpectedDate
                        cycleStartAt
                        cycleEndAt
                        skipped
                        edited
                        status
                        billingAttempts(first: 1, reverse: true) {
                            edges {
                                node {
                                    id
                                    ready
                                    errorMessage
                                    order {
                                        id
                                        name
                                        displayFinancialStatus
                                    }
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'contractId' => $contractGid,
            'first' => $perPage,
            'after' => $after,
            'startDate' => $startDate,
            'endDate' => $endDate,
        ]);

        $connection = $data['subscriptionBillingCycles'] ?? [];
        $edges = $connection['edges'] ?? [];
        $pageInfo = $connection['pageInfo'] ?? [];

        $cycles = collect($edges)
            ->map(fn (array $edge) => $this->normalizeBillingCycle($edge['node'] ?? []))
            ->filter()
            ->values()
            ->all();

        return [
            'cycles' => $cycles,
            'page_info' => [
                'has_next_page' => (bool) ($pageInfo['hasNextPage'] ?? false),
                'has_previous_page' => (bool) ($pageInfo['hasPreviousPage'] ?? false),
                'start_cursor' => $pageInfo['startCursor'] ?? null,
                'end_cursor' => $pageInfo['endCursor'] ?? null,
                'page' => 1,
                'per_page' => $perPage,
            ],
        ];
    }

    public function fetchPaymentMethod(User $shop, string $contractGid): ?array
    {
        $query = <<<'GQL'
        query getSubscriptionPaymentMethod($id: ID!) {
            subscriptionContract(id: $id) {
                customerPaymentMethod(showRevoked: true) {
                    id
                    instrument {
                        ... on CustomerCreditCard {
                            brand
                            lastDigits
                            expiryMonth
                            expiryYear
                            maskedNumber
                            name
                        }
                        ... on CustomerPaypalBillingAgreement {
                            paypalAccountEmail
                        }
                        ... on CustomerShopPayAgreement {
                            lastDigits
                            maskedNumber
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $contractGid,
        ]);

        $paymentMethod = $data['subscriptionContract']['customerPaymentMethod'] ?? null;

        if (! is_array($paymentMethod)) {
            return null;
        }

        $instrument = $paymentMethod['instrument'] ?? [];

        return [
            'id' => $paymentMethod['id'] ?? null,
            'brand' => $instrument['brand'] ?? null,
            'last_digits' => $instrument['lastDigits'] ?? null,
            'masked_number' => $instrument['maskedNumber'] ?? null,
            'expiry_month' => $instrument['expiryMonth'] ?? null,
            'expiry_year' => $instrument['expiryYear'] ?? null,
            'name' => $instrument['name'] ?? null,
            'paypal_email' => $instrument['paypalAccountEmail'] ?? null,
        ];
    }

    public function chargeCycle(User $shop, string $contractGid, int $cycleIndex): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionBillingAttemptCreate($contractId: ID!, $index: Int!, $idempotencyKey: String!) {
            subscriptionBillingAttemptCreate(
                subscriptionContractId: $contractId
                subscriptionBillingAttemptInput: {
                    billingCycleSelector: { index: $index }
                    idempotencyKey: $idempotencyKey
                }
            ) {
                subscriptionBillingAttempt {
                    id
                    ready
                    errorMessage
                    order {
                        id
                        name
                        displayFinancialStatus
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionBillingAttemptCreate', $mutation, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
            'idempotencyKey' => sprintf('charge-%d-%s', $cycleIndex, uniqid('', true)),
        ]);

        $attempt = $result['subscriptionBillingAttempt'] ?? [];

        /*
        |--------------------------------------------------------------------------
        | STEP 3 — Poll billing attempt until ready
        |--------------------------------------------------------------------------
        */
        $query = <<<'GQL'
        query GetBillingAttempt($id: ID!) {
            subscriptionBillingAttempt(id: $id) {
                id
                errorCode
                errorMessage
                originTime
                paymentGroupId
                paymentSessionId
                ready
                respectInventoryPolicy
                createdAt
                completedAt
                nextActionUrl
                idempotencyKey
            }
        }
        GQL;

        $attemptData = null;

        for ($i = 0; $i < 5; $i++) {
            sleep(2);
            $attemptResponse = $this->graphql->mutationForShop($shop, 'subscriptionBillingAttempt', $query, [
                'id' =>  $attempt['id'],
            ]);
            // $attemptResponse = $this->shop->api()->graph($query, ['id' => $attempt['id'] ?? null]);
            $attemptData = $attemptResponse['body']['data']['subscriptionBillingAttempt'] ?? null;

            if ($attemptData && $attemptData['ready'] === true) {
                break;
            }
        }

        dd($attemptResponse);

        return [
            'id' => $attempt['id'] ?? null,
            'ready' => $attempt['ready'] ?? null,
            'error_message' => $attempt['errorMessage'] ?? null,
            'order_name' => $attempt['order']['name'] ?? null,
            'order_financial_status' => $attempt['order']['displayFinancialStatus'] ?? null,
        ];
    }

    public function skipCycle(User $shop, string $contractGid, int $cycleIndex): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionBillingCycleSkip($contractId: ID!, $index: Int!) {
            subscriptionBillingCycleSkip(
                billingCycleInput: { contractId: $contractId, selector: { index: $index } }
            ) {
                billingCycle {
                    cycleIndex
                    skipped
                    status
                    billingAttemptExpectedDate
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionBillingCycleSkip', $mutation, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
        ]);

        return $this->normalizeBillingCycle($result['billingCycle'] ?? []) ?? [];
    }

    public function unskipCycle(User $shop, string $contractGid, int $cycleIndex): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionBillingCycleUnskip($contractId: ID!, $index: Int!) {
            subscriptionBillingCycleUnskip(
                billingCycleInput: { contractId: $contractId, selector: { index: $index } }
            ) {
                billingCycle {
                    cycleIndex
                    skipped
                    status
                    billingAttemptExpectedDate
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionBillingCycleUnskip', $mutation, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
        ]);

        return $this->normalizeBillingCycle($result['billingCycle'] ?? []) ?? [];
    }

    public function rescheduleCycle(User $shop, string $contractGid, int $cycleIndex, string $billingDate): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionBillingCycleScheduleEdit($contractId: ID!, $index: Int!, $date: DateTime!) {
            subscriptionBillingCycleScheduleEdit(
                billingCycleInput: { contractId: $contractId, selector: { index: $index } }
                input: { billingDate: $date, reason: MERCHANT_INITIATED }
            ) {
                billingCycle {
                    cycleIndex
                    skipped
                    edited
                    status
                    billingAttemptExpectedDate
                    cycleStartAt
                    cycleEndAt
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionBillingCycleScheduleEdit', $mutation, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
            'date' => $billingDate,
        ]);

        return $this->normalizeBillingCycle($result['billingCycle'] ?? []) ?? [];
    }

    private function normalizeBillingCycle(array $cycle): ?array
    {
        if ($cycle === []) {
            return null;
        }

        $attempt = $cycle['billingAttempts']['edges'][0]['node'] ?? null;

        return [
            'cycle_index' => $cycle['cycleIndex'] ?? null,
            'billing_attempt_expected_date' => $cycle['billingAttemptExpectedDate'] ?? null,
            'cycle_start_at' => $cycle['cycleStartAt'] ?? null,
            'cycle_end_at' => $cycle['cycleEndAt'] ?? null,
            'skipped' => (bool) ($cycle['skipped'] ?? false),
            'edited' => (bool) ($cycle['edited'] ?? false),
            'status' => $cycle['status'] ?? null,
            'billing_attempt' => $attempt ? [
                'id' => $attempt['id'] ?? null,
                'ready' => $attempt['ready'] ?? null,
                'error_message' => $attempt['errorMessage'] ?? null,
                'order_name' => $attempt['order']['name'] ?? null,
                'order_financial_status' => $attempt['order']['displayFinancialStatus'] ?? null,
            ] : null,
        ];
    }
}
