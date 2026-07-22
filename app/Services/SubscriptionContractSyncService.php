<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Subscription;
use App\Models\SubscriptionProduct;
use App\Models\SubscriptionRecurringOrder;
use App\Models\SubscriptionShipping;
use App\Models\User;
use App\Services\Shopify\ShopifySubscriptionContractService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use stdClass;

class SubscriptionContractSyncService
{
    public function __construct(
        protected ShopifySubscriptionContractService $shopifySubscriptionContractService,
        protected SubscriptionActivityLogService $activityLogService
    ) {}

    public function syncFromWebhook(User $shop, stdClass $payload): ?Subscription
    {
        $contractGid = (string) ($payload->admin_graphql_api_id ?? '');
        $incomingRevisionId = (int) ($payload->revision_id ?? 0);
        $shopifyContractId = (int) ($payload->id ?? 0);

        if ($contractGid === '' || $shopifyContractId === 0) {
            Log::warning('Subscription contract webhook missing contract id', [
                'shop_id' => $shop->id,
                'payload' => $payload,
            ]);

            return null;
        }

        $existing = Subscription::query()
            ->where('shop_id', $shop->id)
            ->where('shopify_contract_id', $shopifyContractId)
            ->first();

        if (
            $existing !== null
            && $existing->shopify_revision_id !== null
            && (int) $existing->shopify_revision_id > $incomingRevisionId
        ) {
            Log::info('Skipping stale subscription contract webhook', [
                'shop_id' => $shop->id,
                'shopify_contract_id' => $shopifyContractId,
                'stored_revision_id' => $existing->shopify_revision_id,
                'incoming_revision_id' => $incomingRevisionId,
            ]);

            return $existing;
        }

        $previousStatus = $existing?->status;
        $wasNew = $existing === null;

        $contract = $this->shopifySubscriptionContractService->fetchContract($shop, $contractGid);

        if ($contract === null) {
            Log::warning('Subscription contract not found in Shopify', [
                'shop_id' => $shop->id,
                'contract_gid' => $contractGid,
            ]);

            $subscription = $this->syncFromWebhookPayloadOnly($shop, $payload);
            if ($subscription !== null) {
                $this->logWebhookLifecycle($subscription, $previousStatus, $wasNew);
            }

            return $subscription;
        }

        $subscription = $this->persistContract($shop, $contract, $payload);
        $this->logWebhookLifecycle($subscription, $previousStatus, $wasNew);

        return $subscription;
    }

    public function syncFromContractGid(User $shop, string $contractGid): ?Subscription
    {
        $contract = $this->shopifySubscriptionContractService->fetchContract($shop, $contractGid);

        if ($contract === null) {
            Log::warning('Subscription contract not found in Shopify during manual sync', [
                'shop_id' => $shop->id,
                'contract_gid' => $contractGid,
            ]);

            return null;
        }

        $payload = (object) [
            'id' => $this->gidToId($contract['id'] ?? null),
            'admin_graphql_api_id' => $contract['id'] ?? null,
            'revision_id' => $contract['revisionId'] ?? 0,
            'status' => $contract['status'] ?? 'active',
            'currency_code' => $contract['currencyCode'] ?? 'USD',
        ];

        return $this->persistContract($shop, $contract, $payload);
    }

    /**
     * Persist a subscription order from ORDERS_CREATE into recurring order history.
     *
     * Uses line-item contracts (own app only), then origin-order fallback.
     *
     * @return array{recorded: bool, retry: bool, subscription_id: ?int}
     */
    public function syncRecurringOrderFromCreate(User $shop, array $orderPayload): array
    {
        $orderId = isset($orderPayload['id']) ? (int) $orderPayload['id'] : 0;
        $orderGid = $orderPayload['admin_graphql_api_id']
            ?? ($orderId > 0 ? 'gid://shopify/Order/'.$orderId : null);

        if ($orderId <= 0 || ! is_string($orderGid) || $orderGid === '') {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null];
        }

