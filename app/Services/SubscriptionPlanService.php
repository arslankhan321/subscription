<?php

namespace App\Services;

use DB;
use App\Models\SubscriptionPlan;
use App\Repositories\Plans\SubscriptionPlanRepositoryInterface;
use App\Services\Shopify\ShopifyGraphqlService;
use App\Services\Shopify\ShopifySellingPlanService;
use App\Services\Shopify\ShopWebhookRegistrationService;

class SubscriptionPlanService
{
    public function __construct(
        protected SubscriptionPlanRepositoryInterface $repository,
        protected ShopifySellingPlanService $shopifySellingPlanService,
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected ShopWebhookRegistrationService $shopWebhookRegistrationService
    ) {}

    public function index()
    {
        try {
            $this->shopifySellingPlanService->ensureOwnedGroupsHaveAppId($this->shopId());
        } catch (\Throwable) {
            // Storefront filter still works for newly stamped / created groups.
        }

        return $this->repository->all($this->shopId());
    }

    public function listShopifyGroups(int $first = 50, ?string $after = null): array
    {
        return $this->shopifySellingPlanService->listGroups($first, $after);
    }

    public function stampSellingPlanAppIds(): int
    {
        return $this->shopifySellingPlanService->ensureOwnedGroupsHaveAppId($this->shopId());
    }

    public function getShopifyScopeStatus(): array
    {
        $current = $this->shopifySellingPlanService->getCurrentScopes();
        $required = config('shopify-app.api_scopes');
        $requiredList = array_map('trim', explode(',', $required));
        $missing = array_values(array_diff($requiredList, $current));

        $hasSubscriptionScope = in_array('write_own_subscription_contracts', $current, true)
            || in_array('write_purchase_options', $current, true);

        $canCreateSellingPlans = in_array('write_products', $current, true) && $hasSubscriptionScope;

        return [
            'current' => $current,
            'required' => $requiredList,
            'missing' => $missing,
            'can_create_selling_plans' => $canCreateSellingPlans,
        ];
    }

    public function create(array $data)
    {
        $shop = $this->shopifyGraphqlService->shop();
        $shouldRegisterWebhooks = !$this->shopHasPlans($shop->id);

        $plan = DB::transaction(function () use ($data) {
            $plan = $this->repository->create($this->planAttributes($data));

            $this->syncRelations($plan, $data);

            if ($this->shouldSyncToShopify($data)) {
                $shopifyResult = $this->shopifySellingPlanService->createGroupForPlan($plan, $data);
                $this->applyShopifySync($plan, $shopifyResult);
            }

            return $plan->fresh()->load([
                'products',
                'options',
            ]);
        });

        if ($shouldRegisterWebhooks) {
            $this->shopWebhookRegistrationService->registerAfterFirstPlanCreated($shop);
        }

        return $plan;
    }

    public function show($id)
    {
        return $this->repository->find($id, $this->shopId());
    }

    /**
     * Storefront PDP lookup: which plan applies to this Shopify product.
     *
     * Prefers auto_charge when the product is on both plan types; otherwise
     * returns recurring_invoice when that is the only match.
     */
    public function storefrontPlanForProduct(int $shopId, int|string $shopifyProductId): array
    {
        $productIds = $this->normalizeShopifyProductIds($shopifyProductId);

        $autoChargeExists = SubscriptionPlan::query()
            ->where('shop_id', $shopId)
            ->where('plan_type', 'auto_charge')
            ->where('status', 'active')
            ->where('published', true)
            ->whereHas('products', fn ($q) => $q->whereIn('shopify_product_id', $productIds))
            ->exists();

        if ($autoChargeExists) {
            return ['plan_type' => 'auto_charge'];
        }

        $invoicePlan = SubscriptionPlan::query()
            ->where('shop_id', $shopId)
            ->where('plan_type', 'recurring_invoice')
            ->where('status', 'active')
            ->where('published', true)
            ->whereHas('products', fn ($q) => $q->whereIn('shopify_product_id', $productIds))
            ->with([
                'products',
                'options' => fn ($q) => $q->orderBy('position')->orderBy('id'),
            ])
            ->latest('id')
            ->first();

        if ($invoicePlan) {
            $matchedProducts = $invoicePlan->products
                ->filter(fn ($product) => in_array((string) $product->shopify_product_id, $productIds, true));

            $variantIds = [];
            foreach ($matchedProducts as $product) {
                foreach ($this->normalizeShopifyVariantIds($product->shopify_variant_id) as $variantId) {
                    $variantIds[] = $variantId;
                }
            }
            $variantIds = array_values(array_unique(array_filter($variantIds)));

            $giveDiscount = $invoicePlan->options->contains(
                fn ($option) => (bool) ($option->give_discount ?? false)
            );

            $discountOption = $invoicePlan->options->first(
                fn ($option) => (bool) ($option->give_discount ?? false)
            );

            return [
                'plan_type' => 'recurring_invoice',
                'plan_id' => $invoicePlan->id,
                'plan_name' => $invoicePlan->name,
                'variant_ids' => $variantIds,
                'give_discount' => $giveDiscount,
                'discount_description' => $giveDiscount
                    ? $invoicePlan->discount_description
                    : null,
                'discount_amount' => $giveDiscount && $discountOption?->discount_amount !== null
                    ? (float) $discountOption->discount_amount
                    : null,
                'discount_type' => $giveDiscount ? ($discountOption?->discount_type ?? null) : null,
                'options' => $invoicePlan->options->map(function ($option) {
                    $frequency = (int) ($option->delivery_frequency ?? 1);
                    $interval = (string) ($option->delivery_interval ?? 'days');
                    $label = trim((string) ($option->name ?: "{$frequency} {$interval}"));

                    return [
                        'id' => $option->id,
                        'label' => $label,
                        'delivery_frequency' => $frequency,
                        'delivery_interval' => $interval,
                        'give_discount' => (bool) ($option->give_discount ?? false),
                        'discount_amount' => $option->discount_amount !== null
                            ? (float) $option->discount_amount
                            : null,
                        'discount_type' => $option->discount_type,
                    ];
                })->values()->all(),
            ];
        }

        return ['plan_type' => null];
    }

