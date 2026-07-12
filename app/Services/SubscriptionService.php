<?php

namespace App\Services;

use App\Exceptions\ShopifySellingPlanException;
use App\Models\Subscription;
use App\Services\Shopify\ShopifyGraphqlService;
use App\Services\Shopify\ShopifySubscriptionContractService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class SubscriptionService
{
    public function __construct(
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected ShopifySubscriptionContractService $shopifySubscriptionContractService
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
        ]);

        $payload = $this->transformDetail($subscription);

        if ($subscription->shopify_gid) {
            try {
                $payload['payment_method'] = $this->shopifySubscriptionContractService->fetchPaymentMethod(
                    $this->shopifyGraphqlService->shop(),
                    $subscription->shopify_gid
                );
            } catch (ShopifySellingPlanException $exception) {
                $payload['payment_method'] = null;
                $payload['shopify_error'] = $exception->getMessage();
            }
        }

        return $payload;
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

    public function chargeCycle(int $id, int $cycleIndex): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->chargeCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );
    }

    public function skipCycle(int $id, int $cycleIndex): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->skipCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );
    }

    public function unskipCycle(int $id, int $cycleIndex): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->unskipCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex
        );
    }

    public function rescheduleCycle(int $id, int $cycleIndex, string $billingDate): array
    {
        [$shop, $subscription] = $this->shopAndSubscription($id);

        return $this->shopifySubscriptionContractService->rescheduleCycle(
            $shop,
            $subscription->shopify_gid,
            $cycleIndex,
            $billingDate
        );
    }

    /**
     * @return array{0: \App\Models\User, 1: Subscription}
     */
    private function shopAndSubscription(int $id): array
    {
        $subscription = $this->findForShop($id);

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
            'status' => $subscription->status,
            'customer_name' => trim(($customer?->first_name ?? '').' '.($customer?->last_name ?? '')) ?: 'Unknown customer',
            'customer_email' => $customer?->email,
            'created_at' => optional($subscription->shopify_created_at ?? $subscription->created_at)?->toIso8601String(),
            'subscription_type' => $this->resolveSubscriptionType($products),
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
            'delivery_interval' => $subscription->delivery_interval,
            'delivery_interval_count' => $subscription->delivery_interval_count,
            'delivery_price' => (float) ($subscription->delivery_price ?? 0),
            'delivery_price_currency' => $subscription->delivery_price_currency,
            'note' => $subscription->note,
            'last_billing_attempt_error_type' => $subscription->last_billing_attempt_error_type,
            'updated_at' => optional($subscription->shopify_updated_at ?? $subscription->updated_at)?->toIso8601String(),
            'customer' => $subscription->customer ? [
                'id' => $subscription->customer->id,
                'shopify_customer_id' => $subscription->customer->shopify_customer_id,
                'email' => $subscription->customer->email,
                'first_name' => $subscription->customer->first_name,
                'last_name' => $subscription->customer->last_name,
                'phone' => $subscription->customer->phone,
            ] : null,
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
            'products' => $subscription->products->map(fn ($product) => [
                'id' => $product->id,
                'title' => $product->title,
                'variant_title' => $product->variant_title,
                'sku' => $product->sku,
                'quantity' => $product->quantity,
                'current_price' => (float) $product->current_price,
                'currency_code' => $product->currency_code,
                'image_url' => $product->image_url,
                'selling_plan_name' => $product->selling_plan_name,
            ])->values()->all(),
        ]);
    }

    private function resolveSubscriptionType($products): string
    {
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
        $label = match ($interval) {
            'day', 'days' => $count === 1 ? 'day' : 'days',
            'week', 'weeks' => $count === 1 ? 'week' : 'weeks',
            'month', 'months' => $count === 1 ? 'month' : 'months',
            'year', 'years' => $count === 1 ? 'year' : 'years',
            default => $interval,
        };

        return "Repeats every {$count} {$label}";
    }

    private function shopId(): int
    {
        return $this->shopifyGraphqlService->shop()->id;
    }
}