        if (! $this->orderLooksSubscriptionRelated($shop, $orderPayload, $orderId)) {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null];
        }

        $context = null;

        try {
            $context = $this->shopifySubscriptionContractService
                ->fetchOrderSubscriptionContext($shop, $orderGid);
        } catch (\Throwable $exception) {
            Log::warning('Failed to load order subscription context', [
                'shop_id' => $shop->id,
                'order_id' => $orderId,
                'message' => $exception->getMessage(),
            ]);
        }

        $subscriptions = $this->resolveSubscriptionsForOrder(
            $shop,
            $orderId,
            $context['contract_gids'] ?? []
        );

        if ($subscriptions === []) {
            $hasSellingPlan = $this->payloadHasSellingPlan($orderPayload);
            $hasContractOnOrder = ($context['contract_gids'] ?? []) !== [];

            // Origin checkout: contract may lag behind ORDERS_CREATE.
            if ($hasSellingPlan && ! $hasContractOnOrder) {
                return ['recorded' => false, 'retry' => true, 'subscription_id' => null];
            }

            return ['recorded' => false, 'retry' => false, 'subscription_id' => null];
        }

        $attributes = $this->buildRecurringOrderAttributes($orderPayload, $context);
        $recordedFor = null;

        foreach ($subscriptions as $subscription) {
            SubscriptionRecurringOrder::query()->updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'shopify_order_id' => $orderId,
                ],
                $attributes + [
                    'currency_code' => $attributes['currency_code'] ?? $subscription->currency_code,
                ]
            );
            $recordedFor = $subscription->id;
        }

        return [
            'recorded' => true,
            'retry' => false,
            'subscription_id' => $recordedFor,
        ];
    }

    /**
     * @param  list<string>  $contractGids
     * @return list<Subscription>
     */
    private function resolveSubscriptionsForOrder(User $shop, int $orderId, array $contractGids): array
    {
        $found = [];

        foreach ($contractGids as $contractGid) {
            $subscription = Subscription::query()
                ->where('shop_id', $shop->id)
                ->where('shopify_gid', $contractGid)
                ->first();

            if (! $subscription) {
                $subscription = $this->syncFromContractGid($shop, $contractGid);
            }

            if ($subscription) {
                $found[$subscription->id] = $subscription;
            }
        }

        if ($found !== []) {
            return array_values($found);
        }

        $byOrigin = Subscription::query()
            ->where('shop_id', $shop->id)
            ->where('shopify_origin_order_id', $orderId)
            ->get();

        foreach ($byOrigin as $subscription) {
            $found[$subscription->id] = $subscription;
        }

        return array_values($found);
    }

    private function orderLooksSubscriptionRelated(User $shop, array $orderPayload, int $orderId): bool
    {
        if ($this->payloadHasSellingPlan($orderPayload)) {
            return true;
        }

        $sourceName = strtolower((string) ($orderPayload['source_name'] ?? ''));

        if ($sourceName !== '' && str_contains($sourceName, 'subscription')) {
            return true;
        }

        $orderAppId = $orderPayload['app_id'] ?? null;

        if ($orderAppId !== null && $orderAppId !== '') {
            try {
                $ourAppId = $this->shopifySubscriptionContractService->fetchCurrentAppLegacyId($shop);

                if ($ourAppId !== null && (int) $orderAppId === $ourAppId) {
                    return true;
                }
            } catch (\Throwable $exception) {
                Log::warning('Unable to resolve current Shopify app id for order filter', [
                    'shop_id' => $shop->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return Subscription::query()
            ->where('shop_id', $shop->id)
            ->where('shopify_origin_order_id', $orderId)
            ->exists();
    }

    private function payloadHasSellingPlan(array $orderPayload): bool
    {
        foreach ($orderPayload['line_items'] ?? [] as $lineItem) {
            if (! empty($lineItem['selling_plan_allocation']) || ! empty($lineItem['selling_plan_id'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>|null  $context
     * @return array{
     *   shopify_gid: ?string,
     *   order_name: ?string,
     *   financial_status: ?string,
     *   fulfillment_status: ?string,
     *   total_price: mixed,
     *   currency_code: ?string,
     *   processed_at: ?Carbon,
     *   shopify_created_at: ?Carbon
     * }
     */
    private function buildRecurringOrderAttributes(array $orderPayload, ?array $context): array
    {
        $financial = $context['financial_status']
            ?? (isset($orderPayload['financial_status'])
                ? strtoupper((string) $orderPayload['financial_status'])
                : null);

        $fulfillment = $context['fulfillment_status']
            ?? (isset($orderPayload['fulfillment_status'])
                ? strtoupper((string) $orderPayload['fulfillment_status'])
                : null);

        return [
            'shopify_gid' => $context['id']
                ?? $orderPayload['admin_graphql_api_id']
                ?? null,
            'order_name' => $context['name'] ?? ($orderPayload['name'] ?? null),
            'financial_status' => $financial,
            'fulfillment_status' => $fulfillment,
            'total_price' => $context['total_price'] ?? ($orderPayload['total_price'] ?? null),
            'currency_code' => $context['currency_code'] ?? ($orderPayload['currency'] ?? null),
            'processed_at' => $this->parseDate(
                $context['processed_at'] ?? ($orderPayload['processed_at'] ?? null)
            ),
            'shopify_created_at' => $this->parseDate(
                $context['created_at'] ?? ($orderPayload['created_at'] ?? null)
            ),
        ];
    }

    private function persistContract(User $shop, array $contract, stdClass $payload): Subscription
    {
        return DB::transaction(function () use ($shop, $payload, $contract) {
            $customer = $this->syncCustomer($shop, $contract, $payload);
            $subscription = $this->syncSubscription($shop, $customer, $contract, $payload);

            $this->syncProducts($subscription, $contract);
            $this->syncShipping($subscription, $contract);
            $this->syncRecurringOrders($subscription, $contract);

            return $subscription->fresh([
                'customer',
                'products',
                'shipping',
                'recurringOrders',
            ]);
        });
    }

    private function syncFromWebhookPayloadOnly(
        User $shop,
        stdClass $payload
    ): ?Subscription {
        $customer = Customer::query()->updateOrCreate(
            [
                'shop_id' => $shop->id,
                'shopify_customer_id' => (int) ($payload->customer_id ?? 0),
            ],
            [
                'shopify_gid' => $payload->admin_graphql_api_customer_id ?? null,
            ]
        );

        $billingPolicy = $payload->billing_policy ?? null;
        $deliveryPolicy = $payload->delivery_policy ?? null;

        return Subscription::query()->updateOrCreate(
            [
                'shop_id' => $shop->id,
                'shopify_contract_id' => (int) ($payload->id ?? 0),
            ],
            [
                'customer_id' => $customer->id,
                'shopify_gid' => $payload->admin_graphql_api_id ?? null,
                'shopify_origin_order_id' => isset($payload->origin_order_id)
                    ? (int) $payload->origin_order_id
                    : null,
                'shopify_origin_order_gid' => $payload->admin_graphql_api_origin_order_id ?? null,
                'shopify_revision_id' => isset($payload->revision_id)
                    ? (int) $payload->revision_id
                    : null,
                'status' => strtolower((string) ($payload->status ?? 'active')),
                'currency_code' => (string) ($payload->currency_code ?? 'USD'),
                'billing_interval' => $billingPolicy->interval ?? null,
                'billing_interval_count' => isset($billingPolicy->interval_count)
                    ? (int) $billingPolicy->interval_count
                    : null,
                'billing_min_cycles' => isset($billingPolicy->min_cycles)
                    ? (int) $billingPolicy->min_cycles
                    : null,
                'billing_max_cycles' => isset($billingPolicy->max_cycles)
                    ? (int) $billingPolicy->max_cycles
                    : null,
                'delivery_interval' => $deliveryPolicy->interval ?? null,
                'delivery_interval_count' => isset($deliveryPolicy->interval_count)
                    ? (int) $deliveryPolicy->interval_count
                    : null,
            ]
        );
    }

    private function syncCustomer(User $shop, array $contract, stdClass $payload): Customer
    {
        $customerData = $contract['customer'] ?? [];
        $shopifyCustomerId = $this->gidToId(
            $customerData['id'] ?? ($payload->admin_graphql_api_customer_id ?? null)
        ) ?? (int) ($payload->customer_id ?? 0);

        return Customer::query()->updateOrCreate(
            [
                'shop_id' => $shop->id,
                'shopify_customer_id' => $shopifyCustomerId,
            ],
            [
                'shopify_gid' => $customerData['id'] ?? ($payload->admin_graphql_api_customer_id ?? null),
                'email' => $customerData['email'] ?? null,
                'first_name' => $customerData['firstName'] ?? null,
                'last_name' => $customerData['lastName'] ?? null,
                'phone' => $customerData['phone'] ?? null,
            ]
        );
    }

    private function syncSubscription(
        User $shop,
        Customer $customer,
        array $contract,
        stdClass $payload
    ): Subscription {
        $billingPolicy = $contract['billingPolicy'] ?? [];
        $deliveryPolicy = $contract['deliveryPolicy'] ?? [];
        $deliveryPrice = $contract['deliveryPrice'] ?? [];
        $originOrder = $contract['originOrder'] ?? [];

        return Subscription::query()->updateOrCreate(
            [
                'shop_id' => $shop->id,
                'shopify_contract_id' => (int) ($payload->id ?? $this->gidToId($contract['id'] ?? null)),
            ],
            [
                'customer_id' => $customer->id,
                'shopify_gid' => $contract['id'] ?? ($payload->admin_graphql_api_id ?? null),
                'shopify_origin_order_id' => isset($originOrder['legacyResourceId'])
                    ? (int) $originOrder['legacyResourceId']
                    : (isset($payload->origin_order_id) ? (int) $payload->origin_order_id : null),
                'shopify_origin_order_gid' => $originOrder['id'] ?? ($payload->admin_graphql_api_origin_order_id ?? null),
                'shopify_revision_id' => isset($contract['revisionId'])
                    ? (int) $contract['revisionId']
                    : (isset($payload->revision_id) ? (int) $payload->revision_id : null),
                'status' => strtolower((string) ($contract['status'] ?? $payload->status ?? 'active')),
                'currency_code' => (string) ($contract['currencyCode'] ?? $payload->currency_code ?? 'USD'),
                'billing_interval' => $billingPolicy['interval'] ?? ($payload->billing_policy->interval ?? null),
                'billing_interval_count' => $billingPolicy['intervalCount']
                    ?? ($payload->billing_policy->interval_count ?? null),
                'billing_min_cycles' => $billingPolicy['minCycles']
                    ?? ($payload->billing_policy->min_cycles ?? null),
                'billing_max_cycles' => $billingPolicy['maxCycles']
                    ?? ($payload->billing_policy->max_cycles ?? null),
                'delivery_interval' => $deliveryPolicy['interval'] ?? ($payload->delivery_policy->interval ?? null),
                'delivery_interval_count' => $deliveryPolicy['intervalCount']
                    ?? ($payload->delivery_policy->interval_count ?? null),
                'next_billing_date' => $this->parseDate($contract['nextBillingDate'] ?? null),
                'delivery_price' => $deliveryPrice['amount'] ?? null,
                'delivery_price_currency' => $deliveryPrice['currencyCode'] ?? null,
                'note' => $contract['note'] ?? null,
                'last_payment_status' => $contract['lastPaymentStatus'] ?? null,
                'last_billing_attempt_error_type' => $contract['lastBillingAttemptErrorType'] ?? null,
                'shopify_created_at' => $this->parseDate($contract['createdAt'] ?? null),
                'shopify_updated_at' => $this->parseDate($contract['updatedAt'] ?? null),
            ]
        );
    }

    private function syncProducts(Subscription $subscription, array $contract): void
    {
        $lineIds = [];

        foreach ($contract['lines']['edges'] ?? [] as $edge) {
            $line = $edge['node'] ?? null;

            if ($line === null || empty($line['id'])) {
                continue;
            }

            $lineIds[] = $line['id'];
            $currentPrice = $line['currentPrice'] ?? [];

            SubscriptionProduct::query()->updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'shopify_line_id' => $line['id'],
                ],
                [
                    'shopify_product_id' => $this->gidToId($line['productId'] ?? null),
                    'shopify_variant_id' => $this->gidToId($line['variantId'] ?? null),
                    'shopify_selling_plan_id' => $this->gidToId($line['sellingPlanId'] ?? null),
                    'selling_plan_name' => $line['sellingPlanName'] ?? null,
                    'title' => (string) ($line['title'] ?? 'Subscription item'),
                    'variant_title' => $line['variantTitle'] ?? null,
                    'sku' => $line['sku'] ?? null,
                    'quantity' => (int) ($line['quantity'] ?? 1),
                    'current_price' => $currentPrice['amount'] ?? 0,
                    'currency_code' => $currentPrice['currencyCode'] ?? $subscription->currency_code,
                    'image_url' => $line['variantImage']['url'] ?? null,
                    'requires_shipping' => (bool) ($line['requiresShipping'] ?? true),
                ]
            );
        }

        if ($lineIds !== []) {
            SubscriptionProduct::query()
                ->where('subscription_id', $subscription->id)
                ->whereNotIn('shopify_line_id', $lineIds)
                ->delete();
        }
    }

    private function syncShipping(Subscription $subscription, array $contract): void
    {
        $deliveryMethod = $contract['deliveryMethod'] ?? null;

        if (! is_array($deliveryMethod) || $deliveryMethod === []) {
            return;
        }

        $type = $deliveryMethod['__typename'] ?? null;
        $address = $deliveryMethod['address'] ?? null;
        $optionTitle = $deliveryMethod['shippingOption']['title']
            ?? $deliveryMethod['localDeliveryOption']['title']
            ?? $deliveryMethod['pickupOption']['title']
            ?? null;

        SubscriptionShipping::query()->updateOrCreate(
            ['subscription_id' => $subscription->id],
            [
                'delivery_method_type' => $type,
                'shipping_option_title' => $optionTitle,
                'first_name' => $address['firstName'] ?? null,
                'last_name' => $address['lastName'] ?? null,
                'company' => $address['company'] ?? null,
                'address1' => $address['address1'] ?? null,
                'address2' => $address['address2'] ?? null,
                'city' => $address['city'] ?? null,
                'province' => $address['province'] ?? null,
                'province_code' => $address['provinceCode'] ?? null,
                'country' => $address['country'] ?? null,
                'country_code' => $address['countryCode'] ?? null,
                'zip' => $address['zip'] ?? null,
                'phone' => $address['phone'] ?? null,
            ]
        );
    }

    private function syncRecurringOrders(Subscription $subscription, array $contract): void
    {
        $orderIds = [];

        foreach ($contract['orders']['edges'] ?? [] as $edge) {
            $order = $edge['node'] ?? null;

            if ($order === null || empty($order['legacyResourceId'])) {
                continue;
            }

            $shopifyOrderId = (int) $order['legacyResourceId'];
            $orderIds[] = $shopifyOrderId;
            $totalPrice = $order['totalPriceSet']['shopMoney'] ?? [];

            SubscriptionRecurringOrder::query()->updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'shopify_order_id' => $shopifyOrderId,
                ],
                [
                    'shopify_gid' => $order['id'] ?? null,
                    'order_name' => $order['name'] ?? null,
                    'financial_status' => $order['displayFinancialStatus'] ?? null,
                    'fulfillment_status' => $order['displayFulfillmentStatus'] ?? null,
                    'total_price' => $totalPrice['amount'] ?? null,
                    'currency_code' => $totalPrice['currencyCode'] ?? $subscription->currency_code,
                    'processed_at' => $this->parseDate($order['processedAt'] ?? null),
                    'shopify_created_at' => $this->parseDate($order['createdAt'] ?? null),
                ]
            );
        }

        if ($orderIds !== []) {
            SubscriptionRecurringOrder::query()
                ->where('subscription_id', $subscription->id)
                ->whereNotIn('shopify_order_id', $orderIds)
                ->delete();
        }
    }

    private function logWebhookLifecycle(
        Subscription $subscription,
        ?string $previousStatus,
        bool $wasNew
    ): void {
        $newStatus = strtolower((string) $subscription->status);
        $previous = $previousStatus !== null ? strtolower($previousStatus) : null;

        if ($wasNew) {
            if ($this->recentlyLogged($subscription, SubscriptionActivityLogService::ACTION_CREATED)) {
                return;
            }

            $this->activityLogService->log(
                $subscription,
                SubscriptionActivityLogService::ACTION_CREATED,
                'The subscription was created.',
                'system',
                'System'
            );

            return;
        }

        if ($previous === null || $previous === $newStatus) {
            return;
        }

        [$action, $message] = match ($newStatus) {
            'paused' => [
                SubscriptionActivityLogService::ACTION_PAUSED,
                'The subscription was paused.',
            ],
            'active' => [
                SubscriptionActivityLogService::ACTION_RESUMED,
                'The subscription was resumed.',
            ],
            'cancelled' => [
                SubscriptionActivityLogService::ACTION_CANCELLED,
                'The subscription was cancelled.',
            ],
            default => [null, null],
        };

        if ($action === null) {
            return;
        }

        if ($this->recentlyLogged($subscription, $action)) {
            return;
        }

        $this->activityLogService->log(
            $subscription,
            $action,
            $message,
            'system',
            'System'
        );
    }

    private function recentlyLogged(Subscription $subscription, string $action): bool
    {
        return \App\Models\SubscriptionActivityLog::query()
            ->where('subscription_id', $subscription->id)
            ->where('action', $action)
            ->where('created_at', '>=', now()->subMinutes(2))
            ->exists();
    }

    private function gidToId(mixed $gid): ?int
    {
        if ($gid === null || $gid === '') {
            return null;
        }

        if (is_numeric($gid)) {
            return (int) $gid;
        }

        $parts = explode('/', (string) $gid);

        return is_numeric(end($parts)) ? (int) end($parts) : null;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value);
    }
}
