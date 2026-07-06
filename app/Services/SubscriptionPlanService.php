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
        return $this->repository->all($this->shopId());
    }

    public function listShopifyGroups(int $first = 50, ?string $after = null): array
    {
        return $this->shopifySellingPlanService->listGroups($first, $after);
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
        $shouldRegisterWebhooks = $this->shopHasPlans($shop->id);

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
            'widget' => $data['widget'] ?? null,
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
