<?php

namespace App\Services\Shopify;

use App\Models\SubscriptionPlan;
use Illuminate\Support\Str;

class SellingPlanGroupPayloadBuilder
{
    public function buildGroupInput(SubscriptionPlan $plan, array $data): array
    {
        $options = $data['deliveryOptions'] ?? [];
        $merchantCode = $plan->merchant_code ?: $this->merchantCode($plan);

        return array_filter([
            'name' => $data['name'] ?? $plan->name,
            'merchantCode' => $merchantCode,
            'appId' => $this->appId(),
            'options' => ['Delivery every'],
            'position' => 1,
            'sellingPlansToCreate' => $this->buildSellingPlans($options),
        ], fn ($value) => $value !== null);
    }

    public function buildUpdateInput(SubscriptionPlan $plan, array $data): array
    {
        return array_filter([
            'name' => $data['name'] ?? $plan->name,
            'merchantCode' => $plan->merchant_code ?: $this->merchantCode($plan),
            'appId' => $this->appId(),
            'options' => ['Delivery every'],
            'sellingPlansToCreate' => $this->buildSellingPlans($data['deliveryOptions'] ?? []),
        ], fn ($value) => $value !== null);
    }

    public function appId(): string
    {
        return (string) config('shopify-app.selling_plan_app_id', 'subscribify');
    }

    public function buildResources(array $products): array
    {
        $productIds = [];
        $variantIds = [];

        foreach ($products as $product) {
            $variantId = $product['variantId'] ?? $product['shopify_variant_id'] ?? null;
            $productId = $product['id'] ?? $product['shopify_product_id'] ?? null;

            if ($variantId) {
                $variantIds[] = $this->toVariantGid($variantId);
                continue;
            }

            if ($productId) {
                $productIds[] = $this->toProductGid($productId);
            }
        }

        return [
            'productIds' => array_values(array_unique($productIds)),
            'productVariantIds' => array_values(array_unique($variantIds)),
        ];
    }

    private function buildSellingPlans(array $options): array
    {
        return collect($options)
            ->values()
            ->map(function (array $option, int $index) {
                $deliveryFrequency = (int) ($option['deliveryFrequency'] ?? $option['delivery_frequency'] ?? 1);
                $deliveryInterval = $this->mapInterval(
                    $option['deliveryInterval'] ?? $option['delivery_interval'] ?? 'months'
                );

                $billingType = $option['billingType'] ?? $option['billing_type'] ?? 'Pay as you go';
                $isPrepaid = $billingType === 'Prepaid';

                $billingInterval = $isPrepaid
                    ? $this->mapInterval($option['billingInterval'] ?? $option['billing_interval'] ?? 'months')
                    : $deliveryInterval;

                $billingFrequency = $isPrepaid
                    ? (int) ($option['billingFrequency'] ?? $option['billing_frequency'] ?? $deliveryFrequency)
                    : $deliveryFrequency;

                $name = trim($option['name'] ?? '') ?: $this->defaultSellingPlanName(
                    $billingType,
                    $deliveryFrequency,
                    $option['deliveryInterval'] ?? $option['delivery_interval'] ?? 'months',
                    $isPrepaid ? $billingFrequency : null
                );

                $billingPolicy = [
                    'recurring' => array_filter([
                        'interval' => $billingInterval,
                        'intervalCount' => max(1, $billingFrequency),
                        'minCycles' => $this->mapOrderLimit(
                            $option['minOrders'] ?? $option['min_orders'] ?? 'Disabled',
                            'min'
                        ),
                        'maxCycles' => $this->mapOrderLimit(
                            $option['maxOrders'] ?? $option['max_orders'] ?? 'Unlimited',
                            'max'
                        ),
                    ], fn ($value) => $value !== null),
                ];

                $deliveryPolicy = [
                    'recurring' => [
                        'interval' => $deliveryInterval,
                        'intervalCount' => max(1, $deliveryFrequency),
                        'preAnchorBehavior' => 'ASAP',
                        'cutoff' => 0,
                        'intent' => 'FULFILLMENT_BEGIN',
                    ],
                ];

                $sellingPlan = [
                    'name' => $name,
                    'options' => [
                        $this->formatSellingPlanOptionValue(
                            max(1, $deliveryFrequency),
                            $option['deliveryInterval'] ?? $option['delivery_interval'] ?? 'months'
                        ),
                    ],
                    'position' => $index + 1,
                    'category' => 'SUBSCRIPTION',
                    'billingPolicy' => $billingPolicy,
                    'deliveryPolicy' => $deliveryPolicy,
                    'inventoryPolicy' => [
                        'reserve' => 'ON_SALE',
                    ],
                ];

                $pricingPolicies = $this->buildPricingPolicies($option);

                if (!empty($pricingPolicies)) {
                    $sellingPlan['pricingPolicies'] = $pricingPolicies;
                }

                return $sellingPlan;
            })
            ->all();
    }