    /**
     * Match both numeric Liquid IDs and Admin API GIDs stored on plan products.
     *
     * @return list<string>
     */
    private function normalizeShopifyProductIds(int|string $shopifyProductId): array
    {
        return $this->normalizeShopifyResourceIds($shopifyProductId, 'Product');
    }

    /**
     * @return list<string>
     */
    private function normalizeShopifyVariantIds(int|string|null $shopifyVariantId): array
    {
        if ($shopifyVariantId === null || trim((string) $shopifyVariantId) === '') {
            return [];
        }

        return $this->normalizeShopifyResourceIds($shopifyVariantId, 'ProductVariant');
    }

    /**
     * @return list<string>
     */
    private function normalizeShopifyResourceIds(int|string $resourceId, string $resourceType): array
    {
        $raw = trim((string) $resourceId);
        $numeric = $raw;

        if (str_contains($raw, 'gid://')) {
            $numeric = (string) (int) basename($raw);
        } else {
            $numeric = (string) (int) preg_replace('/\D+/', '', $raw);
        }

        return array_values(array_unique(array_filter([
            $raw,
            $numeric,
            $numeric !== '' && $numeric !== '0' ? "gid://shopify/{$resourceType}/{$numeric}" : null,
        ])));
    }

    public function resolveShopIdFromStorefrontRequest(\Illuminate\Http\Request $request): ?int
    {
        $shopDomain = $request->query('shop')
            ?: $request->header('X-Shopify-Shop-Domain')
            ?: $request->query('shop_domain');

        if (! is_string($shopDomain) || trim($shopDomain) === '') {
            return null;
        }

        $shopDomain = strtolower(trim($shopDomain));
        $shopDomain = preg_replace('#^https?://#', '', $shopDomain);
        $shopDomain = rtrim($shopDomain, '/');

        if (! str_contains($shopDomain, '.')) {
            $shopDomain .= '.myshopify.com';
        }

        $short = str_replace('.myshopify.com', '', $shopDomain);

        $user = \App\Models\User::query()
            ->where(function ($query) use ($shopDomain, $short) {
                $query->where('name', $shopDomain)
                    ->orWhere('name', $short);
            })
            ->first();

        return $user?->id;
    }

