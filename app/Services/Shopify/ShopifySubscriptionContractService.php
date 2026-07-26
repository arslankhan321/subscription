<?php

namespace App\Services\Shopify;

use App\Exceptions\ShopifySellingPlanException;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlanOption;
use App\Models\User;
use App\Support\PhoneNumber;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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
                            displayFulfillmentStatus
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
                customer {
                    id
                    legacyResourceId
                    displayName
                    email
                }
                customerPaymentMethod(showRevoked: false) {
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
                            name
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $contractGid,
        ]);

        $contract = $data['subscriptionContract'] ?? null;
        $paymentMethod = $contract['customerPaymentMethod'] ?? null;

        if (! is_array($paymentMethod)) {
            return [
                'id' => null,
                'customer_gid' => $contract['customer']['id'] ?? null,
                'customer_legacy_id' => $contract['customer']['legacyResourceId'] ?? null,
                'customer_name' => $contract['customer']['displayName'] ?? null,
                'customer_admin_url' => $this->customerAdminUrl(
                    $shop,
                    $contract['customer']['legacyResourceId'] ?? null
                ),
            ];
        }

        return array_merge(
            $this->normalizePaymentMethod($paymentMethod),
            [
                'customer_gid' => $contract['customer']['id'] ?? null,
                'customer_legacy_id' => $contract['customer']['legacyResourceId'] ?? null,
                'customer_name' => $contract['customer']['displayName'] ?? null,
                'customer_admin_url' => $this->customerAdminUrl(
                    $shop,
                    $contract['customer']['legacyResourceId'] ?? null
                ),
                'is_current' => true,
            ]
        );
    }

    public function fetchCustomerPaymentMethods(User $shop, string $customerGid, ?string $currentPaymentMethodId = null): array
    {
        $query = <<<'GQL'
        query getCustomerPaymentMethods($id: ID!) {
            customer(id: $id) {
                id
                displayName
                paymentMethods(first: 20) {
                    edges {
                        node {
                            id
                            revokedAt
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
                                    name
                                }
                            }
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $customerGid,
        ]);

        $edges = $data['customer']['paymentMethods']['edges'] ?? [];

        return collect($edges)
            ->map(function (array $edge) use ($currentPaymentMethodId) {
                $node = $edge['node'] ?? [];

                if (! empty($node['revokedAt'])) {
                    return null;
                }

                $method = $this->normalizePaymentMethod($node);
                $method['is_current'] = $currentPaymentMethodId !== null
                    && ($method['id'] ?? null) === $currentPaymentMethodId;

                return $method;
            })
            ->filter()
            ->values()
            ->all();
    }

    public function sendPaymentMethodUpdateEmail(User $shop, string $paymentMethodId): array
    {
        $mutation = <<<'GQL'
        mutation customerPaymentMethodSendUpdateEmail($customerPaymentMethodId: ID!) {
            customerPaymentMethodSendUpdateEmail(customerPaymentMethodId: $customerPaymentMethodId) {
                customer {
                    id
                    email
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'customerPaymentMethodSendUpdateEmail', $mutation, [
            'customerPaymentMethodId' => $paymentMethodId,
        ]);

        return [
            'customer_id' => $result['customer']['id'] ?? null,
            'email' => $result['customer']['email'] ?? null,
        ];
    }

    public function swapPaymentMethod(User $shop, string $contractGid, string $paymentMethodId): array
    {
        $draftId = $this->createContractDraft($shop, $contractGid);

        $mutation = <<<'GQL'
        mutation subscriptionDraftUpdate($draftId: ID!, $input: SubscriptionDraftInput!) {
            subscriptionDraftUpdate(draftId: $draftId, input: $input) {
                draft {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftUpdate', $mutation, [
            'draftId' => $draftId,
            'input' => [
                'paymentMethodId' => $paymentMethodId,
            ],
        ]);

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchPaymentMethod($shop, $contractGid) ?? [];
    }

    public function fetchShippingAddress(User $shop, string $contractGid): ?array
    {
        $query = <<<'GQL'
        query getSubscriptionShippingAddress($id: ID!) {
            subscriptionContract(id: $id) {
                customer {
                    id
                    legacyResourceId
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
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $contractGid,
        ]);

        $contract = $data['subscriptionContract'] ?? null;
        $deliveryMethod = $contract['deliveryMethod'] ?? null;

        if (! is_array($deliveryMethod) || empty($deliveryMethod['address'])) {
            return null;
        }

        return array_merge(
            $this->normalizeShippingAddress($deliveryMethod['address']),
            [
                'delivery_method_type' => $deliveryMethod['__typename'] ?? null,
                'shipping_option_title' => $deliveryMethod['shippingOption']['title']
                    ?? $deliveryMethod['localDeliveryOption']['title']
                    ?? null,
                'customer_gid' => $contract['customer']['id'] ?? null,
                'customer_legacy_id' => $contract['customer']['legacyResourceId'] ?? null,
                'customer_admin_url' => $this->customerAdminUrl(
                    $shop,
                    $contract['customer']['legacyResourceId'] ?? null
                ),
            ]
        );
    }

    public function fetchCustomerAddresses(User $shop, string $customerGid, ?array $currentShipping = null): array
    {
        $query = <<<'GQL'
        query getCustomerAddresses($id: ID!) {
            customer(id: $id) {
                id
                legacyResourceId
                addressesV2(first: 50) {
                    nodes {
                        id
                        firstName
                        lastName
                        company
                        address1
                        address2
                        city
                        province
                        provinceCode
                        country
                        countryCodeV2
                        zip
                        phone
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $customerGid,
        ]);

        $nodes = $data['customer']['addressesV2']['nodes'] ?? [];

        return collect($nodes)
            ->map(function (array $node) use ($currentShipping) {
                $address = $this->normalizeShippingAddress($node);
                $address['is_current'] = $this->addressesMatch($address, $currentShipping);

                return $address;
            })
            ->values()
            ->all();
    }

    public function updateShippingAddress(User $shop, string $contractGid, array $address): array
    {
        $draftId = $this->createContractDraft($shop, $contractGid);

        $countryCode = strtoupper((string) ($address['country_code'] ?? ''));
        $provinceCode = $address['province_code'] ?? null;
        $rawPhone = trim((string) ($address['phone'] ?? ''));
        $phone = PhoneNumber::toE164($rawPhone !== '' ? $rawPhone : null, $countryCode);

        if ($rawPhone !== '' && $phone === null) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Phone must be a valid international number (E.164), e.g. +923001234567.'
            );
        }

        $mailingAddress = array_filter([
            'firstName' => $address['first_name'] ?? null,
            'lastName' => $address['last_name'] ?? null,
            'company' => $address['company'] ?? null,
            'address1' => $address['address1'] ?? null,
            'address2' => $address['address2'] ?? null,
            'city' => $address['city'] ?? null,
            'zip' => $address['zip'] ?? null,
            'phone' => $phone,
            'countryCode' => $countryCode !== '' ? $countryCode : null,
            'provinceCode' => $provinceCode !== null && $provinceCode !== '' ? $provinceCode : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $mutation = <<<'GQL'
        mutation subscriptionDraftUpdate($draftId: ID!, $input: SubscriptionDraftInput!) {
            subscriptionDraftUpdate(draftId: $draftId, input: $input) {
                draft {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftUpdate', $mutation, [
            'draftId' => $draftId,
            'input' => [
                'deliveryMethod' => [
                    'shipping' => [
                        'address' => $mailingAddress,
                    ],
                ],
            ],
        ]);

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchShippingAddress($shop, $contractGid) ?? [];
    }

    private function normalizeShippingAddress(array $address): array
    {
        return [
            'id' => $address['id'] ?? null,
            'first_name' => $address['firstName'] ?? null,
            'last_name' => $address['lastName'] ?? null,
            'company' => $address['company'] ?? null,
            'address1' => $address['address1'] ?? null,
            'address2' => $address['address2'] ?? null,
            'city' => $address['city'] ?? null,
            'province' => $address['province'] ?? null,
            'province_code' => $address['provinceCode'] ?? null,
            'country' => $address['country'] ?? null,
            'country_code' => $address['countryCodeV2']
                ?? $address['countryCode']
                ?? null,
            'zip' => $address['zip'] ?? null,
            'phone' => $address['phone'] ?? null,
        ];
    }

    private function addressesMatch(?array $left, ?array $right): bool
    {
        if (! is_array($left) || ! is_array($right)) {
            return false;
        }

        $normalize = static function (?string $value): string {
            return strtolower(trim((string) $value));
        };

        $keys = ['address1', 'address2', 'city', 'zip', 'country_code', 'province_code', 'first_name', 'last_name'];

        foreach ($keys as $key) {
            if ($normalize($left[$key] ?? null) !== $normalize($right[$key] ?? null)) {
                return false;
            }
        }

        return true;
    }

    private function normalizePaymentMethod(array $paymentMethod): array
    {
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
            'instrument_type' => $this->resolveInstrumentType($instrument),
        ];
    }

    private function resolveInstrumentType(array $instrument): string
    {
        if (! empty($instrument['paypalAccountEmail'])) {
            return 'paypal';
        }

        if (! empty($instrument['brand']) || ! empty($instrument['lastDigits'])) {
            return 'card';
        }

        return 'other';
    }

    private function customerAdminUrl(User $shop, mixed $legacyCustomerId): ?string
    {
        if ($legacyCustomerId === null || $legacyCustomerId === '') {
            return null;
        }

        $domain = $shop->name ?? null;

        if (! $domain) {
            return null;
        }

        return sprintf('https://%s/admin/customers/%s', $domain, $legacyCustomerId);
    }

    public function customerOrdersUrl(User $shop, mixed $legacyCustomerId): ?string
    {
        if ($legacyCustomerId === null || $legacyCustomerId === '') {
            return null;
        }

        $domain = $shop->name ?? null;

        if (! $domain) {
            return null;
        }

        return sprintf('https://%s/admin/orders?customer_id=%s', $domain, $legacyCustomerId);
    }

    public function fetchCustomer(User $shop, string $customerGid): array
    {
        $query = <<<'GQL'
        query getCustomer($id: ID!) {
            customer(id: $id) {
                id
                legacyResourceId
                email
                firstName
                lastName
                phone
                displayName
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $customerGid,
        ]);

        $customer = $data['customer'] ?? null;

        if (! is_array($customer) || empty($customer['id'])) {
            throw new \App\Exceptions\ShopifySellingPlanException('Customer not found in Shopify.');
        }

        $legacyId = $customer['legacyResourceId'] ?? null;

        return [
            'shopify_gid' => $customer['id'],
            'shopify_customer_id' => $legacyId !== null ? (int) $legacyId : null,
            'email' => $customer['email'] ?? null,
            'first_name' => $customer['firstName'] ?? null,
            'last_name' => $customer['lastName'] ?? null,
            'phone' => $customer['phone'] ?? null,
            'display_name' => $customer['displayName'] ?? null,
            'admin_url' => $this->customerAdminUrl($shop, $legacyId),
            'orders_url' => $this->customerOrdersUrl($shop, $legacyId),
        ];
    }

    public function fetchDiscounts(User $shop, string $contractGid): array
    {
        $query = <<<'GQL'
        query getSubscriptionDiscounts($id: ID!) {
            subscriptionContract(id: $id) {
                discounts(first: 50) {
                    edges {
                        node {
                            id
                            title
                            recurringCycleLimit
                            rejectionReason
                            targetType
                            type
                            usageCount
                            entitledLines {
                                all
                                lines(first: 20) {
                                    edges {
                                        node {
                                            id
                                            title
                                        }
                                    }
                                }
                            }
                            value {
                                ... on SubscriptionDiscountPercentageValue {
                                    percentage
                                }
                                ... on SubscriptionDiscountFixedAmountValue {
                                    amount {
                                        amount
                                        currencyCode
                                    }
                                    appliesOnEachItem
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

        $edges = $data['subscriptionContract']['discounts']['edges'] ?? [];

        return collect($edges)
            ->map(fn (array $edge) => $this->normalizeDiscount($edge['node'] ?? []))
            ->filter()
            ->values()
            ->all();
    }

    public function addDiscount(User $shop, string $contractGid, array $input): array
    {
        $draftId = $this->createContractDraft($shop, $contractGid);

        $discountInput = [
            'title' => $input['title'],
            'recurringCycleLimit' => $input['recurring_cycle_limit'] ?? null,
            'value' => $input['type'] === 'fixed'
                ? [
                    'fixedAmount' => [
                        'amount' => (float) $input['amount'],
                        'appliesOnEachItem' => false,
                    ],
                ]
                : [
                    'percentage' => (int) round((float) $input['amount']),
                ],
            'entitledLines' => [
                'all' => (bool) ($input['applies_to_all'] ?? true),
            ],
        ];

        if (! ($input['applies_to_all'] ?? true) && ! empty($input['line_id'])) {
            $discountInput['entitledLines'] = [
                'all' => false,
                'lines' => [
                    'add' => [$input['line_id']],
                ],
            ];
        }

        if (! ($input['limit_cycles'] ?? false)) {
            unset($discountInput['recurringCycleLimit']);
        }

        $addMutation = <<<'GQL'
        mutation subscriptionDraftDiscountAdd($draftId: ID!, $input: SubscriptionManualDiscountInput!) {
            subscriptionDraftDiscountAdd(draftId: $draftId, input: $input) {
                discountAdded {
                    id
                    title
                    recurringCycleLimit
                    usageCount
                    type
                    value {
                        ... on SubscriptionDiscountPercentageValue {
                            percentage
                        }
                        ... on SubscriptionDiscountFixedAmountValue {
                            amount {
                                amount
                                currencyCode
                            }
                        }
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftDiscountAdd', $addMutation, [
            'draftId' => $draftId,
            'input' => $discountInput,
        ]);

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchDiscounts($shop, $contractGid);
    }

    public function removeDiscount(User $shop, string $contractGid, string $discountId): array
    {
        $draftId = $this->createContractDraft($shop, $contractGid);

        $mutation = <<<'GQL'
        mutation subscriptionDraftDiscountRemove($draftId: ID!, $discountId: ID!) {
            subscriptionDraftDiscountRemove(draftId: $draftId, discountId: $discountId) {
                discountRemoved {
                    ... on SubscriptionManualDiscount {
                        id
                        title
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftDiscountRemove', $mutation, [
            'draftId' => $draftId,
            'discountId' => $discountId,
        ]);

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchDiscounts($shop, $contractGid);
    }

    public function pauseContract(User $shop, string $contractGid): array
    {
        return $this->updateContractStatus(
            $shop,
            $contractGid,
            'subscriptionContractPause',
            <<<'GQL'
            mutation subscriptionContractPause($subscriptionContractId: ID!) {
                subscriptionContractPause(subscriptionContractId: $subscriptionContractId) {
                    contract {
                        id
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL
        );
    }

    public function activateContract(User $shop, string $contractGid): array
    {
        return $this->updateContractStatus(
            $shop,
            $contractGid,
            'subscriptionContractActivate',
            <<<'GQL'
            mutation subscriptionContractActivate($subscriptionContractId: ID!) {
                subscriptionContractActivate(subscriptionContractId: $subscriptionContractId) {
                    contract {
                        id
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL
        );
    }

    public function cancelContract(User $shop, string $contractGid): array
    {
        return $this->updateContractStatus(
            $shop,
            $contractGid,
            'subscriptionContractCancel',
            <<<'GQL'
            mutation subscriptionContractCancel($subscriptionContractId: ID!) {
                subscriptionContractCancel(subscriptionContractId: $subscriptionContractId) {
                    contract {
                        id
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL
        );
    }

    private function updateContractStatus(
        User $shop,
        string $contractGid,
        string $mutationName,
        string $mutation
    ): array {
        $result = $this->graphql->mutationForShop($shop, $mutationName, $mutation, [
            'subscriptionContractId' => $contractGid,
        ]);

        $status = $result['contract']['status'] ?? null;

        if (! $status) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Unable to update subscription status on Shopify.'
            );
        }

        return [
            'id' => $result['contract']['id'] ?? $contractGid,
            'status' => strtolower((string) $status),
        ];
    }

    public function searchCustomers(User $shop, string $query, int $first = 20): array
    {
        $search = trim($query);

        if ($search === '') {
            return [];
        }

        $gql = <<<'GQL'
        query searchCustomers($query: String!, $first: Int!) {
            customers(first: $first, query: $query) {
                edges {
                    node {
                        id
                        displayName
                        email
                        firstName
                        lastName
                        phone
                        defaultAddress {
                            id
                            firstName
                            lastName
                            company
                            address1
                            address2
                            city
                            province
                            provinceCode
                            country
                            countryCodeV2
                            zip
                            phone
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $gql, [
            'query' => $search,
            'first' => min(50, max(1, $first)),
        ]);

        return collect($data['customers']['edges'] ?? [])
            ->map(function (array $edge) {
                $node = $edge['node'] ?? [];
                $address = $node['defaultAddress'] ?? null;

                return [
                    'id' => $node['id'] ?? null,
                    'display_name' => $node['displayName'] ?? null,
                    'email' => $node['email'] ?? null,
                    'first_name' => $node['firstName'] ?? null,
                    'last_name' => $node['lastName'] ?? null,
                    'phone' => $node['phone'] ?? null,
                    'location' => $address
                        ? trim(implode(', ', array_filter([
                            $address['city'] ?? null,
                            $address['province'] ?? null,
                            $address['country'] ?? null,
                        ])))
                        : null,
                    'default_address' => $address ? [
                        'id' => $address['id'] ?? null,
                        'first_name' => $address['firstName'] ?? null,
                        'last_name' => $address['lastName'] ?? null,
                        'company' => $address['company'] ?? null,
                        'address1' => $address['address1'] ?? null,
                        'address2' => $address['address2'] ?? null,
                        'city' => $address['city'] ?? null,
                        'province' => $address['province'] ?? null,
                        'province_code' => $address['provinceCode'] ?? null,
                        'country' => $address['country'] ?? null,
                        'country_code' => $address['countryCodeV2'] ?? null,
                        'zip' => $address['zip'] ?? null,
                        'phone' => $address['phone'] ?? null,
                    ] : null,
                ];
            })
            ->filter(fn (array $customer) => ! empty($customer['id']))
            ->values()
            ->all();
    }

    public function fetchShopCurrency(User $shop): string
    {
        $currencies = $this->fetchShopCurrencies($shop);

        return (string) ($currencies['currency_code'] ?? 'USD');
    }

    /**
     * @return array{currency_code: string, currencies: list<array{code: string, name: string}>}
     */
    public function fetchShopCurrencies(User $shop): array
    {
        $query = <<<'GQL'
        query shopCurrencies {
            shop {
                currencyCode
                enabledPresentmentCurrencies
                currencySettings(first: 50) {
                    nodes {
                        currencyCode
                        currencyName
                        enabled
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query);
        $shopData = $data['shop'] ?? [];
        $shopCurrency = strtoupper((string) ($shopData['currencyCode'] ?? 'USD'));

        $namesByCode = [];

        foreach ($shopData['currencySettings']['nodes'] ?? [] as $setting) {
            $code = strtoupper((string) ($setting['currencyCode'] ?? ''));

            if ($code === '') {
                continue;
            }

            $namesByCode[$code] = (string) ($setting['currencyName'] ?? $code);
        }

        $codes = collect([$shopCurrency])
            ->merge($shopData['enabledPresentmentCurrencies'] ?? [])
            ->map(fn ($code) => strtoupper((string) $code))
            ->filter()
            ->unique()
            ->values();

        $currencies = $codes
            ->map(fn (string $code) => [
                'code' => $code,
                'name' => $namesByCode[$code] ?? $this->currencyDisplayName($code),
            ])
            ->values()
            ->all();

        return [
            'currency_code' => $shopCurrency,
            'currencies' => $currencies,
        ];
    }

    private function currencyDisplayName(string $code): string
    {
        $names = [
            'USD' => 'United States Dollar',
            'EUR' => 'Euro',
            'GBP' => 'Pound Sterling',
            'CAD' => 'Canadian Dollar',
            'AUD' => 'Australian Dollar',
            'INR' => 'Indian Rupee',
            'PKR' => 'Pakistani Rupee',
            'AED' => 'United Arab Emirates Dirham',
            'SAR' => 'Saudi Riyal',
            'JPY' => 'Japanese Yen',
            'NZD' => 'New Zealand Dollar',
            'SGD' => 'Singapore Dollar',
            'HKD' => 'Hong Kong Dollar',
            'CHF' => 'Swiss Franc',
            'CNY' => 'Chinese Yuan',
            'SEK' => 'Swedish Krona',
            'NOK' => 'Norwegian Krone',
            'DKK' => 'Danish Krone',
            'MXN' => 'Mexican Peso',
            'BRL' => 'Brazilian Real',
            'ZAR' => 'South African Rand',
            'TRY' => 'Turkish Lira',
            'PLN' => 'Polish Zloty',
            'THB' => 'Thai Baht',
            'MYR' => 'Malaysian Ringgit',
            'PHP' => 'Philippine Peso',
            'IDR' => 'Indonesian Rupiah',
            'VND' => 'Vietnamese Dong',
            'KRW' => 'South Korean Won',
            'EGP' => 'Egyptian Pound',
            'NGN' => 'Nigerian Naira',
            'KES' => 'Kenyan Shilling',
            'GHS' => 'Ghanaian Cedi',
            'MAD' => 'Moroccan Dirham',
            'QAR' => 'Qatari Riyal',
            'KWD' => 'Kuwaiti Dinar',
            'BHD' => 'Bahraini Dinar',
            'OMR' => 'Omani Rial',
            'ILS' => 'Israeli New Shekel',
            'CZK' => 'Czech Koruna',
            'HUF' => 'Hungarian Forint',
            'RON' => 'Romanian Leu',
            'BGN' => 'Bulgarian Lev',
            'HRK' => 'Croatian Kuna',
            'RUB' => 'Russian Ruble',
            'UAH' => 'Ukrainian Hryvnia',
            'CLP' => 'Chilean Peso',
            'COP' => 'Colombian Peso',
            'ARS' => 'Argentine Peso',
            'PEN' => 'Peruvian Sol',
            'TWD' => 'New Taiwan Dollar',
        ];

        return $names[$code] ?? $code;
    }

    /**
     * @param  array{
     *   customer_id: string,
     *   payment_method_id: string,
     *   currency_code?: string,
     *   next_billing_date: string,
     *   status?: string,
     *   billing_type?: string,
     *   delivery_frequency: int,
     *   delivery_interval: string,
     *   billing_frequency?: int|null,
     *   billing_interval?: string|null,
     *   billing_min_cycles?: int|null,
     *   billing_max_cycles?: int|null,
     *   delivery_price?: float|string|null,
     *   delivery_method_title?: string|null,
     *   digital_product?: bool,
     *   shipping?: array<string, mixed>|null,
     *   lines: list<array{product_variant_id: string, quantity?: int, current_price?: float|string, selling_plan_id?: string|null, selling_plan_name?: string|null}>
     * }  $input
     */
    public function createContract(User $shop, array $input): array
    {
        $customerId = $this->toShopifyGid($input['customer_id'] ?? '', 'Customer');
        $paymentMethodId = (string) ($input['payment_method_id'] ?? '');
        $lines = $input['lines'] ?? [];

        if ($customerId === '' || $paymentMethodId === '') {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Customer and payment method are required to create a subscription.'
            );
        }

        if ($lines === []) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'At least one product is required to create a subscription.'
            );
        }

        $deliveryFrequency = max(1, (int) ($input['delivery_frequency'] ?? 1));
        $deliveryInterval = $this->mapSellingPlanInterval($input['delivery_interval'] ?? 'MONTH');
        $billingType = $input['billing_type'] ?? 'Pay as you go';
        $isPrepaid = $billingType === 'Prepaid';

        $billingFrequency = $isPrepaid
            ? max(1, (int) ($input['billing_frequency'] ?? $deliveryFrequency))
            : $deliveryFrequency;
        $billingInterval = $isPrepaid
            ? $this->mapSellingPlanInterval($input['billing_interval'] ?? $deliveryInterval)
            : $deliveryInterval;

        if ($isPrepaid && $billingFrequency % $deliveryFrequency !== 0) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Billing frequency must be a multiple of delivery frequency for prepaid subscriptions.'
            );
        }

        if ($isPrepaid && $billingInterval !== $deliveryInterval) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Billing interval must match delivery interval for prepaid subscriptions.'
            );
        }

        $billingPolicy = [
            'interval' => $billingInterval,
            'intervalCount' => $billingFrequency,
        ];

        if (isset($input['billing_min_cycles']) && $input['billing_min_cycles'] !== null && $input['billing_min_cycles'] !== '') {
            $billingPolicy['minCycles'] = max(1, (int) $input['billing_min_cycles']);
        }

        if (isset($input['billing_max_cycles']) && $input['billing_max_cycles'] !== null && $input['billing_max_cycles'] !== '') {
            $billingPolicy['maxCycles'] = max(1, (int) $input['billing_max_cycles']);
        }

        $contractInput = [
            'status' => strtoupper((string) ($input['status'] ?? 'PAUSED')),
            'paymentMethodId' => $paymentMethodId,
            'billingPolicy' => $billingPolicy,
            'deliveryPolicy' => [
                'interval' => $deliveryInterval,
                'intervalCount' => $deliveryFrequency,
            ],
            'deliveryPrice' => (string) ($input['delivery_price'] ?? 0),
        ];

        $isDigital = ! empty($input['digital_product']);
        $shipping = $input['shipping'] ?? null;

        if (! $isDigital && is_array($shipping) && ! empty($shipping['address1'])) {
            $address = array_filter([
                'firstName' => $shipping['first_name'] ?? null,
                'lastName' => $shipping['last_name'] ?? null,
                'company' => $shipping['company'] ?? null,
                'address1' => $shipping['address1'] ?? null,
                'address2' => $shipping['address2'] ?? null,
                'city' => $shipping['city'] ?? null,
                'province' => $shipping['province'] ?? ($shipping['province_code'] ?? null),
                'country' => $shipping['country'] ?? ($shipping['country_code'] ?? null),
                'zip' => $shipping['zip'] ?? null,
                'phone' => $shipping['phone'] ?? null,
            ], static fn ($value) => $value !== null && $value !== '');

            $contractInput['deliveryMethod'] = [
                'shipping' => [
                    'address' => $address,
                    'shippingOption' => [
                        'title' => ($input['delivery_method_title'] ?? '') !== ''
                            ? $input['delivery_method_title']
                            : 'Subscription shipping',
                        'code' => 'SUBSCRIPTION',
                    ],
                ],
            ];
        }

        $atomicLines = [];

        foreach ($lines as $line) {
            $variantId = $this->toShopifyGid($line['product_variant_id'] ?? '', 'ProductVariant');

            if ($variantId === '') {
                continue;
            }

            $lineInput = [
                'productVariantId' => $variantId,
                'quantity' => max(1, (int) ($line['quantity'] ?? 1)),
                'currentPrice' => (float) ($line['current_price'] ?? 0),
            ];

            if (! empty($line['selling_plan_id'])) {
                $lineInput['sellingPlanId'] = $this->toShopifyGid($line['selling_plan_id'], 'SellingPlan');
            }

            if (! empty($line['selling_plan_name'])) {
                $lineInput['sellingPlanName'] = $line['selling_plan_name'];
            }

            $atomicLines[] = ['line' => $lineInput];
        }

        if ($atomicLines === []) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'At least one valid product variant is required.'
            );
        }

        $mutation = <<<'GQL'
        mutation subscriptionContractAtomicCreate($input: SubscriptionContractAtomicCreateInput!) {
            subscriptionContractAtomicCreate(input: $input) {
                contract {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionContractAtomicCreate', $mutation, [
            'input' => [
                'customerId' => $customerId,
                'currencyCode' => strtoupper((string) ($input['currency_code'] ?? 'USD')),
                'nextBillingDate' => $input['next_billing_date'],
                'contract' => $contractInput,
                'lines' => $atomicLines,
            ],
        ]);

        $contractGid = $result['contract']['id'] ?? null;

        if (! $contractGid) {
            throw new \App\Exceptions\ShopifySellingPlanException('Unable to create subscription contract.');
        }

        return $this->fetchContract($shop, $contractGid) ?? ['id' => $contractGid];
    }

    /**
     * Update contract lines, billing/delivery policies, and delivery price.
     *
     * @param  array{
     *   billing_type?: string,
     *   delivery_frequency: int,
     *   delivery_interval: string,
     *   billing_frequency?: int|null,
     *   billing_interval?: string|null,
     *   delivery_price?: float|null,
     *   lines?: list<array{id: string, quantity?: int, current_price?: float|string, remove?: bool}>
     * }  $input
     */
    public function updateContract(User $shop, string $contractGid, array $input): array
    {
        $draftId = $this->createContractDraft($shop, $contractGid);

        $deliveryFrequency = max(1, (int) ($input['delivery_frequency'] ?? 1));
        $deliveryInterval = $this->mapSellingPlanInterval($input['delivery_interval'] ?? 'MONTH');
        $billingType = $input['billing_type'] ?? 'Pay as you go';
        $isPrepaid = $billingType === 'Prepaid';

        $billingFrequency = $isPrepaid
            ? max(1, (int) ($input['billing_frequency'] ?? $deliveryFrequency))
            : $deliveryFrequency;
        $billingInterval = $isPrepaid
            ? $this->mapSellingPlanInterval($input['billing_interval'] ?? $deliveryInterval)
            : $deliveryInterval;

        if ($isPrepaid && $billingFrequency % $deliveryFrequency !== 0) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Billing frequency must be a multiple of delivery frequency for prepaid subscriptions.'
            );
        }

        if ($isPrepaid && $billingInterval !== $deliveryInterval) {
            throw new \App\Exceptions\ShopifySellingPlanException(
                'Billing interval must match delivery interval for prepaid subscriptions.'
            );
        }

        $draftInput = [
            'billingPolicy' => [
                'interval' => $billingInterval,
                'intervalCount' => $billingFrequency,
            ],
            'deliveryPolicy' => [
                'interval' => $deliveryInterval,
                'intervalCount' => $deliveryFrequency,
            ],
        ];

        if (array_key_exists('delivery_price', $input) && $input['delivery_price'] !== null) {
            $draftInput['deliveryPrice'] = (string) $input['delivery_price'];
        }

        $updateMutation = <<<'GQL'
        mutation subscriptionDraftUpdate($draftId: ID!, $input: SubscriptionDraftInput!) {
            subscriptionDraftUpdate(draftId: $draftId, input: $input) {
                draft {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftUpdate', $updateMutation, [
            'draftId' => $draftId,
            'input' => $draftInput,
        ]);

        foreach ($input['lines'] ?? [] as $line) {
            if (! empty($line['add']) || ! empty($line['is_new'])) {
                $variantId = $line['product_variant_id'] ?? null;

                if (! $variantId) {
                    continue;
                }

                $variantId = $this->toShopifyGid($variantId, 'ProductVariant');

                $addInput = [
                    'productVariantId' => $variantId,
                    'quantity' => max(1, (int) ($line['quantity'] ?? 1)),
                    'currentPrice' => (string) ($line['current_price'] ?? 0),
                ];

                $sellingPlanId = $line['selling_plan_id'] ?? null;
                if ($sellingPlanId) {
                    $addInput['sellingPlanId'] = $this->toShopifyGid($sellingPlanId, 'SellingPlan');
                }

                if (! empty($line['selling_plan_name'])) {
                    $addInput['sellingPlanName'] = $line['selling_plan_name'];
                }

                $addMutation = <<<'GQL'
                mutation subscriptionDraftLineAdd($draftId: ID!, $input: SubscriptionLineInput!) {
                    subscriptionDraftLineAdd(draftId: $draftId, input: $input) {
                        lineAdded {
                            id
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
                GQL;

                $this->graphql->mutationForShop($shop, 'subscriptionDraftLineAdd', $addMutation, [
                    'draftId' => $draftId,
                    'input' => $addInput,
                ]);

                continue;
            }

            $lineId = $line['id'] ?? null;

            if (! $lineId || str_starts_with((string) $lineId, 'new:')) {
                continue;
            }

            if (! empty($line['remove'])) {
                $removeMutation = <<<'GQL'
                mutation subscriptionDraftLineRemove($draftId: ID!, $lineId: ID!) {
                    subscriptionDraftLineRemove(draftId: $draftId, lineId: $lineId) {
                        lineRemoved {
                            id
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
                GQL;

                $this->graphql->mutationForShop($shop, 'subscriptionDraftLineRemove', $removeMutation, [
                    'draftId' => $draftId,
                    'lineId' => $lineId,
                ]);

                continue;
            }

            $lineInput = array_filter([
                'quantity' => isset($line['quantity']) ? (int) $line['quantity'] : null,
                'currentPrice' => isset($line['current_price']) ? (string) $line['current_price'] : null,
            ], static fn ($value) => $value !== null);

            if ($lineInput === []) {
                continue;
            }

            $lineUpdateMutation = <<<'GQL'
            mutation subscriptionDraftLineUpdate($draftId: ID!, $lineId: ID!, $input: SubscriptionLineUpdateInput!) {
                subscriptionDraftLineUpdate(draftId: $draftId, lineId: $lineId, input: $input) {
                    lineUpdated {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL;

            $this->graphql->mutationForShop($shop, 'subscriptionDraftLineUpdate', $lineUpdateMutation, [
                'draftId' => $draftId,
                'lineId' => $lineId,
                'input' => $lineInput,
            ]);
        }

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchContract($shop, $contractGid) ?? [];
    }

    private function mapSellingPlanInterval(string $interval): string
    {
        $normalized = strtoupper(trim($interval));

        return match ($normalized) {
            'DAY', 'DAYS' => 'DAY',
            'WEEK', 'WEEKS' => 'WEEK',
            'YEAR', 'YEARS' => 'YEAR',
            'MONTH', 'MONTHS' => 'MONTH',
            default => 'MONTH',
        };
    }

    private function toShopifyGid(mixed $value, string $resource): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return $value;
        }

        if (preg_match('#gid://shopify/'.$resource.'/(\d+)$#', $value, $matches)) {
            return 'gid://shopify/'.$resource.'/'.$matches[1];
        }

        if (preg_match('/(\d+)\s*$/', $value, $matches)) {
            return 'gid://shopify/'.$resource.'/'.$matches[1];
        }

        return $value;
    }

    private function createContractDraft(User $shop, string $contractGid): string
    {
        $mutation = <<<'GQL'
        mutation subscriptionContractUpdate($contractId: ID!) {
            subscriptionContractUpdate(contractId: $contractId) {
                draft {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionContractUpdate', $mutation, [
            'contractId' => $contractGid,
        ]);

        $draftId = $result['draft']['id'] ?? null;

        if (! $draftId) {
            throw new \App\Exceptions\ShopifySellingPlanException('Unable to create subscription draft.');
        }

        return $draftId;
    }

    private function commitContractDraft(User $shop, string $draftId): void
    {
        $mutation = <<<'GQL'
        mutation subscriptionDraftCommit($draftId: ID!) {
            subscriptionDraftCommit(draftId: $draftId) {
                contract {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutationForShop($shop, 'subscriptionDraftCommit', $mutation, [
            'draftId' => $draftId,
        ]);
    }

    private function normalizeDiscount(array $discount): ?array
    {
        if ($discount === [] || empty($discount['id'])) {
            return null;
        }

        $value = $discount['value'] ?? [];
        $lines = collect($discount['entitledLines']['lines']['edges'] ?? [])
            ->map(fn (array $edge) => [
                'id' => $edge['node']['id'] ?? null,
                'title' => $edge['node']['title'] ?? null,
            ])
            ->filter(fn (array $line) => ! empty($line['id']))
            ->values()
            ->all();

        return [
            'id' => $discount['id'],
            'title' => $discount['title'] ?? 'Discount',
            'type' => $discount['type'] ?? null,
            'target_type' => $discount['targetType'] ?? null,
            'recurring_cycle_limit' => $discount['recurringCycleLimit'] ?? null,
            'usage_count' => $discount['usageCount'] ?? 0,
            'rejection_reason' => $discount['rejectionReason'] ?? null,
            'applies_to_all' => (bool) ($discount['entitledLines']['all'] ?? false),
            'lines' => $lines,
            'percentage' => isset($value['percentage']) ? (float) $value['percentage'] : null,
            'fixed_amount' => isset($value['amount']['amount']) ? (float) $value['amount']['amount'] : null,
            'currency_code' => $value['amount']['currencyCode'] ?? null,
        ];
    }

    /**
     * Update only line current prices on a subscription contract.
     *
     * @param  list<array{id: string, current_price: float|string}>  $lines
     */
    public function updateContractLinePrices(User $shop, string $contractGid, array $lines): array
    {
        $updates = collect($lines)
            ->filter(fn (array $line) => ! empty($line['id']) && array_key_exists('current_price', $line))
            ->values()
            ->all();

        if ($updates === []) {
            return $this->fetchContract($shop, $contractGid) ?? [];
        }

        $draftId = $this->createContractDraft($shop, $contractGid);

        $lineUpdateMutation = <<<'GQL'
        mutation subscriptionDraftLineUpdate($draftId: ID!, $lineId: ID!, $input: SubscriptionLineUpdateInput!) {
            subscriptionDraftLineUpdate(draftId: $draftId, lineId: $lineId, input: $input) {
                lineUpdated {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        foreach ($updates as $line) {
            $this->graphql->mutationForShop($shop, 'subscriptionDraftLineUpdate', $lineUpdateMutation, [
                'draftId' => $draftId,
                'lineId' => $line['id'],
                'input' => [
                    'currentPrice' => (string) $line['current_price'],
                ],
            ]);
        }

        $this->commitContractDraft($shop, $draftId);

        return $this->fetchContract($shop, $contractGid) ?? [];
    }

    public function chargeCycle(User $shop, string $contractGid, int $cycleIndex): array
    {
        $cycle = $this->fetchBillingCycleByIndex($shop, $contractGid, $cycleIndex);

        // Path A: expected date already in the past / next 24h, OR we can
        // schedule-edit it into that window (billingDate must stay in-cycle).
        // Then subscriptionBillingCycleCharge sets originTime = now for future dates.
        if ($this->canChargeWithCycleCharge($cycle)) {
            $this->rescheduleExpectedDateIntoChargeWindow($shop, $contractGid, $cycleIndex, $cycle);

            return $this->finalizeBillingAttempt(
                $shop,
                $this->createCycleChargeAttempt($shop, $contractGid, $cycleIndex),
                $cycleIndex
            );
        }

        // Path B: cycle starts more than 24h out — CycleCharge / ScheduleEdit
        // cannot pull expected date into the billable window (OUT_OF_BOUNDS).
        // Use AttemptCreate with originTime inside the cycle, then open any
        // SCHEDULED fulfillment orders so the order is actionable immediately.
        $attempt = $this->createBillingAttemptForCycle(
            $shop,
            $contractGid,
            $cycleIndex,
            $this->resolveOriginTimeForCycle($cycle)
        );

        $result = $this->finalizeBillingAttempt($shop, $attempt, $cycleIndex);

        if (! empty($result['order_id'])) {
            $this->openScheduledFulfillmentOrders($shop, $result['order_id']);
        }

        return $result;
    }

    /**
     * True when CycleCharge is possible: expected already ≤24h ahead, or we can
     * move expected to a date ≤24h ahead that still lies inside the cycle window.
     */
    private function canChargeWithCycleCharge(?array $cycle): bool
    {
        if (! $cycle) {
            return true;
        }

        $now = now('UTC');
        $chargeWindowEnds = $now->copy()->addHours(24);

        $expected = $this->parseCycleDate($cycle['billing_attempt_expected_date'] ?? null);

        if ($expected && $expected->lte($chargeWindowEnds)) {
            return true;
        }

        $earliestInCycle = $this->earliestChargeableDateInCycle($cycle, $now);

        return $earliestInCycle !== null && $earliestInCycle->lte($chargeWindowEnds);
    }

    private function rescheduleExpectedDateIntoChargeWindow(
        User $shop,
        string $contractGid,
        int $cycleIndex,
        ?array $cycle
    ): void {
        if (! $cycle) {
            return;
        }

        $now = now('UTC');
        $chargeWindowEnds = $now->copy()->addHours(24);
        $expected = $this->parseCycleDate($cycle['billing_attempt_expected_date'] ?? null);

        if ($expected && $expected->lte($chargeWindowEnds)) {
            return;
        }

        $billingDate = $this->earliestChargeableDateInCycle($cycle, $now);

        if (! $billingDate || $billingDate->gt($chargeWindowEnds)) {
            return;
        }

        $this->rescheduleCycle(
            $shop,
            $contractGid,
            $cycleIndex,
            $billingDate->format('Y-m-d\TH:i:s\Z')
        );
    }

    private function earliestChargeableDateInCycle(?array $cycle, Carbon $now): ?Carbon
    {
        if (! $cycle) {
            return null;
        }

        $start = $this->parseCycleDate($cycle['cycle_start_at'] ?? null);
        $end = $this->parseCycleDate($cycle['cycle_end_at'] ?? null);
        $billingDate = $now->copy()->addMinute();

        if ($start && $billingDate->lt($start)) {
            $billingDate = $start->copy()->addMinute();
        }

        if ($end && $billingDate->gte($end)) {
            $billingDate = $end->copy()->subMinute();
        }

        if ($start && $end && $billingDate->lt($start)) {
            return null;
        }

        return $billingDate;
    }

    /**
     * originTime must fall inside the cycle window. Prefer expected date so the
     * attempt matches the selected cycle; Shopify still processes payment now.
     */
    private function resolveOriginTimeForCycle(?array $cycle): string
    {
        $expected = $this->parseCycleDate($cycle['billing_attempt_expected_date'] ?? null);
        if ($expected) {
            return $expected->format('Y-m-d\TH:i:s\Z');
        }

        $start = $this->parseCycleDate($cycle['cycle_start_at'] ?? null);
        if ($start) {
            return $start->copy()->addMinute()->format('Y-m-d\TH:i:s\Z');
        }

        return now('UTC')->format('Y-m-d\TH:i:s\Z');
    }

    private function parseCycleDate(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }
    }

    private function createCycleChargeAttempt(User $shop, string $contractGid, int $cycleIndex): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionBillingCycleCharge($contractId: ID!, $index: Int!) {
            subscriptionBillingCycleCharge(
                subscriptionContractId: $contractId
                billingCycleSelector: { index: $index }
            ) {
                subscriptionBillingAttempt {
                    id
                    ready
                    errorMessage
                    originTime
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

        $result = $this->graphql->mutationForShop($shop, 'subscriptionBillingCycleCharge', $mutation, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
        ]);

        return $result['subscriptionBillingAttempt'] ?? [];
    }

    private function createBillingAttemptForCycle(
        User $shop,
        string $contractGid,
        int $cycleIndex,
        string $originTime
    ): array {
        $mutation = <<<'GQL'
        mutation subscriptionBillingAttemptCreate(
            $contractId: ID!
            $index: Int!
            $idempotencyKey: String!
            $originTime: DateTime!
        ) {
            subscriptionBillingAttemptCreate(
                subscriptionContractId: $contractId
                subscriptionBillingAttemptInput: {
                    billingCycleSelector: { index: $index }
                    idempotencyKey: $idempotencyKey
                    originTime: $originTime
                }
            ) {
                subscriptionBillingAttempt {
                    id
                    ready
                    errorMessage
                    originTime
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
            'idempotencyKey' => (string) Str::uuid(),
            'originTime' => $originTime,
        ]);

        return $result['subscriptionBillingAttempt'] ?? [];
    }

    private function finalizeBillingAttempt(User $shop, array $attempt, int $cycleIndex): array
    {
        $query = <<<'GQL'
        query GetBillingAttempt($id: ID!) {
            subscriptionBillingAttempt(id: $id) {
                id
                ready
                errorMessage
                originTime
                order {
                    id
                    name
                    displayFinancialStatus
                }
            }
        }
        GQL;

        $attemptData = $attempt;

        if (! empty($attempt['id']) && empty($attempt['ready'])) {
            for ($i = 0; $i < 5; $i++) {
                sleep(2);

                $attemptData = $this->graphql->mutationForShop(
                    $shop,
                    'subscriptionBillingAttempt',
                    $query,
                    ['id' => $attempt['id']]
                );

                if (($attemptData['ready'] ?? false) === true) {
                    break;
                }
            }
        }

        return [
            'id' => $attemptData['id'] ?? ($attempt['id'] ?? null),
            'ready' => $attemptData['ready'] ?? ($attempt['ready'] ?? null),
            'error_message' => $attemptData['errorMessage'] ?? ($attempt['errorMessage'] ?? null),
            'order_id' => $attemptData['order']['id'] ?? ($attempt['order']['id'] ?? null),
            'order_name' => $attemptData['order']['name'] ?? ($attempt['order']['name'] ?? null),
            'order_financial_status' => $attemptData['order']['displayFinancialStatus']
                ?? ($attempt['order']['displayFinancialStatus'] ?? null),
            'origin_time' => $attemptData['originTime'] ?? ($attempt['originTime'] ?? null),
            'cycle_index' => $cycleIndex,
        ];
    }

    /**
     * Mark SCHEDULED fulfillment orders as OPEN (same as Admin "Fulfill early").
     */
    private function openScheduledFulfillmentOrders(User $shop, string $orderGid): void
    {
        $query = <<<'GQL'
        query OrderFulfillmentOrders($id: ID!) {
            order(id: $id) {
                fulfillmentOrders(first: 20) {
                    edges {
                        node {
                            id
                            status
                            fulfillAt
                        }
                    }
                }
            }
        }
        GQL;

        try {
            $data = $this->graphql->executeForShop($shop, $query, ['id' => $orderGid]);
        } catch (\Throwable $e) {
            Log::warning('Unable to load fulfillment orders after charge', [
                'order_id' => $orderGid,
                'message' => $e->getMessage(),
            ]);

            return;
        }

        $edges = $data['order']['fulfillmentOrders']['edges'] ?? [];
        $mutation = <<<'GQL'
        mutation fulfillmentOrderOpen($id: ID!) {
            fulfillmentOrderOpen(id: $id) {
                fulfillmentOrder {
                    id
                    status
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        foreach ($edges as $edge) {
            $fo = $edge['node'] ?? [];
            $foId = $fo['id'] ?? null;
            $status = strtoupper((string) ($fo['status'] ?? ''));

            if (! $foId || $status !== 'SCHEDULED') {
                continue;
            }

            try {
                $this->graphql->mutationForShop($shop, 'fulfillmentOrderOpen', $mutation, [
                    'id' => $foId,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Unable to open scheduled fulfillment order after charge', [
                    'order_id' => $orderGid,
                    'fulfillment_order_id' => $foId,
                    'message' => $e->getMessage(),
                ]);
            }
        }
    }

    public function fetchBillingCycleByIndex(User $shop, string $contractGid, int $cycleIndex): ?array
    {
        $query = <<<'GQL'
        query subscriptionBillingCycle($contractId: ID!, $index: Int!) {
            subscriptionBillingCycle(
                billingCycleInput: {
                    contractId: $contractId
                    selector: { index: $index }
                }
            ) {
                cycleIndex
                skipped
                status
                billingAttemptExpectedDate
                cycleStartAt
                cycleEndAt
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
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'contractId' => $contractGid,
            'index' => $cycleIndex,
        ]);

        return $this->normalizeBillingCycle($data['subscriptionBillingCycle'] ?? []);
    }

    public function fetchBillingCycleByDate(User $shop, string $contractGid, string $date): ?array
    {
        $query = <<<'GQL'
        query subscriptionBillingCycleByDate($contractId: ID!, $date: DateTime!) {
            subscriptionBillingCycle(
                billingCycleInput: {
                    contractId: $contractId
                    selector: { date: $date }
                }
            ) {
                cycleIndex
                skipped
                status
                billingAttemptExpectedDate
                cycleStartAt
                cycleEndAt
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
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'contractId' => $contractGid,
            'date' => $date,
        ]);

        return $this->normalizeBillingCycle($data['subscriptionBillingCycle'] ?? []);
    }

    /**
     * Find the next chargeable cycle after $afterCycleIndex and return its expected billing date.
     */
    public function resolveNextBillingDateAfterCycle(
        User $shop,
        string $contractGid,
        int $afterCycleIndex
    ): ?string {
        $maxLookahead = 12;

        for ($offset = 1; $offset <= $maxLookahead; $offset++) {
            $cycle = $this->fetchBillingCycleByIndex($shop, $contractGid, $afterCycleIndex + $offset);

            if (! $cycle) {
                continue;
            }

            if (! empty($cycle['skipped'])) {
                continue;
            }

            $status = strtoupper((string) ($cycle['status'] ?? ''));
            if ($status === 'BILLED') {
                continue;
            }

            $expected = $cycle['billing_attempt_expected_date'] ?? null;

            if (is_string($expected) && $expected !== '') {
                return $expected;
            }
        }

        $contract = $this->fetchContract($shop, $contractGid);

        return $contract['nextBillingDate'] ?? null;
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

    /**
     * Numeric Partner app id for this installation (matches Order.app_id on auto-charge orders).
     */
    public function fetchCurrentAppLegacyId(User $shop): ?int
    {
        $cacheKey = 'shopify_current_app_legacy_id';

        $cached = cache()->get($cacheKey);

        if (is_int($cached) || (is_string($cached) && is_numeric($cached))) {
            return (int) $cached;
        }

        $data = $this->graphql->executeForShop($shop, <<<'GQL'
        {
            currentAppInstallation {
                app {
                    id
                }
            }
        }
        GQL);

        $appGid = $data['currentAppInstallation']['app']['id'] ?? null;

        if (! is_string($appGid) || $appGid === '') {
            return null;
        }

        $parts = explode('/', $appGid);
        $legacyId = end($parts);

        if (! is_numeric($legacyId)) {
            return null;
        }

        $legacyId = (int) $legacyId;
        cache()->put($cacheKey, $legacyId, now()->addDay());

        return $legacyId;
    }

    /**
     * Load an order with line-item subscription contracts (own contracts only).
     *
     * @return array{
     *   id: ?string,
     *   legacy_resource_id: ?string,
     *   name: ?string,
     *   financial_status: ?string,
     *   fulfillment_status: ?string,
     *   processed_at: ?string,
     *   created_at: ?string,
     *   total_price: ?string,
     *   currency_code: ?string,
     *   contract_gids: list<string>
     * }|null
     */
    public function fetchOrderSubscriptionContext(User $shop, string $orderGid): ?array
    {
        $query = <<<'GQL'
        query OrderSubscriptionContext($id: ID!) {
            order(id: $id) {
                id
                legacyResourceId
                name
                displayFinancialStatus
                displayFulfillmentStatus
                processedAt
                createdAt
                totalPriceSet {
                    shopMoney {
                        amount
                        currencyCode
                    }
                }
                lineItems(first: 50) {
                    edges {
                        node {
                            contract {
                                id
                                app {
                                    id
                                }
                            }
                            sellingPlan {
                                name
                                sellingPlanId
                            }
                        }
                    }
                }
            }
        }
        GQL;

        $data = $this->graphql->executeForShop($shop, $query, [
            'id' => $orderGid,
        ]);

        $order = $data['order'] ?? null;

        if ($order === null) {
            return null;
        }

        $contractGids = [];

        foreach ($order['lineItems']['edges'] ?? [] as $edge) {
            $contractId = $edge['node']['contract']['id'] ?? null;

            if (is_string($contractId) && $contractId !== '') {
                $contractGids[$contractId] = $contractId;
            }
        }

        $money = $order['totalPriceSet']['shopMoney'] ?? [];

        return [
            'id' => $order['id'] ?? null,
            'legacy_resource_id' => isset($order['legacyResourceId'])
                ? (string) $order['legacyResourceId']
                : null,
            'name' => $order['name'] ?? null,
            'financial_status' => $order['displayFinancialStatus'] ?? null,
            'fulfillment_status' => $order['displayFulfillmentStatus'] ?? null,
            'processed_at' => $order['processedAt'] ?? null,
            'created_at' => $order['createdAt'] ?? null,
            'total_price' => $money['amount'] ?? null,
            'currency_code' => $money['currencyCode'] ?? null,
            'contract_gids' => array_values($contractGids),
        ];
    }

    /**
     * Map Shopify variant legacy IDs to image URLs (variant image, else product featured).
     *
     * @param  list<int|string>  $variantIds
     * @return array<int, string>
     */
    public function fetchVariantImageUrls(User $shop, array $variantIds): array
    {
        $gids = [];

        foreach ($variantIds as $variantId) {
            if ($variantId === null || $variantId === '') {
                continue;
            }

            $gid = is_string($variantId) && str_starts_with($variantId, 'gid://')
                ? $variantId
                : 'gid://shopify/ProductVariant/'.(int) $variantId;

            $gids[$gid] = (int) (is_numeric($variantId)
                ? $variantId
                : (preg_match('/(\d+)$/', (string) $variantId, $m) ? $m[1] : 0));
        }

        $gids = array_filter($gids);
        if ($gids === []) {
            return [];
        }

        $query = <<<'GQL'
        query VariantImages($ids: [ID!]!) {
            nodes(ids: $ids) {
                ... on ProductVariant {
                    id
                    legacyResourceId
                    image {
                        url
                    }
                    product {
                        featuredImage {
                            url
                        }
                    }
                }
            }
        }
        GQL;

        try {
            $data = $this->graphql->executeForShop($shop, $query, [
                'ids' => array_keys($gids),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Unable to fetch variant images for invoice products', [
                'shop_id' => $shop->id,
                'message' => $exception->getMessage(),
            ]);

            return [];
        }

        $images = [];

        foreach ($data['nodes'] ?? [] as $node) {
            if (! is_array($node) || empty($node['legacyResourceId'])) {
                continue;
            }

            $url = $node['image']['url']
                ?? $node['product']['featuredImage']['url']
                ?? null;

            if (is_string($url) && $url !== '') {
                $images[(int) $node['legacyResourceId']] = $url;
            }
        }

        return $images;
    }

    /**
     * Prepaid origin order → scheduled / open fulfillment orders (process deliveries).
     *
     * @param  list<string>  $orderGids
     */
    public function fetchPrepaidFulfillments(User $shop, array $orderGids): array
    {
        $fulfillments = [];

        foreach (array_values(array_unique(array_filter($orderGids))) as $orderGid) {
            $query = <<<'GQL'
            query OrderFulfillmentOrders($id: ID!) {
                order(id: $id) {
                    id
                    name
                    fulfillmentOrders(first: 50) {
                        edges {
                            node {
                                id
                                status
                                fulfillAt
                                assignedLocation {
                                    location {
                                        id
                                    }
                                }
                                destination {
                                    firstName
                                    lastName
                                    address1
                                    address2
                                    city
                                    province
                                    zip
                                    countryCode
                                }
                                lineItems(first: 25) {
                                    edges {
                                        node {
                                            id
                                            totalQuantity
                                            remainingQuantity
                                            lineItem {
                                                id
                                                name
                                                variantTitle
                                                sku
                                            }
                                        }
                                    }
                                }
                                fulfillments(first: 5) {
                                    edges {
                                        node {
                                            id
                                            status
                                            trackingInfo {
                                                company
                                                number
                                                url
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            GQL;

            $data = $this->graphql->executeForShop($shop, $query, ['id' => $orderGid]);
            $order = $data['order'] ?? null;

            if (! is_array($order) || empty($order['id'])) {
                continue;
            }

            foreach ($order['fulfillmentOrders']['edges'] ?? [] as $edge) {
                $node = $edge['node'] ?? null;

                if (! is_array($node) || empty($node['id'])) {
                    continue;
                }

                $fulfillments[] = $this->normalizeFulfillmentOrder($node, $order);
            }
        }

        usort($fulfillments, function (array $a, array $b) {
            $aTime = $a['fulfill_at'] ? strtotime($a['fulfill_at']) : PHP_INT_MAX;
            $bTime = $b['fulfill_at'] ? strtotime($b['fulfill_at']) : PHP_INT_MAX;

            return $aTime <=> $bTime;
        });

        $fulfilled = 0;
        $pending = 0;
        $nextFulfillment = null;

        foreach ($fulfillments as $fo) {
            $bucket = $fo['status_bucket'];

            if ($bucket === 'fulfilled') {
                $fulfilled++;
            } elseif (in_array($bucket, ['unfulfilled', 'scheduled', 'in_progress'], true)) {
                $pending++;

                if ($nextFulfillment === null && ! empty($fo['fulfill_at'])) {
                    $nextFulfillment = $fo['fulfill_at'];
                }
            }
        }

        $total = count($fulfillments);
        $progress = $total > 0 ? (int) round(($fulfilled / $total) * 100) : 0;

        return [
            'summary' => [
                'total' => $total,
                'fulfilled' => $fulfilled,
                'pending' => $pending,
                'next_fulfillment' => $nextFulfillment,
                'progress' => $progress,
            ],
            'fulfillments' => $fulfillments,
        ];
    }

    public function rescheduleFulfillmentOrder(User $shop, string $fulfillmentOrderGid, string $fulfillAt): array
    {
        $mutation = <<<'GQL'
        mutation fulfillmentOrderReschedule($id: ID!, $fulfillAt: DateTime!) {
            fulfillmentOrderReschedule(id: $id, fulfillAt: $fulfillAt) {
                fulfillmentOrder {
                    id
                    status
                    fulfillAt
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'fulfillmentOrderReschedule', $mutation, [
            'id' => $fulfillmentOrderGid,
            'fulfillAt' => $fulfillAt,
        ]);

        $fo = $result['fulfillmentOrder'] ?? [];

        return [
            'id' => $fo['id'] ?? $fulfillmentOrderGid,
            'status' => $fo['status'] ?? null,
            'fulfill_at' => $fo['fulfillAt'] ?? $fulfillAt,
        ];
    }

    public function setContractNextBillingDate(User $shop, string $contractGid, string $date): array
    {
        $mutation = <<<'GQL'
        mutation subscriptionContractSetNextBillingDate($contractId: ID!, $date: DateTime!) {
            subscriptionContractSetNextBillingDate(contractId: $contractId, date: $date) {
                contract {
                    id
                    nextBillingDate
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'subscriptionContractSetNextBillingDate', $mutation, [
            'contractId' => $contractGid,
            'date' => $date,
        ]);

        return [
            'id' => $result['contract']['id'] ?? $contractGid,
            'next_billing_date' => $result['contract']['nextBillingDate'] ?? $date,
        ];
    }

    /**
     * Refund one prepaid fulfillment cycle (quantity 1 per FO line item).
     */
    public function refundFulfillmentOrder(User $shop, string $orderGid, array $fulfillmentOrder): array
    {
        $locationId = $fulfillmentOrder['location_id'] ?? null;
        $refundLineItems = [];

        foreach ($fulfillmentOrder['line_items'] ?? [] as $line) {
            $lineItemId = $line['line_item_id'] ?? null;
            $qty = max(1, (int) ($line['remaining_quantity'] ?? $line['quantity'] ?? 1));

            if (! $lineItemId) {
                continue;
            }

            $item = [
                'lineItemId' => $lineItemId,
                'quantity' => $qty,
                'restockType' => 'CANCEL',
            ];

            if ($locationId) {
                $item['locationId'] = $locationId;
            }

            $refundLineItems[] = $item;
        }

        if ($refundLineItems === []) {
            throw new \RuntimeException('No refundable line items on this fulfillment order.');
        }

        $mutation = <<<'GQL'
        mutation refundCreate($input: RefundInput!) {
            refundCreate(input: $input) {
                refund {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutationForShop($shop, 'refundCreate', $mutation, [
            'input' => [
                'orderId' => $orderGid,
                'refundLineItems' => $refundLineItems,
                'notify' => true,
            ],
        ]);

        return [
            'id' => $result['refund']['id'] ?? null,
        ];
    }

    private function normalizeFulfillmentOrder(array $node, array $order): array
    {
        $status = strtoupper((string) ($node['status'] ?? ''));
        $bucket = match ($status) {
            'CLOSED', 'FULFILLED' => 'fulfilled',
            'CANCELLED' => 'cancelled',
            'IN_PROGRESS', 'INCOMPLETE' => 'in_progress',
            'SCHEDULED' => 'scheduled',
            default => 'unfulfilled', // OPEN and others
        };

        $displayStatus = match ($bucket) {
            'fulfilled' => 'Fulfilled',
            'cancelled' => 'Cancelled',
            'in_progress' => 'In progress',
            'scheduled' => 'Scheduled',
            default => 'Unfulfilled',
        };

        $lineItems = [];

        foreach ($node['lineItems']['edges'] ?? [] as $edge) {
            $li = $edge['node'] ?? [];
            $product = $li['lineItem'] ?? [];
            $name = (string) ($product['name'] ?? 'Item');
            $variant = trim((string) ($product['variantTitle'] ?? ''));

            if ($variant !== '' && $variant !== 'Default Title' && ! str_contains($name, $variant)) {
                $name .= " ({$variant})";
            }

            $lineItems[] = [
                'id' => $li['id'] ?? null,
                'line_item_id' => $product['id'] ?? null,
                'name' => $name,
                'sku' => $product['sku'] ?? null,
                'quantity' => (int) ($li['totalQuantity'] ?? 0),
                'remaining_quantity' => (int) ($li['remainingQuantity'] ?? $li['totalQuantity'] ?? 0),
            ];
        }

        $destination = $node['destination'] ?? [];
        $destinationParts = array_values(array_filter([
            trim(implode(' ', array_filter([
                $destination['firstName'] ?? null,
                $destination['lastName'] ?? null,
            ]))),
            $destination['address1'] ?? null,
            $destination['address2'] ?? null,
            trim(implode(' ', array_filter([
                $destination['city'] ?? null,
                $destination['province'] ?? null,
                $destination['zip'] ?? null,
            ]))),
        ]));

        $tracking = null;

        foreach ($node['fulfillments']['edges'] ?? [] as $fulfillmentEdge) {
            $fulfillment = $fulfillmentEdge['node'] ?? [];

            foreach ($fulfillment['trackingInfo'] ?? [] as $info) {
                $number = $info['number'] ?? null;

                if ($number) {
                    $tracking = [
                        'number' => $number,
                        'url' => $info['url'] ?? null,
                        'company' => $info['company'] ?? null,
                    ];
                    break 2;
                }
            }
        }

        return [
            'id' => $node['id'],
            'order_id' => $order['id'] ?? null,
            'order_name' => $order['name'] ?? null,
            'status' => $status,
            'status_bucket' => $bucket,
            'display_status' => $displayStatus,
            'fulfill_at' => $node['fulfillAt'] ?? null,
            'location_id' => $node['assignedLocation']['location']['id'] ?? null,
            'destination' => $destinationParts !== [] ? implode(', ', $destinationParts) : null,
            'line_items' => $lineItems,
            'tracking' => $tracking,
            'can_reschedule' => $status === 'SCHEDULED',
            'can_skip' => $status === 'SCHEDULED',
            'can_refund' => $status === 'SCHEDULED',
        ];
    }

    /**
     * Create a Shopify draft order + send invoice for a local recurring-invoice subscription.
     *
     * @return array{
     *   success: bool,
     *   draftOrderId?: ?string,
     *   invoiceUrl?: ?string,
     *   invoiceSent?: bool,
     *   errors?: list<array{message?: string, field?: mixed}>
     * }
     */
    public function createDraftFromRecurringInvoiceSubscription(
        User $shop,
        Subscription $subscription,
        SubscriptionInvoice $invoice
    ): array {
        $subscription->loadMissing(['customer', 'products', 'shipping']);

        $customer = $subscription->customer;
        $shipping = $subscription->shipping;

        if (! $customer || empty($customer->shopify_customer_id)) {
            return [
                'success' => false,
                'errors' => [['message' => 'Subscription customer is missing Shopify customer id.']],
            ];
        }

        if (empty($customer->email)) {
            return [
                'success' => false,
                'errors' => [['message' => 'Customer email not found.']],
            ];
        }

        $planOption = $subscription->subscription_plan_option_id
            ? SubscriptionPlanOption::query()->find($subscription->subscription_plan_option_id)
            : null;

        $preservedAttrs = [];
        foreach ($invoice->line_item_properties ?? [] as $property) {
            $key = (string) ($property['key'] ?? $property['name'] ?? '');
            $value = (string) ($property['value'] ?? '');
            if ($key === '') {
                continue;
            }
            $preservedAttrs[] = ['key' => $key, 'value' => $value];
        }

        $lineItems = [];

        foreach ($subscription->products as $product) {
            $variantId = $product->shopify_variant_id ?? null;
            $qty = max(1, (int) ($product->quantity ?? 1));
            $price = (float) ($product->current_price ?? 0);

            if (! $variantId) {
                continue;
            }

            $customAttributes = array_merge(
                [
                    ['key' => '_subscription_type', 'value' => 'recurring_invoice'],
                    ['key' => '_subscription_id', 'value' => (string) $subscription->id],
                    ['key' => '_invoice_id', 'value' => (string) $invoice->id],
                    ['key' => '_cycle_index', 'value' => (string) $invoice->cycle_index],
                ],
                $preservedAttrs
            );

            $lineItem = [
                'quantity' => $qty,
                'title' => $product->title ?: 'Subscription item',
                'variantId' => 'gid://shopify/ProductVariant/'.$variantId,
                'originalUnitPrice' => number_format($price, 2, '.', ''),
                'customAttributes' => $customAttributes,
            ];

            $discount = $this->buildRecurringInvoiceLineDiscount($planOption, $price, $qty);
            if ($discount !== null) {
                $lineItem['appliedDiscount'] = $discount;
            }

            $lineItems[] = $lineItem;
        }

        if ($lineItems === []) {
            return [
                'success' => false,
                'errors' => [['message' => 'No line items found for recurring-invoice subscription.']],
            ];
        }

        $cycleIndex = (int) $invoice->cycle_index;
        $draftInput = [
            'customerId' => 'gid://shopify/Customer/'.$customer->shopify_customer_id,
            'email' => $customer->email,
            'lineItems' => $lineItems,
            'tags' => ['subscription', 'recurring-invoice', 'subscription-'.$subscription->id],
            'note' => "Recurring invoice for subscription #{$subscription->id} — cycle #{$cycleIndex}",
            'customAttributes' => [
                ['key' => 'Subscription interval', 'value' => 'recurring_invoice'],
                ['key' => '_subscription_id', 'value' => (string) $subscription->id],
                ['key' => '_invoice_id', 'value' => (string) $invoice->id],
                ['key' => '_cycle_index', 'value' => (string) $cycleIndex],
            ],
        ];

        if ($shipping) {
            $address = array_filter([
                'firstName' => $shipping->first_name ?: ($customer->first_name ?? null),
                'lastName' => $shipping->last_name ?: ($customer->last_name ?? null),
                'company' => $shipping->company,
                'address1' => $shipping->address1,
                'address2' => $shipping->address2,
                'city' => $shipping->city,
                'province' => $shipping->province,
                'country' => $shipping->country_code ?: $shipping->country,
                'zip' => $shipping->zip,
                'phone' => $shipping->phone ?: ($customer->phone ?? null),
            ], fn ($value) => $value !== null && $value !== '');

            if ($address !== []) {
                $draftInput['shippingAddress'] = $address;
                $draftInput['billingAddress'] = $address;
            }
        }

        $draftMutation = <<<'GQL'
        mutation CreateDraftOrder($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
                draftOrder {
                    id
                    invoiceUrl
                    name
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        try {
            $draftResult = $this->graphql->mutationForShop(
                $shop,
                'draftOrderCreate',
                $draftMutation,
                ['input' => $draftInput]
            );
        } catch (ShopifySellingPlanException $exception) {
            return [
                'success' => false,
                'errors' => $exception->userErrors !== []
                    ? $exception->userErrors
                    : [['message' => $exception->getMessage()]],
            ];
        }

        $draftOrderId = $draftResult['draftOrder']['id'] ?? null;
        $invoiceUrl = $draftResult['draftOrder']['invoiceUrl'] ?? null;
        $draftName = $draftResult['draftOrder']['name'] ?? null;

        if (! $draftOrderId) {
            return [
                'success' => false,
                'errors' => [['message' => 'Draft order ID not returned after creation.']],
            ];
        }

        $sendResult = $this->resendDraftOrderInvoice(
            $shop,
            (string) $draftOrderId,
            (string) $customer->email,
            is_string($draftName) ? $draftName : null
        );

        if (! ($sendResult['success'] ?? false)) {
            return [
                'success' => false,
                'errors' => $sendResult['errors'] ?? [['message' => 'Failed to send draft invoice.']],
                'draftOrderId' => $draftOrderId,
                'invoiceUrl' => $invoiceUrl,
                'invoiceSent' => false,
            ];
        }

        return [
            'success' => true,
            'errors' => [],
            'draftOrderId' => $draftOrderId,
            'invoiceUrl' => $sendResult['invoiceUrl'] ?? $invoiceUrl,
            'invoiceSent' => true,
        ];
    }

    /**
     * @return array{success: bool, errors?: list<array>, draftOrderId?: string, invoiceUrl?: ?string}
     */
    public function resendDraftOrderInvoice(
        User $shop,
        string $draftOrderId,
        string $customerEmail,
        ?string $draftName = null
    ): array {
        $gid = str_starts_with($draftOrderId, 'gid://')
            ? $draftOrderId
            : 'gid://shopify/DraftOrder/'.$draftOrderId;

        $invoiceMutation = <<<'GQL'
        mutation SendDraftOrderInvoice($id: ID!, $email: EmailInput) {
            draftOrderInvoiceSend(id: $id, email: $email) {
                draftOrder {
                    id
                    invoiceUrl
                    status
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $emailInput = [
            'to' => $customerEmail,
            'subject' => $draftName
                ? "Your Subscription Invoice — {$draftName}"
                : 'Your Subscription Invoice',
            'customMessage' => 'Please review and complete your recurring order by clicking the link below.',
        ];

        try {
            $invoiceResult = $this->graphql->mutationForShop(
                $shop,
                'draftOrderInvoiceSend',
                $invoiceMutation,
                [
                    'id' => $gid,
                    'email' => $emailInput,
                ]
            );
        } catch (ShopifySellingPlanException $exception) {
            return [
                'success' => false,
                'errors' => $exception->userErrors !== []
                    ? $exception->userErrors
                    : [['message' => $exception->getMessage()]],
            ];
        }

        return [
            'success' => true,
            'errors' => [],
            'draftOrderId' => $gid,
            'invoiceUrl' => $invoiceResult['draftOrder']['invoiceUrl'] ?? null,
        ];
    }

    /**
     * @return array{title: string, value: float, valueType: string, amount: float, description: string}|null
     */
    private function buildRecurringInvoiceLineDiscount(
        ?SubscriptionPlanOption $planOption,
        float $price,
        int $qty
    ): ?array {
        if (! $planOption || ! $planOption->give_discount) {
            return null;
        }

        $discountAmount = (float) ($planOption->discount_amount ?? 0);
        if ($discountAmount <= 0) {
            return null;
        }

        $type = strtolower((string) ($planOption->discount_type ?? ''));
        $isPercent = str_contains($type, 'percent') || $type === 'percentage';

        if ($isPercent) {
            $calculated = round(($price * $qty) * ($discountAmount / 100), 2);

            return [
                'title' => "{$discountAmount}% Subscription Discount",
                'value' => $discountAmount,
                'valueType' => 'PERCENTAGE',
                'amount' => $calculated,
                'description' => 'Recurring subscription discount',
            ];
        }

        $lineTotal = round($price * $qty, 2);
        $capped = min($discountAmount, $lineTotal);

        return [
            'title' => 'Subscription Discount',
            'value' => $capped,
            'valueType' => 'FIXED_AMOUNT',
            'amount' => $capped,
            'description' => 'Recurring subscription discount',
        ];
    }
}