    private function buildPricingPolicies(array $option): array
    {
        $policies = [];

        $giveDiscount = (bool) ($option['giveDiscount'] ?? $option['give_discount'] ?? false);

        if ($giveDiscount) {
            $policies[] = [
                'fixed' => $this->buildAdjustment(
                    $option['discountAmount'] ?? $option['discount_amount'] ?? 0,
                    $option['discountType'] ?? $option['discount_type'] ?? 'Percentage off'
                ),
            ];
        }

        $changeAfter = (bool) (
            $option['changeDiscountAfterOrders'] ?? $option['change_discount_after_orders'] ?? false
        );

        if ($changeAfter) {
            $adjustment = $this->buildAdjustment(
                $option['laterDiscountAmount'] ?? $option['later_discount_amount'] ?? 0,
                $option['laterDiscountType'] ?? $option['later_discount_type'] ?? 'Percentage off'
            );

            $policies[] = [
                'recurring' => array_merge($adjustment, [
                    'afterCycle' => (int) (
                        $option['laterDiscountAfterOrders'] ?? $option['later_discount_after_orders'] ?? 1
                    ),
                ]),
            ];
        }

        return $policies;
    }

    private function buildAdjustment(float|int|string $amount, string $type): array
    {
        $isPercentage = str_contains(strtolower($type), 'percentage');

        return [
            'adjustmentType' => $isPercentage ? 'PERCENTAGE' : 'FIXED_AMOUNT',
            'adjustmentValue' => $isPercentage
                ? ['percentage' => (float) $amount]
                : ['fixedValue' => (string) $amount],
        ];
    }

    private function mapOrderLimit(?string $value, string $type): ?int
    {
        if ($value === null) {
            return null;
        }

        if ($type === 'min' && $value === 'Disabled') {
            return null;
        }

        if ($type === 'max' && $value === 'Unlimited') {
            return null;
        }

        return is_numeric($value) ? (int) $value : null;
    }

    private function defaultSellingPlanName(
        string $billingType,
        int $deliveryFrequency,
        string $deliveryInterval,
        ?int $billingFrequency = null
    ): string {
        if ($billingType === 'Prepaid' && $billingFrequency) {
            return sprintf(
                '%d %s prepaid, delivery every %d %s',
                $billingFrequency,
                $this->intervalLabel($deliveryInterval, true),
                $deliveryFrequency,
                $this->intervalLabel($deliveryInterval, true)
            );
        }

        return sprintf(
            'Subscription, delivery every %d %s',
            $deliveryFrequency,
            $this->intervalLabel($deliveryInterval, true)
        );
    }

    private function intervalLabel(string $interval, bool $plural = false): string
    {
        $label = match (strtolower($interval)) {
            'days', 'day' => 'day',
            'weeks', 'week' => 'week',
            'years', 'year' => 'year',
            default => 'month',
        };

        if ($plural) {
            return $label.'s';
        }

        return $label;
    }

    /**
     * One value per group option label ("Delivery every").
     * Shopify format examples: "1 Week(s)", "2 Week(s)", "1 Month"
     */
    private function formatSellingPlanOptionValue(int $frequency, string $interval): string
    {
        $unit = match (strtolower($interval)) {
            'days', 'day' => 'Day',
            'weeks', 'week' => 'Week',
            'years', 'year' => 'Year',
            default => 'Month',
        };

        if ($unit === 'Month' && $frequency === 1) {
            return '1 Month';
        }

        return sprintf('%d %s(s)', $frequency, $unit);
    }

    private function mapInterval(string $interval): string
    {
        return match (strtolower($interval)) {
            'days', 'day' => 'DAY',
            'weeks', 'week' => 'WEEK',
            'years', 'year' => 'YEAR',
            default => 'MONTH',
        };
    }

    private function merchantCode(SubscriptionPlan $plan): string
    {
        return Str::slug($plan->name).'-'.$plan->id;
    }

    public function toProductGid(string|int $id): string
    {
        $value = (string) $id;

        if (str_starts_with($value, 'gid://shopify/Product/')) {
            return $value;
        }

        if (str_contains($value, 'Product/')) {
            return str_starts_with($value, 'gid://') ? $value : 'gid://shopify/'.$value;
        }

        return 'gid://shopify/Product/'.$value;
    }

    public function toVariantGid(string|int $id): string
    {
        $value = (string) $id;

        if (str_starts_with($value, 'gid://shopify/ProductVariant/')) {
            return $value;
        }

        if (str_contains($value, 'ProductVariant/')) {
            return str_starts_with($value, 'gid://') ? $value : 'gid://shopify/'.$value;
        }

        return 'gid://shopify/ProductVariant/'.$value;
    }

    public function toSellingPlanGroupGid(string|int $id): string
    {
        $value = (string) $id;

        if (str_starts_with($value, 'gid://shopify/SellingPlanGroup/')) {
            return $value;
        }

        return 'gid://shopify/SellingPlanGroup/'.$value;
    }

    public function toSellingPlanGid(string|int $id): string
    {
        $value = (string) $id;

        if (str_starts_with($value, 'gid://shopify/SellingPlan/')) {
            return $value;
        }

        return 'gid://shopify/SellingPlan/'.$value;
    }
}