    public function update($id, array $data)
    {
        return DB::transaction(function () use ($id, $data) {
            $existingPlan = $this->repository->find($id, $this->shopId());
            $oldGroupId = $existingPlan->shopify_group_id;
            $oldSellingPlanIds = $existingPlan->options
                ->pluck('shopify_plan_id')
                ->filter()
                ->values()
                ->all();

            $plan = $this->repository->update($id, $this->shopId(), array_merge(
                $this->planAttributes($data, $existingPlan),
                ['merchant_code' => $data['merchant_code'] ?? $existingPlan->merchant_code]
            ));

            $plan->products()->delete();
            $plan->options()->delete();

            $this->syncRelations($plan, $data);

            if ($this->shouldSyncToShopify($data, $existingPlan)) {
                $shopifyResult = $this->shopifySellingPlanService->replaceGroupForPlan(
                    $plan,
                    $data,
                    $oldGroupId,
                    $oldSellingPlanIds
                );
                $this->applyShopifySync($plan, $shopifyResult);
            } elseif ($oldGroupId) {
                $this->shopifySellingPlanService->deleteGroup($oldGroupId);
                $this->clearShopifySync($plan);
            }

            return $plan->fresh()->load([
                'products',
                'options',
            ]);
        });
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $plan = $this->repository->find($id, $this->shopId());

            if ($plan->shopify_group_id) {
                $this->shopifySellingPlanService->deleteGroup($plan->shopify_group_id);
            }

            return $this->repository->delete($id, $this->shopId());
        });
    }

    private function shopId(): int
    {
        return $this->shopifyGraphqlService->shop()->id;
    }

    private function shopHasPlans(int $shopId): bool
    {
        return SubscriptionPlan::query()
            ->where('shop_id', $shopId)
            ->exists();
    }

    private function planAttributes(array $data, ?SubscriptionPlan $existing = null): array
    {
        return [
            'shop_id' => $existing?->shop_id ?? $this->shopId(),
            'name' => $data['name'],
            'status' => $data['status'] ?? 'draft',
            'published' => $data['published'] ?? false,
            'plan_type' => $data['planType'] ?? $existing?->plan_type ?? 'auto_charge',
            'subscription_email_hour' => $data['subscriptionEmailHour'] ?? null,
            'discount_description' => $data['discountDescription'] ?? null,
        ];
    }

    private function shouldSyncToShopify(array $data, ?SubscriptionPlan $existing = null): bool
    {
        $published = filter_var($data['published'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $status = $data['status'] ?? 'draft';
        $planType = $data['planType'] ?? $existing?->plan_type ?? 'auto_charge';

        return $published && $status === 'active' && $planType === 'auto_charge';
    }

    private function applyShopifySync(SubscriptionPlan $plan, array $shopifyResult): void
    {
        $plan->update([
            'shopify_group_id' => $shopifyResult['groupId'],
            'merchant_code' => $shopifyResult['merchantCode'] ?? $plan->merchant_code,
        ]);

        $plan->load('options');

        foreach ($plan->options as $option) {
            $shopifyPlanId = $shopifyResult['planIdsByPosition'][$option->position] ?? null;

            if ($shopifyPlanId) {
                $option->update(['shopify_plan_id' => $shopifyPlanId]);
            }
        }
    }

    private function clearShopifySync(SubscriptionPlan $plan): void
    {
        $plan->update(['shopify_group_id' => null]);
        $plan->options()->update(['shopify_plan_id' => null]);
    }

    private function syncRelations(SubscriptionPlan $plan, array $data): void
    {
        foreach ($data['products'] ?? [] as $product) {
            $plan->products()->create([
                'shopify_product_id' => $product['id'],
                'shopify_variant_id' => $product['variantId'] ?? null,
                'title' => $product['title'] ?? null,
                'image' => $product['image'] ?? null,
            ]);
        }

        foreach ($data['deliveryOptions'] ?? [] as $index => $option) {
            $plan->options()->create([
                'position' => $index + 1,
                'name' => $option['name'] ?? null,
                'billing_type' => $option['billingType'],
                'delivery_frequency' => $option['deliveryFrequency'],
                'delivery_interval' => $option['deliveryInterval'],
                'billing_frequency' => $option['billingFrequency'] ?? null,
                'billing_interval' => $option['billingInterval'] ?? null,
                'min_orders' => $option['minOrders'] ?? null,
                'max_orders' => $option['maxOrders'] ?? null,
                'give_discount' => $option['giveDiscount'] ?? false,
                'discount_amount' => $option['discountAmount'] ?? 0,
                'discount_type' => $option['discountType'] ?? null,
                'change_discount_after_orders' => $option['changeDiscountAfterOrders'] ?? false,
                'later_discount_amount' => $option['laterDiscountAmount'] ?? 0,
                'later_discount_after_orders' => $option['laterDiscountAfterOrders'] ?? null,
                'later_discount_type' => $option['laterDiscountType'] ?? null,
                'give_shipping_discount' => $option['giveShippingDiscount'] ?? false,
                'shipping_discount_amount' => $option['shippingDiscountAmount'] ?? 0,
                'shipping_discount_after_orders' => $option['shippingDiscountAfterOrders'] ?? null,
                'shipping_discount_type' => $option['shippingDiscountType'] ?? null,
            ]);
        }
    }
}
