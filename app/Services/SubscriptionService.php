<?php

namespace App\Services;

use App\Exceptions\ShopifySellingPlanException;
use App\Models\Customer;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlanOption;
use App\Models\User;
use App\Services\Shopify\ShopifyGraphqlService;
use App\Services\Shopify\ShopifySubscriptionContractService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class SubscriptionService
{
    public function __construct(
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected ShopifySubscriptionContractService $shopifySubscriptionContractService,
        protected SubscriptionContractSyncService $subscriptionContractSyncService,
        protected SubscriptionActivityLogService $activityLogService
    ) {}

    public function index(array $filters = []): array
    {
        $query = Subscription::query()
            ->where('shop_id', $this->shopId())
            ->with(['customer', 'products']);

        $this->applyFilters($query, $filters);

        return $query
            ->orderByDesc('shopify_created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Subscription $subscription) => $this->transformListItem($subscription))
            ->values()
            ->all();
    }

    public function stats(): array
    {
        $base = Subscription::query()->where('shop_id', $this->shopId());

        return [
            'all' => (clone $base)->count(),
            'active' => (clone $base)->where('status', 'active')->count(),
            'paused' => (clone $base)->where('status', 'paused')->count(),
            'cancelled' => (clone $base)->where('status', 'cancelled')->count(),
            'failed' => (clone $base)->where(function (Builder $query) {
                $query->where('status', 'failed')
                    ->orWhere('last_payment_status', 'FAILED');
            })->count(),
            'upcoming' => (clone $base)
                ->where('status', 'active')
                ->whereNotNull('next_billing_date')
                ->where('next_billing_date', '>', now())
                ->count(),
            'pending_payment' => (clone $base)
                ->where('last_payment_status', 'PENDING')
                ->count(),
        ];
    }

    public function show(int $id): array
    {
        $subscription = $this->findForShop($id, [
            'customer',
            'products',
            'shipping',
            'recurringOrders',
            'invoices' => fn ($query) => $query->orderBy('scheduled_at')->orderBy('cycle_index'),
            'activityLogs' => fn ($query) => $query->orderByDesc('created_at')->orderByDesc('id')->limit(50),
        ]);

        $payload = $this->transformDetail($subscription);

        if ($subscription->shopify_gid) {
            $shop = $subscription->shop ?? $this->shopifyGraphqlService->shop();

            try {
                $payload['payment_method'] = $this->shopifySubscriptionContractService->fetchPaymentMethod(
                    $shop,
                    $subscription->shopify_gid
                );
            } catch (ShopifySellingPlanException $exception) {
                $payload['payment_method'] = null;
                $payload['shopify_error'] = $exception->getMessage();
            }

            try {
                $payload['discounts'] = $this->shopifySubscriptionContractService->fetchDiscounts(
                    $shop,
                    $subscription->shopify_gid
                );
            } catch (ShopifySellingPlanException $exception) {
                $payload['discounts'] = [];
                $payload['shopify_error'] = $exception->getMessage();
            }
        } else {
            $payload['discounts'] = [];
            $payload['payment_method'] = null;
        }

        return $payload;
    }

    public function invoices(int $id): array
    {
        $subscription = $this->findForShop($id);
        $this->assertRecurringInvoice($subscription);

        $this->createNextRecurringInvoiceSchedulesIfCompleted($subscription);

        $invoices = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->whereIn('payment_status', [
                SubscriptionInvoice::STATUS_UPCOMING,
                SubscriptionInvoice::STATUS_PENDING,
                SubscriptionInvoice::STATUS_FAILED,
            ])
            ->orderBy('scheduled_at')
            ->orderBy('cycle_index')
            ->get();

        $nextUpcomingId = $invoices
            ->first(fn (SubscriptionInvoice $invoice) => $invoice->payment_status === SubscriptionInvoice::STATUS_UPCOMING)
            ?->id;

        return [
            'invoices' => $invoices->map(
                fn (SubscriptionInvoice $invoice) => $this->transformInvoice($invoice, $nextUpcomingId)
            )->values()->all(),
        ];
    }

    public function requestInvoiceNow(int $id, ?int $invoiceId = null): array
    {
        $subscription = $this->findForShop($id, ['products', 'customer', 'shipping']);
        $this->assertRecurringInvoice($subscription);
        $this->createNextRecurringInvoiceSchedulesIfCompleted($subscription);

        $query = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('payment_status', SubscriptionInvoice::STATUS_UPCOMING)
            ->whereNull('shopify_draft_order_id')
            ->orderBy('scheduled_at')
            ->orderBy('cycle_index');

        if ($invoiceId) {
            $query->where('id', $invoiceId);
        }

        $invoice = $query->first();

        if (! $invoice) {
            throw new ShopifySellingPlanException('No upcoming invoice found to send.');
        }

        $shop = $subscription->shop ?? $this->shopifyGraphqlService->shop();
        $result = $this->shopifySubscriptionContractService
            ->createDraftFromRecurringInvoiceSubscription($shop, $subscription, $invoice);

        if (! ($result['success'] ?? false)) {
            $message = $result['errors'][0]['message']
                ?? 'Failed to create draft invoice.';

            throw new ShopifySellingPlanException($message, $result['errors'] ?? []);
        }

        $invoice->shopify_draft_order_id = $result['draftOrderId'] ?? null;
        $invoice->invoice_url = $result['invoiceUrl'] ?? null;
        $invoice->email_sent_at = ($result['invoiceSent'] ?? false) ? now() : null;
        $invoice->payment_status = SubscriptionInvoice::STATUS_PENDING;
        $invoice->save();

        $this->activityLogService->logSystem(
            $subscription,
            SubscriptionActivityLogService::ACTION_CHARGED,
            'Invoice requested for cycle #'.$invoice->cycle_index.'.',
            [
                'invoice_id' => $invoice->id,
                'cycle_index' => $invoice->cycle_index,
                'draft_order_id' => $invoice->shopify_draft_order_id,
            ]
        );

        $this->syncNextBillingDateFromInvoices($subscription);

        return [
            'invoice' => $this->transformInvoice($invoice->fresh()),
        ];
    }

    public function resendInvoiceEmail(int $id, int $invoiceId): array
    {
        $subscription = $this->findForShop($id, ['customer']);
        $this->assertRecurringInvoice($subscription);

        $invoice = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('id', $invoiceId)
            ->first();

        if (! $invoice) {
            throw new ShopifySellingPlanException('Invoice not found.');
        }

        if (empty($invoice->shopify_draft_order_id)) {
            throw new ShopifySellingPlanException('Draft order not created yet for this invoice.');
        }

        $customerEmail = $subscription->customer?->email;
        if (! $customerEmail) {
            throw new ShopifySellingPlanException('Customer email not found.');
        }

        $shop = $subscription->shop ?? $this->shopifyGraphqlService->shop();
        $result = $this->shopifySubscriptionContractService->resendDraftOrderInvoice(
            $shop,
            (string) $invoice->shopify_draft_order_id,
            (string) $customerEmail
        );

        if (! ($result['success'] ?? false)) {
            $message = $result['errors'][0]['message'] ?? 'Failed to resend invoice email.';
            throw new ShopifySellingPlanException($message, $result['errors'] ?? []);
        }

        $invoice->invoice_url = $result['invoiceUrl'] ?? $invoice->invoice_url;
        $invoice->email_sent_at = now();
        $invoice->save();

        return [
            'invoice' => $this->transformInvoice($invoice->fresh()),
        ];
    }

    public function rescheduleInvoice(int $id, int $invoiceId, string $targetDate): array
    {
        $subscription = $this->findForShop($id);
        $this->assertRecurringInvoice($subscription);

        $invoice = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('id', $invoiceId)
            ->first();

        if (! $invoice) {
            throw new ShopifySellingPlanException('Invoice not found.');
        }

        if ($invoice->payment_status === SubscriptionInvoice::STATUS_PAID) {
            throw new ShopifySellingPlanException('Paid invoices cannot be rescheduled.');
        }

        $targetCarbon = Carbon::parse($targetDate)->utc()->seconds(0);
        $minuteStart = $targetCarbon->copy();
        $minuteEnd = $targetCarbon->copy()->addSeconds(59);

        $exists = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('id', '!=', $invoice->id)
            ->whereBetween('scheduled_at', [$minuteStart, $minuteEnd])
            ->exists();

        if ($exists) {
            throw new ShopifySellingPlanException(
                "Could not save the modified date and time. Make sure that there isn't another billing attempt set up for the same date and time."
            );
        }

        $invoice->scheduled_at = $targetCarbon;
        $invoice->save();

        $this->syncNextBillingDateFromInvoices($subscription);

        return [
            'invoice' => $this->transformInvoice($invoice->fresh()),
        ];
    }

    private function assertRecurringInvoice(Subscription $subscription): void
    {
        if (($subscription->plan_type ?? null) !== Subscription::PLAN_TYPE_RECURRING_INVOICE) {
            throw new ShopifySellingPlanException('Subscription is not a recurring-invoice type.');
        }
    }

    private function createNextRecurringInvoiceSchedulesIfCompleted(Subscription $subscription): void
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
        $intervalUnit = $this->normalizeInvoiceInterval((string) (
            $lastInvoice->interval_unit
            ?: $subscription->billing_interval
            ?: $subscription->delivery_interval
            ?: 'months'
        ));
        $baseScheduledAt = Carbon::parse($lastInvoice->scheduled_at)->utc();
        $lineItemProperties = $lastInvoice->line_item_properties ?? [];

        for ($offset = 1; $offset <= 5; $offset++) {
            $cycleIndex = (int) $lastInvoice->cycle_index + $offset;
            $scheduledAt = $this->addInvoiceInterval(
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

        $this->syncNextBillingDateFromInvoices($subscription);

        Log::info('Manual recurring invoice schedules extended', [
            'subscription_id' => $subscription->id,
            'from_cycle' => (int) $lastInvoice->cycle_index + 1,
            'to_cycle' => (int) $lastInvoice->cycle_index + 5,
            'interval' => "{$intervalValue} {$intervalUnit}",
        ]);
    }

    private function syncNextBillingDateFromInvoices(Subscription $subscription): void
    {
        $nextInvoice = SubscriptionInvoice::query()
            ->where('subscription_id', $subscription->id)
            ->where('payment_status', SubscriptionInvoice::STATUS_UPCOMING)
            ->orderBy('scheduled_at')
            ->orderBy('cycle_index')
            ->first();

        if ($nextInvoice) {
            $subscription->update([
                'next_billing_date' => $nextInvoice->scheduled_at,
            ]);
        }
    }

    private function normalizeInvoiceInterval(string $interval): string
    {
        $normalized = strtolower(trim($interval));

        return match ($normalized) {
            'day', 'days' => 'days',
            'week', 'weeks' => 'weeks',
            'year', 'years' => 'years',
            default => 'months',
        };
    }

    private function addInvoiceInterval(Carbon $date, string $interval, int $count): Carbon
    {
        return match ($this->normalizeInvoiceInterval($interval)) {
            'days' => $date->addDays($count),
            'weeks' => $date->addWeeks($count),
            'years' => $date->addYears($count),
            default => $date->addMonths($count),
        };
    }

    private function transformInvoice(
        SubscriptionInvoice $invoice,
        ?int $nextUpcomingId = null
    ): array {
        return [
            'id' => $invoice->id,
            'cycle_index' => $invoice->cycle_index,
            'scheduled_at' => $invoice->scheduled_at?->toIso8601String(),
            'interval_value' => $invoice->interval_value,
            'interval_unit' => $invoice->interval_unit,
            'payment_status' => $invoice->payment_status,
            'shopify_draft_order_id' => $invoice->shopify_draft_order_id,
            'invoice_url' => $invoice->invoice_url,
            'email_sent_at' => $invoice->email_sent_at?->toIso8601String(),
            'paid_at' => $invoice->paid_at?->toIso8601String(),
            'is_next' => $nextUpcomingId !== null && (int) $invoice->id === (int) $nextUpcomingId,
            'can_request_now' => $nextUpcomingId !== null
                && (int) $invoice->id === (int) $nextUpcomingId
                && $invoice->payment_status === SubscriptionInvoice::STATUS_UPCOMING
                && empty($invoice->shopify_draft_order_id),
            'can_resend' => $invoice->payment_status === SubscriptionInvoice::STATUS_PENDING
                && ! empty($invoice->shopify_draft_order_id),
            'can_reschedule' => $invoice->payment_status === SubscriptionInvoice::STATUS_UPCOMING
                && empty($invoice->shopify_draft_order_id),
        ];
    }

    public function billingCycles(int $id, array $params = []): array
    {
        $subscription = $this->findForShop($id);
        $page = max(1, (int) ($params['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($params['per_page'] ?? 10)));
        $after = isset($params['after']) && $params['after'] !== ''
            ? (string) $params['after']
            : null;

        $empty = [
            'cycles' => [],
            'page_info' => [
                'has_next_page' => false,
                'has_previous_page' => $page > 1,
                'start_cursor' => null,
                'end_cursor' => null,
                'page' => $page,
                'per_page' => $perPage,
                'start_index' => (($page - 1) * $perPage) + 1,
                'end_index' => $page * $perPage,
            ],
        ];

        if (! $subscription->shopify_gid) {
            return $empty;
        }

        $shop = $subscription->shop ?? $this->shopifyGraphqlService->shop();

        try {
            return $this->shopifySubscriptionContractService->fetchBillingCycles(
                $shop,
                $subscription->shopify_gid,
                $page,
                $perPage,
                $after
            );
        } catch (ShopifySellingPlanException $exception) {
            if (! str_contains(strtolower($exception->getMessage()), 'out of range')) {
                throw $exception;
            }

            // Index window invalid — fall back to a tight date window around next billing.
            if ($page === 1 && $after === null) {
                try {
                    return $this->shopifySubscriptionContractService->fetchBillingCyclesByDateRange(
                        $shop,
                        $subscription->shopify_gid,
                        $this->billingCycleDateRange($subscription)[0],
                        $this->billingCycleDateRange($subscription)[1],
                        $perPage
                    );
                } catch (ShopifySellingPlanException) {
                    return $empty;
                }
            }

            return $empty;
        }
    }

    public function chargeCycle(int $id, int $cycleIndex, bool $asSystem = false): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);
        $subscription->loadMissing('products');

        $pricingResult = $this->applyPlanPricingForCycle($shop, $subscription, $cycleIndex);

        $result = $this->shopifySubscriptionContractService->chargeCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );

        $nextBillingDate = null;
        $chargeSucceeded = empty($result['error_message']);

        if ($chargeSucceeded) {
            $nextBillingDate = $this->syncNextBillingDateAfterCharge(
                $shop,
                $subscription,
                $cycleIndex
            );
        }

        $message = $asSystem
            ? "System charged billing cycle #{$cycleIndex}."
            : "Merchant charged billing cycle #{$cycleIndex}.";

        $meta = [
            'cycle_index' => $cycleIndex,
            'pricing_updated' => $pricingResult['updated'],
            'applied_pricing' => $pricingResult['applied_pricing'],
            'source' => $asSystem ? 'system' : 'merchant',
            'next_billing_date' => $nextBillingDate,
        ];

        if ($asSystem) {
            $this->activityLogService->logSystem(
                $subscription,
                SubscriptionActivityLogService::ACTION_CHARGED,
                $message,
                $meta
            );
        } else {
            $this->activityLogService->logMerchant(
                $subscription,
                SubscriptionActivityLogService::ACTION_CHARGED,
                $message,
                $meta
            );
        }

        return array_merge($result, [
            'pricing_updated' => $pricingResult['updated'],
            'applied_pricing' => $pricingResult['applied_pricing'],
            'next_billing_date' => $nextBillingDate,
        ]);
    }

    private function syncNextBillingDateAfterCharge(
        $shop,
        Subscription $subscription,
        int $chargedCycleIndex
    ): ?string {
        try {
            $nextDate = $this->shopifySubscriptionContractService->resolveNextBillingDateAfterCycle(
                $shop,
                $subscription->shopify_gid,
                $chargedCycleIndex
            );

            if (! $nextDate) {
                return $subscription->next_billing_date?->toIso8601String();
            }

            $subscription->forceFill([
                'next_billing_date' => Carbon::parse($nextDate),
                'last_payment_status' => 'SUCCEEDED',
                'last_billing_attempt_error_type' => null,
            ])->save();

            return Carbon::parse($nextDate)->toIso8601String();
        } catch (\Throwable $exception) {
            \Illuminate\Support\Facades\Log::warning('Unable to sync next billing date after charge', [
                'subscription_id' => $subscription->id,
                'cycle_index' => $chargedCycleIndex,
                'message' => $exception->getMessage(),
            ]);

            return $subscription->next_billing_date?->toIso8601String();
        }
    }

    public function skipCycle(int $id, int $cycleIndex): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $result = $this->shopifySubscriptionContractService->skipCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_SKIPPED,
            "Merchant skipped billing cycle #{$cycleIndex}.",
            ['cycle_index' => $cycleIndex]
        );

        return $result;
    }

    public function unskipCycle(int $id, int $cycleIndex): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $result = $this->shopifySubscriptionContractService->unskipCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_UNSKIPPED,
            "Merchant unskipped billing cycle #{$cycleIndex}.",
            ['cycle_index' => $cycleIndex]
        );

        return $result;
    }

    public function rescheduleCycle(int $id, int $cycleIndex, string $billingDate): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $result = $this->shopifySubscriptionContractService->rescheduleCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex,
            $billingDate
        );

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_RESCHEDULED,
            "Merchant rescheduled billing cycle #{$cycleIndex}.",
            ['cycle_index' => $cycleIndex, 'billing_date' => $billingDate]
        );

        return $result;
    }

    public function fulfillments(int $id): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);
        $subscription->loadMissing('recurringOrders');

        $orderGids = [];

        if ($subscription->shopify_origin_order_gid) {
            $orderGids[] = $subscription->shopify_origin_order_gid;
        } elseif ($subscription->shopify_origin_order_id) {
            $orderGids[] = 'gid://shopify/Order/'.$subscription->shopify_origin_order_id;
        } else {
            try {
                $contract = $this->shopifySubscriptionContractService->fetchContract(
                    $shop,
                    $subscription->shopify_gid
                );
                $originGid = $contract['originOrder']['id'] ?? null;

                if (is_string($originGid) && $originGid !== '') {
                    $orderGids[] = $originGid;
                    $subscription->forceFill([
                        'shopify_origin_order_gid' => $originGid,
                        'shopify_origin_order_id' => isset($contract['originOrder']['legacyResourceId'])
                            ? (int) $contract['originOrder']['legacyResourceId']
                            : $subscription->shopify_origin_order_id,
                    ])->save();
                }
            } catch (\Throwable $exception) {
                \Illuminate\Support\Facades\Log::warning('Unable to resolve prepaid origin order for fulfillments', [
                    'subscription_id' => $subscription->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        foreach ($subscription->recurringOrders as $order) {
            if (! empty($order->shopify_gid)) {
                $orderGids[] = $order->shopify_gid;
            } elseif (! empty($order->shopify_order_id)) {
                $orderGids[] = 'gid://shopify/Order/'.$order->shopify_order_id;
            }
        }

        if ($orderGids === []) {
            return [
                'summary' => [
                    'total' => 0,
                    'fulfilled' => 0,
                    'pending' => 0,
                    'next_fulfillment' => null,
                    'progress' => 0,
                ],
                'fulfillments' => [],
            ];
        }

        return $this->shopifySubscriptionContractService->fetchPrepaidFulfillments($shop, $orderGids);
    }

    public function rescheduleFulfillment(int $id, string $fulfillmentOrderId, string $fulfillAt): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $result = $this->shopifySubscriptionContractService->rescheduleFulfillmentOrder(
            $shop,
            $fulfillmentOrderId,
            $fulfillAt
        );

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_RESCHEDULED,
            'Merchant rescheduled a prepaid fulfillment.',
            [
                'fulfillment_order_id' => $fulfillmentOrderId,
                'fulfill_at' => $fulfillAt,
            ]
        );

        return $result;
    }

    public function skipFulfillment(int $id, string $fulfillmentOrderId): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $payload = $this->fulfillments($id);
        $target = collect($payload['fulfillments'] ?? [])
            ->first(fn (array $fo) => ($fo['id'] ?? null) === $fulfillmentOrderId);

        if (! $target) {
            throw new ShopifySellingPlanException('Fulfillment order not found on this subscription.');
        }

        $interval = strtoupper((string) ($subscription->delivery_interval ?? 'MONTH'));
        $count = max(1, (int) ($subscription->delivery_interval_count ?? 1));
        $base = ! empty($target['fulfill_at'])
            ? Carbon::parse($target['fulfill_at'])->utc()
            : now('UTC');

        $newDate = match ($interval) {
            'DAY' => $base->copy()->addDays($count),
            'WEEK' => $base->copy()->addWeeks($count),
            'YEAR' => $base->copy()->addYears($count),
            default => $base->copy()->addMonths($count),
        };

        $fulfillAt = $newDate->format('Y-m-d\TH:i:s\Z');

        $result = $this->shopifySubscriptionContractService->rescheduleFulfillmentOrder(
            $shop,
            $fulfillmentOrderId,
            $fulfillAt
        );

        try {
            $this->shopifySubscriptionContractService->setContractNextBillingDate(
                $shop,
                $subscription->shopify_gid,
                $fulfillAt
            );
            $subscription->forceFill(['next_billing_date' => $newDate])->save();
        } catch (\Throwable $exception) {
            \Illuminate\Support\Facades\Log::warning('Unable to bump next billing date after fulfillment skip', [
                'subscription_id' => $subscription->id,
                'message' => $exception->getMessage(),
            ]);
        }

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_SKIPPED,
            'Merchant skipped a prepaid fulfillment.',
            [
                'fulfillment_order_id' => $fulfillmentOrderId,
                'fulfill_at' => $fulfillAt,
            ]
        );

        return $result;
    }

    public function refundFulfillment(int $id, string $fulfillmentOrderId): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $payload = $this->fulfillments($id);
        $target = collect($payload['fulfillments'] ?? [])
            ->first(fn (array $fo) => ($fo['id'] ?? null) === $fulfillmentOrderId);

        if (! $target) {
            throw new ShopifySellingPlanException('Fulfillment order not found on this subscription.');
        }

        $orderGid = $target['order_id'] ?? $subscription->shopify_origin_order_gid;

        if (! $orderGid) {
            throw new ShopifySellingPlanException('Origin order is missing for this prepaid subscription.');
        }

        $result = $this->shopifySubscriptionContractService->refundFulfillmentOrder(
            $shop,
            $orderGid,
            $target
        );

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_UPDATED,
            'Merchant refunded a prepaid fulfillment.',
            [
                'fulfillment_order_id' => $fulfillmentOrderId,
                'refund_id' => $result['id'] ?? null,
            ]
        );

        return $result;
    }

    public function addDiscount(int $id, array $input): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->addDiscount(
            $shop,
            $subscription->shopify_gid,
            $input
        );
    }

    public function removeDiscount(int $id, string $discountId): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->removeDiscount(
            $shop,
            $subscription->shopify_gid,
            $discountId
        );
    }

    public function customerPaymentMethods(int $id): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $current = $this->shopifySubscriptionContractService->fetchPaymentMethod(
            $shop,
            $subscription->shopify_gid
        );

        $customerGid = $current['customer_gid']
            ?? ($subscription->customer?->shopify_gid
                ? $subscription->customer->shopify_gid
                : ($subscription->customer?->shopify_customer_id
                    ? 'gid://shopify/Customer/'.$subscription->customer->shopify_customer_id
                    : null));

        if (! $customerGid) {
            return [
                'current' => $current,
                'methods' => [],
            ];
        }

        return [
            'current' => $current,
            'methods' => $this->shopifySubscriptionContractService->fetchCustomerPaymentMethods(
                $shop,
                $customerGid,
                $current['id'] ?? null
            ),
        ];
    }

    public function sendPaymentMethodUpdateEmail(int $id): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $current = $this->shopifySubscriptionContractService->fetchPaymentMethod(
            $shop,
            $subscription->shopify_gid
        );

        if (empty($current['id'])) {
            throw new ShopifySellingPlanException('No payment method found on this subscription.');
        }

        return $this->shopifySubscriptionContractService->sendPaymentMethodUpdateEmail(
            $shop,
            $current['id']
        );
    }

    public function swapPaymentMethod(int $id, string $paymentMethodId): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->swapPaymentMethod(
            $shop,
            $subscription->shopify_gid,
            $paymentMethodId
        );
    }

    public function customerAddresses(int $id): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $current = $this->shopifySubscriptionContractService->fetchShippingAddress(
            $shop,
            $subscription->shopify_gid
        );

        $customerGid = $current['customer_gid']
            ?? ($subscription->customer?->shopify_gid
                ? $subscription->customer->shopify_gid
                : ($subscription->customer?->shopify_customer_id
                    ? 'gid://shopify/Customer/'.$subscription->customer->shopify_customer_id
                    : null));

        if (! $customerGid) {
            return [
                'current' => $current,
                'addresses' => [],
                'customer_admin_url' => null,
            ];
        }

        return [
            'current' => $current,
            'addresses' => $this->shopifySubscriptionContractService->fetchCustomerAddresses(
                $shop,
                $customerGid,
                $current
            ),
            'customer_admin_url' => $current['customer_admin_url'] ?? null,
        ];
    }

    public function updateShippingAddress(int $id, array $address): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $updated = $this->shopifySubscriptionContractService->updateShippingAddress(
            $shop,
            $subscription->shopify_gid,
            $address
        );

        if ($updated !== []) {
            $subscription->shipping()->updateOrCreate(
                ['subscription_id' => $subscription->id],
                [
                    'delivery_method_type' => $updated['delivery_method_type']
                        ?? $subscription->shipping?->delivery_method_type,
                    'shipping_option_title' => $updated['shipping_option_title']
                        ?? $subscription->shipping?->shipping_option_title,
                    'first_name' => $updated['first_name'] ?? null,
                    'last_name' => $updated['last_name'] ?? null,
                    'company' => $updated['company'] ?? null,
                    'address1' => $updated['address1'] ?? null,
                    'address2' => $updated['address2'] ?? null,
                    'city' => $updated['city'] ?? null,
                    'province' => $updated['province'] ?? null,
                    'province_code' => $updated['province_code'] ?? null,
                    'country' => $updated['country'] ?? null,
                    'country_code' => $updated['country_code'] ?? null,
                    'zip' => $updated['zip'] ?? null,
                    'phone' => $updated['phone'] ?? null,
                ]
            );
        }

        return $updated;
    }

    public function syncCustomer(int $id): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $customer = $subscription->customer;

        if (! $customer) {
            throw new ShopifySellingPlanException('No customer is linked to this subscription.');
        }

        $customerGid = $customer->shopify_gid
            ?: ($customer->shopify_customer_id
                ? 'gid://shopify/Customer/'.$customer->shopify_customer_id
                : null);

        if (! $customerGid) {
            throw new ShopifySellingPlanException('Customer is missing Shopify ID.');
        }

        $remote = $this->shopifySubscriptionContractService->fetchCustomer($shop, $customerGid);

        $customer->fill([
            'shopify_gid' => $remote['shopify_gid'] ?? $customer->shopify_gid,
            'shopify_customer_id' => $remote['shopify_customer_id'] ?? $customer->shopify_customer_id,
            'email' => $remote['email'] ?? $customer->email,
            'first_name' => $remote['first_name'] ?? $customer->first_name,
            'last_name' => $remote['last_name'] ?? $customer->last_name,
            'phone' => $remote['phone'] ?? $customer->phone,
        ])->save();

        return $this->transformCustomer($customer->fresh());
    }

    public function create(array $payload): array
    {
        $shop = $this->shopifyGraphqlService->shop();

        $billingType = $payload['billing_type'] ?? 'Pay as you go';
        $isPrepaid = $billingType === 'Prepaid';
        $deliveryFrequency = max(1, (int) ($payload['delivery_frequency'] ?? 1));
        $deliveryInterval = (string) ($payload['delivery_interval'] ?? 'months');
        $billingFrequency = $isPrepaid
            ? max(1, (int) ($payload['billing_frequency'] ?? $deliveryFrequency))
            : $deliveryFrequency;
        $billingInterval = $isPrepaid
            ? (string) ($payload['billing_interval'] ?? $deliveryInterval)
            : $deliveryInterval;

        if ($isPrepaid) {
            if ($billingFrequency % $deliveryFrequency !== 0) {
                throw new ShopifySellingPlanException(
                    'Billing frequency must be a multiple of delivery frequency for prepaid subscriptions.'
                );
            }

            if (strtolower($billingInterval) !== strtolower($deliveryInterval)) {
                throw new ShopifySellingPlanException(
                    'Billing interval must match delivery interval for prepaid subscriptions.'
                );
            }
        }

        $lines = $payload['lines'] ?? [];

        if ($lines === []) {
            throw new ShopifySellingPlanException('At least one product is required.');
        }

        $nextBillingDate = Carbon::parse($payload['next_billing_date'])->toIso8601String();

        $contract = $this->shopifySubscriptionContractService->createContract($shop, [
            'customer_id' => $payload['customer_id'],
            'payment_method_id' => $payload['payment_method_id'],
            'currency_code' => $payload['currency_code']
                ?? $this->shopifySubscriptionContractService->fetchShopCurrency($shop),
            'next_billing_date' => $nextBillingDate,
            'status' => $payload['status'] ?? 'PAUSED',
            'billing_type' => $billingType,
            'delivery_frequency' => $deliveryFrequency,
            'delivery_interval' => $deliveryInterval,
            'billing_frequency' => $isPrepaid ? $billingFrequency : null,
            'billing_interval' => $isPrepaid ? $billingInterval : null,
            'billing_min_cycles' => $payload['billing_min_cycles'] ?? null,
            'billing_max_cycles' => $payload['billing_max_cycles'] ?? null,
            'delivery_price' => $payload['delivery_price'] ?? 0,
            'delivery_method_title' => $payload['delivery_method_title'] ?? 'Subscription shipping',
            'digital_product' => (bool) ($payload['digital_product'] ?? false),
            'shipping' => $payload['shipping'] ?? null,
            'lines' => $lines,
        ]);

        $contractGid = $contract['id'] ?? null;

        if (! $contractGid) {
            throw new ShopifySellingPlanException('Subscription was created in Shopify but no contract id was returned.');
        }

        $subscription = $this->subscriptionContractSyncService->syncFromContractGid($shop, $contractGid);

        if ($subscription === null) {
            throw new ShopifySellingPlanException('Subscription was created in Shopify but failed to save locally.');
        }

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_CREATED,
            'Merchant created the subscription.'
        );

        return $this->show($subscription->id);
    }

    public function searchCustomers(string $query): array
    {
        $shop = $this->shopifyGraphqlService->shop();

        return $this->shopifySubscriptionContractService->searchCustomers($shop, $query);
    }

    public function paymentMethodsForCustomer(string $customerId): array
    {
        $shop = $this->shopifyGraphqlService->shop();
        $customerGid = $this->toCustomerGid($customerId);

        return $this->shopifySubscriptionContractService->fetchCustomerPaymentMethods($shop, $customerGid);
    }

    public function addressesForCustomer(string $customerId): array
    {
        $shop = $this->shopifyGraphqlService->shop();
        $customerGid = $this->toCustomerGid($customerId);

        return $this->shopifySubscriptionContractService->fetchCustomerAddresses($shop, $customerGid);
    }

    public function createMeta(): array
    {
        $shop = $this->shopifyGraphqlService->shop();

        return $this->shopifySubscriptionContractService->fetchShopCurrencies($shop);
    }

    private function toCustomerGid(string $customerId): string
    {
        $customerId = trim($customerId);

        if (str_starts_with($customerId, 'gid://')) {
            return $customerId;
        }

        return 'gid://shopify/Customer/'.$customerId;
    }

    public function pause(int $id): array
    {
        return $this->changeStatus($id, 'pause');
    }

    public function resume(int $id): array
    {
        return $this->changeStatus($id, 'resume');
    }

    public function cancel(int $id): array
    {
        return $this->changeStatus($id, 'cancel');
    }

    private function changeStatus(int $id, string $action): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);
        $current = strtolower((string) $subscription->status);

        if ($action === 'pause') {
            if ($current !== 'active') {
                throw new ShopifySellingPlanException('Only active subscriptions can be paused.');
            }

            $this->shopifySubscriptionContractService->pauseContract($shop, $subscription->shopify_gid);
        } elseif ($action === 'resume') {
            if (! in_array($current, ['paused', 'failed'], true)) {
                throw new ShopifySellingPlanException('Only paused or failed subscriptions can be resumed.');
            }

            $this->shopifySubscriptionContractService->activateContract($shop, $subscription->shopify_gid);
        } elseif ($action === 'cancel') {
            if ($current === 'cancelled') {
                throw new ShopifySellingPlanException('Subscription is already cancelled.');
            }

            $this->shopifySubscriptionContractService->cancelContract($shop, $subscription->shopify_gid);
        } else {
            throw new ShopifySellingPlanException('Unsupported subscription status action.');
        }

        $synced = $this->subscriptionContractSyncService->syncFromContractGid(
            $shop,
            $subscription->shopify_gid
        );

        $target = $synced ?? $subscription->fresh();

        if ($synced === null) {
            $fallbackStatus = match ($action) {
                'pause' => 'paused',
                'resume' => 'active',
                'cancel' => 'cancelled',
                default => $current,
            };

            $subscription->status = $fallbackStatus;
            $subscription->save();
            $target = $subscription;
        }

        $this->activityLogService->logMerchant(
            $target,
            match ($action) {
                'pause' => SubscriptionActivityLogService::ACTION_PAUSED,
                'resume' => SubscriptionActivityLogService::ACTION_RESUMED,
                'cancel' => SubscriptionActivityLogService::ACTION_CANCELLED,
                default => $action,
            },
            match ($action) {
                'pause' => 'Merchant paused the subscription.',
                'resume' => 'Merchant resumed the subscription.',
                'cancel' => 'Merchant cancelled the subscription.',
                default => "Merchant updated the subscription ({$action}).",
            }
        );

        return $this->show($target->id);
    }

    public function update(int $id, array $payload): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        $billingType = $payload['billing_type'] ?? 'Pay as you go';
        $isPrepaid = $billingType === 'Prepaid';
        $deliveryFrequency = max(1, (int) ($payload['delivery_frequency'] ?? 1));
        $deliveryInterval = (string) ($payload['delivery_interval'] ?? 'months');
        $billingFrequency = $isPrepaid
            ? max(1, (int) ($payload['billing_frequency'] ?? $deliveryFrequency))
            : $deliveryFrequency;
        $billingInterval = $isPrepaid
            ? (string) ($payload['billing_interval'] ?? $deliveryInterval)
            : $deliveryInterval;

        if ($isPrepaid) {
            if ($billingFrequency < 1) {
                throw new ShopifySellingPlanException('Billing frequency is required for prepaid subscriptions.');
            }

            if ($billingFrequency % $deliveryFrequency !== 0) {
                throw new ShopifySellingPlanException(
                    'Billing frequency must be a multiple of delivery frequency for prepaid subscriptions.'
                );
            }

            if (strtolower($billingInterval) !== strtolower($deliveryInterval)) {
                throw new ShopifySellingPlanException(
                    'Billing interval must match delivery interval for prepaid subscriptions.'
                );
            }
        }

        $lines = $payload['lines'] ?? [];
        $remaining = collect($lines)->filter(fn ($line) => empty($line['remove']))->count();

        if ($remaining < 1) {
            throw new ShopifySellingPlanException('Subscription must keep at least one line item.');
        }

        foreach ($lines as $line) {
            if (! empty($line['add']) && empty($line['product_variant_id'])) {
                throw new ShopifySellingPlanException('New line items require a product variant.');
            }
        }

        $contract = $this->shopifySubscriptionContractService->updateContract(
            $shop,
            $subscription->shopify_gid,
            [
                'billing_type' => $billingType,
                'delivery_frequency' => $deliveryFrequency,
                'delivery_interval' => $deliveryInterval,
                'billing_frequency' => $isPrepaid ? $billingFrequency : null,
                'billing_interval' => $isPrepaid ? $billingInterval : null,
                'delivery_price' => $payload['delivery_price'] ?? null,
                'lines' => $lines,
            ]
        );

        $this->applyContractLocally($subscription, $contract);

        $this->activityLogService->logMerchant(
            $subscription,
            SubscriptionActivityLogService::ACTION_UPDATED,
            'Merchant updated the subscription.'
        );

        return $this->show($subscription->id);
    }

    private function applyContractLocally(Subscription $subscription, array $contract): void
    {
        if ($contract === []) {
            return;
        }

        $billingPolicy = $contract['billingPolicy'] ?? [];
        $deliveryPolicy = $contract['deliveryPolicy'] ?? [];
        $deliveryPrice = $contract['deliveryPrice'] ?? [];

        $subscription->fill([
            'shopify_revision_id' => isset($contract['revisionId']) ? (int) $contract['revisionId'] : $subscription->shopify_revision_id,
            'status' => strtolower((string) ($contract['status'] ?? $subscription->status)),
            'currency_code' => (string) ($contract['currencyCode'] ?? $subscription->currency_code),
            'billing_interval' => $billingPolicy['interval'] ?? $subscription->billing_interval,
            'billing_interval_count' => $billingPolicy['intervalCount'] ?? $subscription->billing_interval_count,
            'billing_min_cycles' => $billingPolicy['minCycles'] ?? $subscription->billing_min_cycles,
            'billing_max_cycles' => $billingPolicy['maxCycles'] ?? $subscription->billing_max_cycles,
            'delivery_interval' => $deliveryPolicy['interval'] ?? $subscription->delivery_interval,
            'delivery_interval_count' => $deliveryPolicy['intervalCount'] ?? $subscription->delivery_interval_count,
            'next_billing_date' => ! empty($contract['nextBillingDate'])
                ? Carbon::parse($contract['nextBillingDate'])
                : $subscription->next_billing_date,
            'delivery_price' => $deliveryPrice['amount'] ?? $subscription->delivery_price,
            'delivery_price_currency' => $deliveryPrice['currencyCode'] ?? $subscription->delivery_price_currency,
            'note' => $contract['note'] ?? $subscription->note,
            'shopify_updated_at' => ! empty($contract['updatedAt'])
                ? Carbon::parse($contract['updatedAt'])
                : $subscription->shopify_updated_at,
        ])->save();

        $lineIds = [];

        foreach ($contract['lines']['edges'] ?? [] as $edge) {
            $line = $edge['node'] ?? null;

            if (! is_array($line) || empty($line['id'])) {
                continue;
            }

            $lineIds[] = $line['id'];

            $subscription->products()->updateOrCreate(
                [
                    'shopify_line_id' => $line['id'],
                ],
                [
                    'shopify_product_id' => $this->gidToNumericId($line['productId'] ?? null),
                    'shopify_variant_id' => $this->gidToNumericId($line['variantId'] ?? null),
                    'shopify_selling_plan_id' => $this->gidToNumericId($line['sellingPlanId'] ?? null),
                    'selling_plan_name' => $line['sellingPlanName'] ?? null,
                    'title' => $line['title'] ?? null,
                    'variant_title' => $line['variantTitle'] ?? null,
                    'sku' => $line['sku'] ?? null,
                    'quantity' => (int) ($line['quantity'] ?? 1),
                    'current_price' => $line['currentPrice']['amount'] ?? 0,
                    'currency_code' => $line['currentPrice']['currencyCode']
                        ?? $subscription->currency_code,
                    'image_url' => $line['variantImage']['url'] ?? null,
                    'requires_shipping' => (bool) ($line['requiresShipping'] ?? true),
                ]
            );
        }

        if ($lineIds !== []) {
            $subscription->products()
                ->whereNotIn('shopify_line_id', $lineIds)
                ->delete();
        }
    }

    private function gidToNumericId(mixed $gid): ?int
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

    /**
     * @return array{0: \App\Models\User, 1: Subscription}
     */
    private function shopAndSubscription(int $id): array
    {
        $subscription = $this->findForShop($id, ['customer']);

        if (! $subscription->shopify_gid) {
            throw new ShopifySellingPlanException('Subscription contract is missing Shopify ID.');
        }

        $shop = $subscription->shop ?? $this->shopifyGraphqlService->shop();

        return [$shop, $subscription];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function billingCycleDateRange(Subscription $subscription): array
    {
        $minStart = Carbon::parse('2022-10-01 00:00:00', 'UTC');

        $anchor = ($subscription->next_billing_date
            ?? $subscription->shopify_created_at
            ?? $subscription->created_at
            ?? now()
        )->copy()->utc();

        $start = $anchor->copy()->subDays(7);
        if ($start->lt($minStart)) {
            $start = $minStart->copy();
        }

        $end = $anchor->copy()->addMonths(11);

        return [
            $start->format('Y-m-d\TH:i:s\Z'),
            $end->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    private function findForShop(int $id, array $with = []): Subscription
    {
        return Subscription::query()
            ->where('shop_id', $this->shopId())
            ->with($with)
            ->findOrFail($id);
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $status = strtolower((string) ($filters['status'] ?? 'all'));

        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('shopify_contract_id', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%")
                    ->orWhereHas('customer', function (Builder $customerQuery) use ($search) {
                        $customerQuery->where('email', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                    })
                    ->orWhereHas('products', function (Builder $productQuery) use ($search) {
                        $productQuery->where('title', 'like', "%{$search}%")
                            ->orWhere('sku', 'like', "%{$search}%");
                    });
            });
        }

        match ($status) {
            'active' => $query->where('status', 'active'),
            'paused' => $query->where('status', 'paused'),
            'cancelled' => $query->where('status', 'cancelled'),
            'failed' => $query->where(function (Builder $builder) {
                $builder->where('status', 'failed')
                    ->orWhere('last_payment_status', 'FAILED');
            }),
            'pending_payment' => $query->where('last_payment_status', 'PENDING'),
            'upcoming' => $query->where('status', 'active')
                ->whereNotNull('next_billing_date')
                ->where('next_billing_date', '>', now()),
            default => null,
        };
    }

    private function transformListItem(Subscription $subscription): array
    {
        $customer = $subscription->customer;
        $products = $subscription->products;
        $subtotal = $products->sum(fn ($product) => (float) $product->current_price * (int) $product->quantity);
        $total = $subtotal + (float) ($subscription->delivery_price ?? 0);

        return [
            'id' => $subscription->id,
            'reference' => '#'.$subscription->id,
            'shopify_contract_id' => $subscription->shopify_contract_id,
            'plan_type' => $subscription->plan_type ?? Subscription::PLAN_TYPE_AUTO_CHARGE,
            'status' => $subscription->status,
            'customer_name' => trim(($customer?->first_name ?? '').' '.($customer?->last_name ?? '')) ?: 'Unknown customer',
            'customer_email' => $customer?->email,
            'created_at' => optional($subscription->shopify_created_at ?? $subscription->created_at)?->toIso8601String(),
            'subscription_type' => $this->resolveSubscriptionType(
                $products,
                $subscription->plan_type ?? Subscription::PLAN_TYPE_AUTO_CHARGE
            ),
            'items_count' => $products->count(),
            'total_amount' => round($total, 2),
            'currency_code' => $subscription->currency_code,
            'frequency_label' => $this->formatFrequency(
                $subscription->billing_interval,
                $subscription->billing_interval_count
            ),
            'next_billing_date' => $subscription->next_billing_date?->toIso8601String(),
            'last_payment_status' => $subscription->last_payment_status,
            'products' => $products->map(fn ($product) => [
                'id' => $product->id,
                'title' => $product->title,
                'variant_title' => $product->variant_title,
                'quantity' => $product->quantity,
                'current_price' => (float) $product->current_price,
                'image_url' => $product->image_url,
            ])->values()->all(),
        ];
    }

    private function transformDetail(Subscription $subscription): array
    {
        $list = $this->transformListItem($subscription);

        return array_merge($list, [
            'shopify_gid' => $subscription->shopify_gid,
            'shopify_origin_order_id' => $subscription->shopify_origin_order_id,
            'shopify_origin_order_gid' => $subscription->shopify_origin_order_gid,
            'subscription_plan_id' => $subscription->subscription_plan_id,
            'subscription_plan_option_id' => $subscription->subscription_plan_option_id,
            'billing_interval' => $subscription->billing_interval,
            'billing_interval_count' => $subscription->billing_interval_count,
            'billing_min_cycles' => $subscription->billing_min_cycles,
            'billing_max_cycles' => $subscription->billing_max_cycles,
            'delivery_interval' => $subscription->delivery_interval,
            'delivery_interval_count' => $subscription->delivery_interval_count,
            'delivery_price' => (float) ($subscription->delivery_price ?? 0),
            'delivery_price_currency' => $subscription->delivery_price_currency,
            'note' => $subscription->note,
            'last_billing_attempt_error_type' => $subscription->last_billing_attempt_error_type,
            'updated_at' => optional($subscription->shopify_updated_at ?? $subscription->updated_at)?->toIso8601String(),
            'customer' => $subscription->customer
                ? $this->transformCustomer($subscription->customer)
                : null,
            'shipping' => $subscription->shipping ? [
                'delivery_method_type' => $subscription->shipping->delivery_method_type,
                'shipping_option_title' => $subscription->shipping->shipping_option_title,
                'first_name' => $subscription->shipping->first_name,
                'last_name' => $subscription->shipping->last_name,
                'company' => $subscription->shipping->company,
                'address1' => $subscription->shipping->address1,
                'address2' => $subscription->shipping->address2,
                'city' => $subscription->shipping->city,
                'province' => $subscription->shipping->province,
                'province_code' => $subscription->shipping->province_code,
                'country' => $subscription->shipping->country,
                'country_code' => $subscription->shipping->country_code,
                'zip' => $subscription->shipping->zip,
                'phone' => $subscription->shipping->phone,
                'customer_admin_url' => $subscription->customer?->shopify_customer_id
                    ? sprintf(
                        'https://%s/admin/customers/%s',
                        $this->shopifyGraphqlService->shop()->name,
                        $subscription->customer->shopify_customer_id
                    )
                    : null,
            ] : null,
            'recurring_orders' => $subscription->recurringOrders
                ->sortByDesc('processed_at')
                ->values()
                ->map(fn ($order) => [
                    'id' => $order->id,
                    'shopify_order_id' => $order->shopify_order_id,
                    'order_name' => $order->order_name,
                    'financial_status' => $order->financial_status,
                    'fulfillment_status' => $order->fulfillment_status,
                    'total_price' => (float) ($order->total_price ?? 0),
                    'currency_code' => $order->currency_code,
                    'processed_at' => $order->processed_at?->toIso8601String(),
                ])
                ->all(),
            'invoices' => $subscription->relationLoaded('invoices')
                ? (function () use ($subscription) {
                    $open = $subscription->invoices
                        ->filter(fn ($invoice) => in_array($invoice->payment_status, [
                            SubscriptionInvoice::STATUS_UPCOMING,
                            SubscriptionInvoice::STATUS_PENDING,
                            SubscriptionInvoice::STATUS_FAILED,
                        ], true))
                        ->sortBy([
                            ['scheduled_at', 'asc'],
                            ['cycle_index', 'asc'],
                        ])
                        ->values();
                    $nextUpcomingId = $open
                        ->first(fn ($invoice) => $invoice->payment_status === SubscriptionInvoice::STATUS_UPCOMING)
                        ?->id;

                    return $open->map(
                        fn ($invoice) => $this->transformInvoice($invoice, $nextUpcomingId)
                    )->all();
                })()
                : [],
            'products' => $this->transformDetailProducts($subscription)->all(),
            'activity_logs' => $subscription->relationLoaded('activityLogs')
                ? $subscription->activityLogs
                    ->sortByDesc('created_at')
                    ->values()
                    ->map(fn ($log) => [
                        'id' => $log->id,
                        'action' => $log->action,
                        'message' => $log->message,
                        'actor_type' => $log->actor_type,
                        'actor_label' => $log->actor_label,
                        'meta' => $log->meta,
                        'created_at' => $log->created_at?->format('Y-m-d H:i'),
                    ])
                    ->all()
                : $this->activityLogService->forSubscription($subscription),
        ]);
    }

    private function transformCustomer(Customer $customer): array
    {
        $shopDomain = $this->shopifyGraphqlService->shop()->name;
        $shopifyCustomerId = $customer->shopify_customer_id;

        return [
            'id' => $customer->id,
            'shopify_customer_id' => $shopifyCustomerId,
            'shopify_gid' => $customer->shopify_gid,
            'email' => $customer->email,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'phone' => $customer->phone,
            'admin_url' => $shopifyCustomerId
                ? sprintf('https://%s/admin/customers/%s', $shopDomain, $shopifyCustomerId)
                : null,
            'orders_url' => $shopifyCustomerId
                ? sprintf('https://%s/admin/orders?customer_id=%s', $shopDomain, $shopifyCustomerId)
                : null,
        ];
    }

    /**
     * Before charging a cycle, update line prices when the plan's afterCycle
     * recurring discount should apply (Shopify does not do this automatically).
     *
     * @return array{updated: bool, applied_pricing: list<array<string, mixed>>}
     */
    private function applyPlanPricingForCycle(User $shop, Subscription $subscription, int $cycleIndex): array
    {
        $planOptions = $this->resolvePlanOptionsForProducts($subscription->products);
        $lineUpdates = [];
        $appliedPricing = [];

        foreach ($subscription->products as $product) {
            if (! $product->shopify_line_id) {
                continue;
            }

            $planOption = $planOptions->get((string) $product->shopify_selling_plan_id);

            if (! $planOption) {
                continue;
            }

            $basePrice = $this->ensureProductBasePrice($product, $planOption, $subscription);

            $target = $this->resolveCycleTargetPrice(
                (float) $product->current_price,
                $basePrice,
                $planOption,
                $cycleIndex
            );

            if ($target === null) {
                continue;
            }

            $currentPrice = round((float) $product->current_price, 2);
            $targetPrice = round($target['price'], 2);

            $appliedPricing[] = [
                'product_id' => $product->id,
                'line_id' => $product->shopify_line_id,
                'cycle_index' => $cycleIndex,
                'pricing_stage' => $target['stage'],
                'after_cycle' => $target['after_cycle'],
                'base_price' => $basePrice,
                'from_price' => $currentPrice,
                'to_price' => $targetPrice,
            ];

            if (abs($currentPrice - $targetPrice) < 0.005) {
                continue;
            }

            $lineUpdates[] = [
                'id' => $product->shopify_line_id,
                'current_price' => number_format($targetPrice, 2, '.', ''),
                'product' => $product,
            ];
        }

        if ($lineUpdates === []) {
            return [
                'updated' => false,
                'applied_pricing' => $appliedPricing,
            ];
        }

        $contract = $this->shopifySubscriptionContractService->updateContractLinePrices(
            $shop,
            $subscription->shopify_gid,
            collect($lineUpdates)
                ->map(fn (array $line) => [
                    'id' => $line['id'],
                    'current_price' => $line['current_price'],
                ])
                ->all()
        );

        foreach ($lineUpdates as $line) {
            $line['product']->update([
                'current_price' => $line['current_price'],
            ]);
        }

        if ($contract !== []) {
            $this->applyContractLocally($subscription->fresh(['products']), $contract);
        }

        return [
            'updated' => true,
            'applied_pricing' => $appliedPricing,
        ];
    }

    /**
     * Persist catalog/compare-at base once so later % discounts don't reverse incorrectly.
     */
    private function ensureProductBasePrice(
        $product,
        SubscriptionPlanOption $option,
        Subscription $subscription
    ): float {
        $currentPrice = (float) $product->current_price;
        $giveDiscount = (bool) $option->give_discount;
        $firstAmount = (float) ($option->discount_amount ?? 0);
        $laterAmount = (float) ($option->later_discount_amount ?? 0);
        $firstType = (string) ($option->discount_type ?? 'Percentage off');
        $laterType = (string) ($option->later_discount_type ?? $firstType);
        $changeAfter = (bool) $option->change_discount_after_orders;
        $tolerance = 0.05;

        $hasRecurringOrders = $subscription->relationLoaded('recurringOrders')
            ? $subscription->recurringOrders->isNotEmpty()
            : $subscription->recurringOrders()->exists();

        if ($product->base_price !== null && (float) $product->base_price > 0) {
            $existingBase = round((float) $product->base_price, 2);
            $matchesFirst = $giveDiscount && $firstAmount > 0
                && abs($this->applyPlanAdjustment($existingBase, $firstAmount, $firstType) - $currentPrice) <= $tolerance;
            $matchesLater = $laterAmount > 0
                && abs($this->applyPlanAdjustment($existingBase, $laterAmount, $laterType) - $currentPrice) <= $tolerance;

            // Keep base when it explains the current price for the expected stage.
            if ($matchesLater) {
                return $existingBase;
            }

            if ($matchesFirst && ! ($hasRecurringOrders && $changeAfter && $laterAmount > $firstAmount)) {
                return $existingBase;
            }
        }

        // After renewals, current_price is usually the later discount.
        // Fresh checkout lines still carry the initial discount.
        if ($changeAfter && $hasRecurringOrders && $laterAmount > 0) {
            $base = $this->resolveBasePriceFromCurrent(
                $currentPrice,
                true,
                $laterAmount,
                $laterType
            );
        } elseif ($giveDiscount && $firstAmount > 0) {
            $base = $this->resolveBasePriceFromCurrent(
                $currentPrice,
                true,
                $firstAmount,
                $firstType
            );
        } else {
            $base = $currentPrice;
        }

        $base = round($base, 2);
        $product->forceFill(['base_price' => $base])->save();

        return $base;
    }

    /**
     * @return array{price: float, stage: string, after_cycle: int|null}|null
     */
    private function resolveCycleTargetPrice(
        float $currentPrice,
        float $basePrice,
        SubscriptionPlanOption $option,
        int $cycleIndex
    ): ?array {
        $giveDiscount = (bool) $option->give_discount;
        $changeAfter = (bool) $option->change_discount_after_orders;

        if (! $changeAfter) {
            return null;
        }

        $firstAmount = (float) ($option->discount_amount ?? 0);
        $laterAmount = (float) ($option->later_discount_amount ?? 0);
        $firstType = (string) ($option->discount_type ?? 'Percentage off');
        $laterType = (string) ($option->later_discount_type ?? $firstType);
        $afterCycle = max(1, (int) ($option->later_discount_after_orders ?? 1));
        $useLaterDiscount = $cycleIndex > $afterCycle;

        if ($useLaterDiscount) {
            return [
                'price' => round(
                    $this->applyPlanAdjustment($basePrice, $laterAmount, $laterType),
                    2
                ),
                'stage' => 'recurring',
                'after_cycle' => $afterCycle,
            ];
        }

        if ($giveDiscount && $firstAmount > 0) {
            return [
                'price' => round(
                    $this->applyPlanAdjustment($basePrice, $firstAmount, $firstType),
                    2
                ),
                'stage' => 'initial',
                'after_cycle' => $afterCycle,
            ];
        }

        return [
            'price' => round($currentPrice, 2),
            'stage' => 'initial',
            'after_cycle' => $afterCycle,
        ];
    }

    private function resolveSubscriptionType($products, ?string $planType = null): string
    {
        if ($planType === Subscription::PLAN_TYPE_RECURRING_INVOICE) {
            return 'Recurring invoices';
        }

        $sellingPlanName = $products->first()?->selling_plan_name;

        if ($sellingPlanName && str_contains(strtolower($sellingPlanName), 'invoice')) {
            return 'Recurring invoices';
        }

        return 'Auto-charge';
    }

    private function formatFrequency(?string $interval, ?int $count): ?string
    {
        if ($interval === null) {
            return null;
        }

        $count = max(1, (int) ($count ?? 1));
        $normalized = strtolower((string) $interval);
        $label = match ($normalized) {
            'day', 'days' => $count === 1 ? 'day' : 'days',
            'week', 'weeks' => $count === 1 ? 'week' : 'weeks',
            'month', 'months' => $count === 1 ? 'month' : 'months',
            'year', 'years' => $count === 1 ? 'year' : 'years',
            default => $normalized,
        };

        return "Repeats every {$count} {$label}";
    }

    private function transformDetailProducts(Subscription $subscription): Collection
    {
        $subscription->loadMissing('recurringOrders');
        $planOptions = $this->resolvePlanOptionsForProducts($subscription->products);

        return $subscription->products->map(function ($product) use ($subscription, $planOptions) {
            $planOption = $planOptions->get((string) $product->shopify_selling_plan_id);

            return [
                'id' => $product->id,
                'shopify_line_id' => $product->shopify_line_id,
                'shopify_product_id' => $product->shopify_product_id,
                'shopify_variant_id' => $product->shopify_variant_id,
                'shopify_selling_plan_id' => $product->shopify_selling_plan_id,
                'title' => $product->title,
                'variant_title' => $product->variant_title,
                'sku' => $product->sku,
                'quantity' => $product->quantity,
                'current_price' => (float) $product->current_price,
                'base_price' => $product->base_price !== null ? (float) $product->base_price : null,
                'currency_code' => $product->currency_code,
                'image_url' => $product->image_url,
                'selling_plan_name' => $product->selling_plan_name,
                'plan_discount' => $this->transformPlanDiscount(
                    $planOption,
                    $product,
                    $subscription
                ),
            ];
        })->values();
    }

    /**
     * @param  Collection<int, \App\Models\SubscriptionProduct>  $products
     * @return Collection<string, SubscriptionPlanOption>
     */
    private function resolvePlanOptionsForProducts(Collection $products): Collection
    {
        $sellingPlanIds = $products
            ->pluck('shopify_selling_plan_id')
            ->filter()
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->values();

        if ($sellingPlanIds->isEmpty()) {
            return collect();
        }

        $gids = $sellingPlanIds
            ->map(fn (string $id) => str_starts_with($id, 'gid://')
                ? $id
                : "gid://shopify/SellingPlan/{$id}")
            ->all();

        return SubscriptionPlanOption::query()
            ->where(function ($query) use ($sellingPlanIds, $gids) {
                $query->whereIn('shopify_plan_id', $sellingPlanIds->all())
                    ->orWhereIn('shopify_plan_id', $gids);
            })
            ->get()
            ->keyBy(fn (SubscriptionPlanOption $option) => (string) (
                $this->gidToNumericId($option->shopify_plan_id) ?? $option->shopify_plan_id
            ));
    }

    private function transformPlanDiscount(
        ?SubscriptionPlanOption $option,
        $product,
        Subscription $subscription
    ): ?array {
        if (! $option) {
            return null;
        }

        $giveDiscount = (bool) $option->give_discount;
        $changeAfter = (bool) $option->change_discount_after_orders;

        if (! $changeAfter) {
            return null;
        }

        $firstAmount = (float) ($option->discount_amount ?? 0);
        $laterAmount = (float) ($option->later_discount_amount ?? 0);
        $firstType = (string) ($option->discount_type ?? 'Percentage off');
        $laterType = (string) ($option->later_discount_type ?? $firstType);
        $afterOrders = max(1, (int) ($option->later_discount_after_orders ?? 1));

        $intervalCount = max(
            1,
            (int) ($subscription->delivery_interval_count
                ?? $option->delivery_frequency
                ?? 1)
        );
        $interval = $subscription->delivery_interval
            ?? $option->delivery_interval
            ?? 'month';
        $frequencyLabel = $this->formatIntervalLabel($interval, $intervalCount);

        $basePrice = $this->ensureProductBasePrice($product, $option, $subscription);

        $firstPrice = $giveDiscount && $firstAmount > 0
            ? round($this->applyPlanAdjustment($basePrice, $firstAmount, $firstType), 2)
            : round($basePrice, 2);
        $recurringPrice = round(
            $this->applyPlanAdjustment($basePrice, $laterAmount, $laterType),
            2
        );

        $summary = sprintf(
            'First payment %s, then %s every %s',
            number_format($firstPrice, 2, '.', ''),
            number_format($recurringPrice, 2, '.', ''),
            $frequencyLabel
        );

        return [
            'give_discount' => $giveDiscount,
            'discount_amount' => $firstAmount,
            'discount_type' => $firstType,
            'change_discount_after_orders' => true,
            'later_discount_amount' => $laterAmount,
            'later_discount_after_orders' => $afterOrders,
            'later_discount_type' => $laterType,
            'base_price' => round($basePrice, 2),
            'first_price' => $firstPrice,
            'recurring_price' => $recurringPrice,
            'frequency_label' => $frequencyLabel,
            'summary' => $summary,
        ];
    }

    private function resolveBasePriceFromCurrent(
        float $currentPrice,
        bool $giveDiscount,
        float $amount,
        string $type
    ): float {
        if (! $giveDiscount || $amount <= 0) {
            return $currentPrice;
        }

        if ($this->isPercentageDiscount($type)) {
            $factor = 1 - ($amount / 100);

            return $factor > 0 ? $currentPrice / $factor : $currentPrice;
        }

        return $currentPrice + $amount;
    }

    private function applyPlanAdjustment(float $basePrice, float $amount, string $type): float
    {
        if ($amount <= 0) {
            return $basePrice;
        }

        if ($this->isPercentageDiscount($type)) {
            return max(0, $basePrice * (1 - ($amount / 100)));
        }

        return max(0, $basePrice - $amount);
    }

    private function formatPlanAdjustmentLabel(float $amount, string $type): string
    {
        if ($this->isPercentageDiscount($type)) {
            return rtrim(rtrim(number_format($amount, 2, '.', ''), '0'), '.') . '%';
        }

        return number_format($amount, 2, '.', '');
    }

    private function isPercentageDiscount(string $type): bool
    {
        return str_contains(strtolower($type), 'percentage');
    }

    private function formatIntervalLabel(?string $interval, ?int $count): string
    {
        $count = max(1, (int) ($count ?? 1));
        $normalized = strtolower((string) ($interval ?? 'month'));
        $label = match ($normalized) {
            'day', 'days' => $count === 1 ? 'day' : 'days',
            'week', 'weeks' => $count === 1 ? 'week' : 'weeks',
            'month', 'months' => $count === 1 ? 'month' : 'months',
            'year', 'years' => $count === 1 ? 'year' : 'years',
            default => $normalized,
        };

        return $count === 1 ? $label : "{$count} {$label}";
    }

    private function shopId(): int
    {
        return $this->shopifyGraphqlService->shop()->id;
    }
}
