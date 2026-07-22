<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPlanOption;
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
     * Recurring invoice (cart properties) creates a local subscription first.
     * Auto-charge uses line-item contracts (own app only), then origin-order fallback.
     *
     * @return array{recorded: bool, retry: bool, subscription_id: ?int, plan_type: ?string}
     */
    public function syncRecurringOrderFromCreate(User $shop, array $orderPayload): array
    {
        $orderId = isset($orderPayload['id']) ? (int) $orderPayload['id'] : 0;
        $orderGid = $orderPayload['admin_graphql_api_id']
            ?? ($orderId > 0 ? 'gid://shopify/Order/'.$orderId : null);

        if ($orderId <= 0 || ! is_string($orderGid) || $orderGid === '') {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
        }

        $invoiceProps = $this->extractSubscribifyProperties($orderPayload);

        // Draft invoice paid → mark schedule paid + order history (not a new subscription).
        if (! empty($invoiceProps['_invoice_id']) || ! empty($invoiceProps['_subscription_id'])) {
            $paid = $this->markRecurringInvoicePaidFromOrder($shop, $orderPayload, $invoiceProps);

            if ($paid['recorded']) {
                return $paid;
            }
        }

        if (($invoiceProps['_subscribify_plan_type'] ?? null) === Subscription::PLAN_TYPE_RECURRING_INVOICE) {
            $subscription = $this->createFromRecurringInvoiceOrder($shop, $orderPayload, $invoiceProps);

            if ($subscription === null) {
                return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
            }

            $attributes = $this->buildRecurringOrderAttributes($orderPayload, null);

            SubscriptionRecurringOrder::query()->updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'shopify_order_id' => $orderId,
                ],
                $attributes + [
                    'currency_code' => $attributes['currency_code'] ?? $subscription->currency_code,
                ]
            );

            return [
                'recorded' => true,
                'retry' => false,
                'subscription_id' => $subscription->id,
                'plan_type' => Subscription::PLAN_TYPE_RECURRING_INVOICE,
            ];
        }

        if (! $this->orderLooksSubscriptionRelated($shop, $orderPayload, $orderId)) {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
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
                return ['recorded' => false, 'retry' => true, 'subscription_id' => null, 'plan_type' => null];
            }

            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
        }

        $attributes = $this->buildRecurringOrderAttributes($orderPayload, $context);
        $recordedFor = null;

        foreach ($subscriptions as $subscription) {
            if ($subscription->plan_type === null || $subscription->plan_type === '') {
                $subscription->forceFill([
                    'plan_type' => Subscription::PLAN_TYPE_AUTO_CHARGE,
                ])->save();
            }

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
            'plan_type' => Subscription::PLAN_TYPE_AUTO_CHARGE,
        ];
    }

    /**
     * When a draft-order invoice is completed, mark the local invoice paid and store order history.
     *
     * @param  array<string, string>  $properties
     * @return array{recorded: bool, retry: bool, subscription_id: ?int, plan_type: ?string}
     */
    private function markRecurringInvoicePaidFromOrder(
        User $shop,
        array $orderPayload,
        array $properties
    ): array {
        $orderId = (int) ($orderPayload['id'] ?? 0);
        $invoiceId = isset($properties['_invoice_id']) ? (int) $properties['_invoice_id'] : 0;
        $subscriptionId = isset($properties['_subscription_id'])
            ? (int) $properties['_subscription_id']
            : 0;
        $cycleIndex = isset($properties['_cycle_index']) ? (int) $properties['_cycle_index'] : null;

        $invoiceQuery = SubscriptionInvoice::query()
            ->where('shop_id', $shop->id);

        if ($invoiceId > 0) {
            $invoiceQuery->where('id', $invoiceId);
        } elseif ($subscriptionId > 0 && $cycleIndex !== null) {
            $invoiceQuery
                ->where('subscription_id', $subscriptionId)
                ->where('cycle_index', $cycleIndex);
        } else {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
        }

        $invoice = $invoiceQuery->first();

        if (! $invoice) {
            Log::warning('Paid recurring invoice order could not match local invoice', [
                'shop_id' => $shop->id,
                'order_id' => $orderId,
                'invoice_id' => $invoiceId,
                'subscription_id' => $subscriptionId,
                'cycle_index' => $cycleIndex,
            ]);

            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
        }

        $subscription = Subscription::query()
            ->where('shop_id', $shop->id)
            ->where('id', $invoice->subscription_id)
            ->where('plan_type', Subscription::PLAN_TYPE_RECURRING_INVOICE)
            ->first();

        if (! $subscription) {
            return ['recorded' => false, 'retry' => false, 'subscription_id' => null, 'plan_type' => null];
        }

        $paidAt = $this->parseDate($orderPayload['processed_at'] ?? $orderPayload['created_at'] ?? null)
            ?? now();

        if ($invoice->payment_status !== SubscriptionInvoice::STATUS_PAID) {
            $invoice->payment_status = SubscriptionInvoice::STATUS_PAID;
            $invoice->paid_at = $paidAt;
            $invoice->save();
        }

        $attributes = $this->buildRecurringOrderAttributes($orderPayload, null);

        SubscriptionRecurringOrder::query()->updateOrCreate(
            [
                'subscription_id' => $subscription->id,
                'shopify_order_id' => $orderId,
            ],
            $attributes + [
                'currency_code' => $attributes['currency_code'] ?? $subscription->currency_code,
            ]
        );

        $nextUpcoming = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('payment_status', SubscriptionInvoice::STATUS_UPCOMING)
            ->orderBy('scheduled_at')
            ->orderBy('cycle_index')
            ->first();

        if ($nextUpcoming) {
            $subscription->update([
                'next_billing_date' => $nextUpcoming->scheduled_at,
            ]);
        }

        $this->extendInvoiceSchedulesIfCompleted($subscription);

        $this->activityLogService->logSystem(
            $subscription,
            SubscriptionActivityLogService::ACTION_CHARGED,
            'Invoice #'.$invoice->cycle_index.' was paid via order '
                .($orderPayload['name'] ?? '#'.$orderId).'.',
            [
                'invoice_id' => $invoice->id,
                'cycle_index' => $invoice->cycle_index,
                'order_id' => $orderId,
            ]
        );

        Log::info('Recurring invoice marked paid from ORDERS_CREATE', [
            'shop_id' => $shop->id,
            'subscription_id' => $subscription->id,
            'invoice_id' => $invoice->id,
            'order_id' => $orderId,
        ]);

        return [
            'recorded' => true,
            'retry' => false,
            'subscription_id' => $subscription->id,
            'plan_type' => Subscription::PLAN_TYPE_RECURRING_INVOICE,
        ];
    }

    /**
     * Create / upsert a local-only subscription from recurring_invoice cart properties.
     *
     * @param  array<string, string>  $properties
     */
    public function createFromRecurringInvoiceOrder(
        User $shop,
        array $orderPayload,
        array $properties
    ): ?Subscription {
        $orderId = isset($orderPayload['id']) ? (int) $orderPayload['id'] : 0;
        $planId = isset($properties['_subscribify_plan_id'])
            ? (int) $properties['_subscribify_plan_id']
            : 0;
        $optionId = isset($properties['_subscribify_plan_option_id'])
            ? (int) $properties['_subscribify_plan_option_id']
            : 0;

        if ($orderId <= 0 || $planId <= 0 || $optionId <= 0) {
            Log::warning('Recurring invoice order missing plan properties', [
                'shop_id' => $shop->id,
                'order_id' => $orderId,
                'properties' => $properties,
            ]);

            return null;
        }

        $plan = SubscriptionPlan::query()
            ->where('shop_id', $shop->id)
            ->where('id', $planId)
            ->where('plan_type', Subscription::PLAN_TYPE_RECURRING_INVOICE)
            ->first();

        $option = SubscriptionPlanOption::query()
            ->where('plan_id', $planId)
            ->where('id', $optionId)
            ->first();

        if ($plan === null || $option === null) {
            Log::warning('Recurring invoice plan/option not found for order', [
                'shop_id' => $shop->id,
                'order_id' => $orderId,
                'plan_id' => $planId,
                'option_id' => $optionId,
            ]);

            return null;
        }

        $customerPayload = $orderPayload['customer'] ?? null;

        if (! is_array($customerPayload) || empty($customerPayload['id'])) {
            Log::warning('Recurring invoice order missing customer', [
                'shop_id' => $shop->id,
                'order_id' => $orderId,
            ]);

            return null;
        }

        return DB::transaction(function () use (
            $shop,
            $orderPayload,
            $plan,
            $option,
            $customerPayload,
            $orderId
        ) {
            $wasNew = ! Subscription::query()
                ->where('shop_id', $shop->id)
                ->where('shopify_origin_order_id', $orderId)
                ->where('plan_type', Subscription::PLAN_TYPE_RECURRING_INVOICE)
                ->exists();

            $customer = Customer::query()->updateOrCreate(
                [
                    'shop_id' => $shop->id,
                    'shopify_customer_id' => (int) $customerPayload['id'],
                ],
                [
                    'shopify_gid' => $customerPayload['admin_graphql_api_id']
                        ?? ('gid://shopify/Customer/'.$customerPayload['id']),
                    'email' => $customerPayload['email'] ?? null,
                    'first_name' => $customerPayload['first_name'] ?? null,
                    'last_name' => $customerPayload['last_name'] ?? null,
                    'phone' => $customerPayload['phone'] ?? null,
                ]
            );

            $frequency = max(1, (int) ($option->delivery_frequency ?? 1));
            $interval = $this->normalizePlanInterval((string) ($option->delivery_interval ?? 'months'));
            $createdAt = $this->parseDate($orderPayload['created_at'] ?? $orderPayload['processed_at'] ?? null)
                ?? now();
            $nextBilling = $this->addInterval($createdAt->copy(), $interval, $frequency);
            $currency = (string) ($orderPayload['currency'] ?? 'USD');
            $orderGid = $orderPayload['admin_graphql_api_id']
                ?? ('gid://shopify/Order/'.$orderId);

            $subscription = Subscription::query()->updateOrCreate(
                [
                    'shop_id' => $shop->id,
                    'shopify_origin_order_id' => $orderId,
                    'plan_type' => Subscription::PLAN_TYPE_RECURRING_INVOICE,
                ],
                [
                    'customer_id' => $customer->id,
                    'subscription_plan_id' => $plan->id,
                    'subscription_plan_option_id' => $option->id,
                    'shopify_contract_id' => null,
                    'shopify_gid' => null,
                    'shopify_origin_order_gid' => $orderGid,
                    'shopify_revision_id' => null,
                    'status' => 'active',
                    'currency_code' => $currency,
                    'billing_interval' => $interval,
                    'billing_interval_count' => $frequency,
                    'billing_min_cycles' => $option->min_orders !== null ? (int) $option->min_orders : null,
                    'billing_max_cycles' => $option->max_orders !== null ? (int) $option->max_orders : null,
                    'delivery_interval' => $interval,
                    'delivery_interval_count' => $frequency,
                    'next_billing_date' => $nextBilling,
                    'delivery_price' => $orderPayload['total_shipping_price_set']['shop_money']['amount']
                        ?? $orderPayload['total_shipping_price']
                        ?? null,
                    'delivery_price_currency' => $currency,
                    'note' => $orderPayload['note'] ?? null,
                    'last_payment_status' => isset($orderPayload['financial_status'])
                        ? strtoupper((string) $orderPayload['financial_status'])
                        : null,
                    'shopify_created_at' => $createdAt,
                    'shopify_updated_at' => $this->parseDate($orderPayload['updated_at'] ?? null) ?? $createdAt,
                ]
            );

            $this->syncInvoiceProducts($shop, $subscription, $orderPayload);
            $this->syncInvoiceShipping($subscription, $orderPayload);
            $this->createInvoiceSchedules(
                $shop,
                $subscription,
                $orderPayload,
                (string) $frequency,
                $interval
            );

            if ($wasNew) {
                $this->activityLogService->log(
                    $subscription,
                    SubscriptionActivityLogService::ACTION_CREATED,
                    'The recurring invoice subscription was created from order '
                        .($orderPayload['name'] ?? '#'.$orderId).'.',
                    'system',
                    'System',
                    [
                        'order_id' => $orderId,
                        'plan_id' => $plan->id,
                        'plan_option_id' => $option->id,
                    ]
                );
            }

            return $subscription->fresh(['customer', 'products', 'shipping', 'recurringOrders', 'invoices']);
        });
    }

    /**
     * Seed the next 5 upcoming invoice cycles for a recurring-invoice subscription.
     */
    private function createInvoiceSchedules(
        User $shop,
        Subscription $subscription,
        array $orderPayload,
        string $intervalValue,
        string $intervalUnit
    ): void {
        if (
            SubscriptionInvoice::query()
                ->where('subscription_id', $subscription->id)
                ->exists()
        ) {
            return;
        }

        $orderCreatedAt = $this->parseDate($orderPayload['created_at'] ?? $orderPayload['processed_at'] ?? null)
            ?? now();

        $lineItemProperties = $this->extractInvoiceLineItemProperties($orderPayload);
        $normalizedUnit = $this->normalizePlanInterval($intervalUnit);
        $value = max(1, (int) $intervalValue);

        for ($cycle = 1; $cycle <= 5; $cycle++) {
            $scheduledAt = $this->addInterval($orderCreatedAt->copy(), $normalizedUnit, $value * $cycle);

            SubscriptionInvoice::query()->firstOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'cycle_index' => $cycle,
                ],
                [
                    'shop_id' => $shop->id,
                    'scheduled_at' => $scheduledAt,
                    'interval_value' => $value,
                    'interval_unit' => $normalizedUnit,
                    'payment_status' => SubscriptionInvoice::STATUS_UPCOMING,
                    'line_item_properties' => $lineItemProperties,
                ]
            );
        }

        Log::info('Invoice schedules created', [
            'subscription_id' => $subscription->id,
            'cycles' => 5,
            'interval' => "{$value} {$normalizedUnit}",
            'first_due' => $this->addInterval($orderCreatedAt->copy(), $normalizedUnit, $value)->toDateString(),
        ]);
    }

    /**
     * When all open invoices are paid, append the next 5 upcoming cycles.
     */
    private function extendInvoiceSchedulesIfCompleted(Subscription $subscription): void
    {
        $hasOpenInvoice = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->whereIn('payment_status', [
                SubscriptionInvoice::STATUS_UPCOMING,
                SubscriptionInvoice::STATUS_PENDING,
                SubscriptionInvoice::STATUS_FAILED,
            ])
            ->exists();

        if ($hasOpenInvoice) {
            return;
        }

        $lastInvoice = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->orderByDesc('cycle_index')
            ->first();

        if (! $lastInvoice) {
            return;
        }

        $intervalValue = max(1, (int) (
            $lastInvoice->interval_value
            ?: $subscription->billing_interval_count
            ?: $subscription->delivery_interval_count
            ?: 1
        ));
        $intervalUnit = $this->normalizePlanInterval((string) (
            $lastInvoice->interval_unit
            ?: $subscription->billing_interval
            ?: $subscription->delivery_interval
            ?: 'months'
        ));
        $baseScheduledAt = $lastInvoice->scheduled_at
            ? $lastInvoice->scheduled_at->copy()
            : now();
        $lineItemProperties = $lastInvoice->line_item_properties ?? [];

        for ($offset = 1; $offset <= 5; $offset++) {
            $cycleIndex = (int) $lastInvoice->cycle_index + $offset;
            $scheduledAt = $this->addInterval(
                $baseScheduledAt->copy(),
                $intervalUnit,
                $intervalValue * $offset
            );

            SubscriptionInvoice::query()->firstOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'cycle_index' => $cycleIndex,
                ],
                [
                    'shop_id' => $subscription->shop_id,
                    'scheduled_at' => $scheduledAt,
                    'interval_value' => $intervalValue,
                    'interval_unit' => $intervalUnit,
                    'payment_status' => SubscriptionInvoice::STATUS_UPCOMING,
                    'line_item_properties' => $lineItemProperties,
                ]
            );
        }

        $nextUpcoming = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('payment_status', SubscriptionInvoice::STATUS_UPCOMING)
            ->orderBy('scheduled_at')
            ->orderBy('cycle_index')
            ->first();

        if ($nextUpcoming) {
            $subscription->update([
                'next_billing_date' => $nextUpcoming->scheduled_at,
            ]);
        }
    }

    /**
     * Preserve original line item properties for later draft-order injection.
     *
     * @return list<array{key: string, value: string}>
     */
    private function extractInvoiceLineItemProperties(array $orderPayload): array
    {
        foreach ($orderPayload['line_items'] ?? [] as $lineItem) {
            $props = [];
            $isInvoiceLine = false;

            foreach ($lineItem['properties'] ?? [] as $property) {
                $name = (string) ($property['name'] ?? '');
                $value = (string) ($property['value'] ?? '');

                if ($name === '') {
                    continue;
                }

                if (
                    $name === '_subscribify_plan_type'
                    && $value === Subscription::PLAN_TYPE_RECURRING_INVOICE
                ) {
                    $isInvoiceLine = true;
                }

                $props[] = [
                    'key' => $name,
                    'value' => $value,
                ];
            }

            if ($isInvoiceLine && $props !== []) {
                return $props;
            }
        }

        // Fallback: flatten first line with any subscribify props.
        $fallback = [];
        foreach ($orderPayload['line_items'] ?? [] as $lineItem) {
            foreach ($lineItem['properties'] ?? [] as $property) {
                $name = (string) ($property['name'] ?? '');
                if ($name === '') {
                    continue;
                }
                $fallback[] = [
                    'key' => $name,
                    'value' => (string) ($property['value'] ?? ''),
                ];
            }
            if ($fallback !== []) {
                return $fallback;
            }
        }

        return [];
    }

    /**
     * @return array<string, string>
     */
    private function extractSubscribifyProperties(array $orderPayload): array
    {
        $props = [];
        $trackedKeys = [
            '_subscribify_plan_type',
            '_subscribify_plan_id',
            '_subscribify_plan_option_id',
            '_subscribify_discount_amount',
            '_subscribify_discount_type',
            '_subscription_type',
            '_subscription_id',
            '_invoice_id',
            '_cycle_index',
            'Interval',
            'Discount',
            'Discount description',
        ];

        foreach ($orderPayload['line_items'] ?? [] as $lineItem) {
            foreach ($lineItem['properties'] ?? [] as $property) {
                $name = (string) ($property['name'] ?? '');
                $value = $property['value'] ?? null;

                if ($name === '' || $value === null || $value === '') {
                    continue;
                }

                if (
                    str_starts_with($name, '_subscribify_')
                    || str_starts_with($name, '_subscription_')
                    || str_starts_with($name, '_invoice_')
                    || str_starts_with($name, '_cycle_')
                    || in_array($name, $trackedKeys, true)
                ) {
                    $props[$name] = (string) $value;
                }
            }
        }

        foreach ($orderPayload['note_attributes'] ?? [] as $attribute) {
            $name = (string) ($attribute['name'] ?? '');
            $value = $attribute['value'] ?? null;

            if ($name === '' || $value === null || $value === '') {
                continue;
            }

            if (
                (
                    str_starts_with($name, '_subscribify_')
                    || str_starts_with($name, '_subscription_')
                    || str_starts_with($name, '_invoice_')
                    || str_starts_with($name, '_cycle_')
                    || in_array($name, $trackedKeys, true)
                )
                && ! isset($props[$name])
            ) {
                $props[$name] = (string) $value;
            }
        }

        return $props;
    }

    private function syncInvoiceProducts(User $shop, Subscription $subscription, array $orderPayload): void
    {
        $invoiceLines = [];

        foreach ($orderPayload['line_items'] ?? [] as $lineItem) {
            $isInvoiceLine = false;

            foreach ($lineItem['properties'] ?? [] as $property) {
                if (
                    ($property['name'] ?? null) === '_subscribify_plan_type'
                    && ($property['value'] ?? null) === Subscription::PLAN_TYPE_RECURRING_INVOICE
                ) {
                    $isInvoiceLine = true;
                    break;
                }
            }

            if ($isInvoiceLine) {
                $invoiceLines[] = $lineItem;
            }
        }

        if ($invoiceLines === []) {
            $invoiceLines = $orderPayload['line_items'] ?? [];
        }

        $variantIds = [];
        foreach ($invoiceLines as $lineItem) {
            if (! empty($lineItem['variant_id'])) {
                $variantIds[] = (int) $lineItem['variant_id'];
            }
        }

        $imageByVariantId = $this->shopifySubscriptionContractService
            ->fetchVariantImageUrls($shop, $variantIds);

        $lineIds = [];

        foreach ($invoiceLines as $lineItem) {
            $lineId = isset($lineItem['admin_graphql_api_id'])
                ? (string) $lineItem['admin_graphql_api_id']
                : (isset($lineItem['id']) ? 'gid://shopify/LineItem/'.$lineItem['id'] : null);

            if ($lineId === null) {
                continue;
            }

            $lineIds[] = $lineId;
            $props = [];

            foreach ($lineItem['properties'] ?? [] as $property) {
                if (! empty($property['name'])) {
                    $props[(string) $property['name']] = (string) ($property['value'] ?? '');
                }
            }

            $variantId = isset($lineItem['variant_id']) ? (int) $lineItem['variant_id'] : null;
            $imageUrl = null;

            if (is_array($lineItem['image'] ?? null)) {
                $imageUrl = $lineItem['image']['src'] ?? $lineItem['image']['url'] ?? null;
            }

            if (! is_string($imageUrl) || $imageUrl === '') {
                $imageUrl = $variantId !== null
                    ? ($imageByVariantId[$variantId] ?? null)
                    : null;
            }

            SubscriptionProduct::query()->updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'shopify_line_id' => $lineId,
                ],
                [
                    'shopify_product_id' => isset($lineItem['product_id']) ? (int) $lineItem['product_id'] : null,
                    'shopify_variant_id' => $variantId,
                    'shopify_selling_plan_id' => null,
                    'selling_plan_name' => $props['Interval'] ?? null,
                    'title' => (string) ($lineItem['title'] ?? 'Subscription item'),
                    'variant_title' => $lineItem['variant_title'] ?? null,
                    'sku' => $lineItem['sku'] ?? null,
                    'quantity' => (int) ($lineItem['quantity'] ?? 1),
                    'current_price' => $lineItem['price'] ?? 0,
                    'currency_code' => $subscription->currency_code,
                    'image_url' => $imageUrl,
                    'requires_shipping' => (bool) ($lineItem['requires_shipping'] ?? true),
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

    private function syncInvoiceShipping(Subscription $subscription, array $orderPayload): void
    {
        $address = $orderPayload['shipping_address'] ?? null;

        if (! is_array($address) || $address === []) {
            return;
        }

        SubscriptionShipping::query()->updateOrCreate(
            ['subscription_id' => $subscription->id],
            [
                'delivery_method_type' => 'SubscriptionDeliveryMethodShipping',
                'shipping_option_title' => $orderPayload['shipping_lines'][0]['title'] ?? null,
                'first_name' => $address['first_name'] ?? null,
                'last_name' => $address['last_name'] ?? null,
                'company' => $address['company'] ?? null,
                'address1' => $address['address1'] ?? null,
                'address2' => $address['address2'] ?? null,
                'city' => $address['city'] ?? null,
                'province' => $address['province'] ?? null,
                'province_code' => $address['province_code'] ?? null,
                'country' => $address['country'] ?? null,
                'country_code' => $address['country_code'] ?? null,
                'zip' => $address['zip'] ?? null,
                'phone' => $address['phone'] ?? null,
            ]
        );
    }

    private function normalizePlanInterval(string $interval): string
    {
        $normalized = strtolower(trim($interval));

        return match ($normalized) {
            'day', 'days', 'DAY', 'DAYS' => 'days',
            'week', 'weeks', 'WEEK', 'WEEKS' => 'weeks',
            'year', 'years', 'YEAR', 'YEARS' => 'years',
            default => 'months',
        };
    }

    private function addInterval(Carbon $date, string $interval, int $count): Carbon
    {
        return match ($this->normalizePlanInterval($interval)) {
            'days' => $date->addDays($count),
            'weeks' => $date->addWeeks($count),
            'years' => $date->addYears($count),
            default => $date->addMonths($count),
        };
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
                'plan_type' => Subscription::PLAN_TYPE_AUTO_CHARGE,
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
                'plan_type' => Subscription::PLAN_TYPE_AUTO_CHARGE,
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
