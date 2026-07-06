<?php

namespace App\Services;

use App\Models\ShopSetting;
use App\Services\Shopify\ShopifyGraphqlService;
use App\Services\Shopify\ShopifyInventoryLocationService;

class ShopSettingsService
{
    public function __construct(
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected ShopifyInventoryLocationService $inventoryLocationService
    ) {}

    public function defaults(): array
    {
        return [
            'upcoming_order_notification_days' => 1,
            'billing_hour' => 10,
            'billing_minute' => 0,
            'billing_timezone' => 'America/New_York',
            'payment_retry_attempts' => 3,
            'payment_retry_days' => 7,
            'payment_retry_failed_action' => 'pause_subscription_and_notify',
            'check_inventory_before_orders' => true,
            'inventory_location_ids' => null,
            'inventory_place_partial_orders' => false,
            'inventory_check_build_a_box' => false,
            'inventory_retry_out_of_stock' => false,
            'first_order_tags' => 'Force Subscriptions First Order',
            'recurring_order_tags' => 'Force Subscriptions Recurring Order',
            'customer_active_subscription_tags' => 'force-has-active-subscription',
            'customer_paused_subscription_tags' => 'force-has-paused-subscription',
            'customer_cancelled_subscription_tags' => 'force-has-cancelled-subscription',
            'customer_payment_failure_tags' => 'force-has-payment-failure',
        ];
    }

    public function forCurrentShop(): ShopSetting
    {
        $shopId = $this->shopifyGraphqlService->shop()->id;

        return ShopSetting::query()->firstOrCreate(
            ['shop_id' => $shopId],
            $this->defaults()
        );
    }

    public function inventoryLocations(): array
    {
        return $this->inventoryLocationService->listLocations();
    }

    public function update(array $data): ShopSetting
    {
        $settings = $this->forCurrentShop();

        $settings->update([
            'upcoming_order_notification_days' => $data['upcomingOrderNotificationDays'],
            'billing_hour' => $data['billingHour'],
            'billing_minute' => $data['billingMinute'],
            'billing_timezone' => $data['billingTimezone'],
            'payment_retry_attempts' => $data['paymentRetryAttempts'],
            'payment_retry_days' => $data['paymentRetryDays'],
            'payment_retry_failed_action' => $data['paymentRetryFailedAction'],
            'check_inventory_before_orders' => $data['checkInventoryBeforeOrders'],
            'inventory_location_ids' => $this->encodeLocationIds($data['inventoryLocationIds'] ?? []),
            'inventory_place_partial_orders' => $data['inventoryPlacePartialOrders'],
            'inventory_check_build_a_box' => $data['inventoryCheckBuildABox'],
            'inventory_retry_out_of_stock' => $data['inventoryRetryOutOfStock'],
            'first_order_tags' => $this->encodeList($data['firstOrderTags'] ?? []),
            'recurring_order_tags' => $this->encodeList($data['recurringOrderTags'] ?? []),
            'customer_active_subscription_tags' => $this->encodeList($data['customerActiveSubscriptionTags'] ?? []),
            'customer_paused_subscription_tags' => $this->encodeList($data['customerPausedSubscriptionTags'] ?? []),
            'customer_cancelled_subscription_tags' => $this->encodeList($data['customerCancelledSubscriptionTags'] ?? []),
            'customer_payment_failure_tags' => $this->encodeList($data['customerPaymentFailureTags'] ?? []),
        ]);

        return $settings->fresh();
    }

    public function toPayload(ShopSetting $settings): array
    {
        $defaults = $this->defaults();

        return [
            'id' => $settings->id,
            'shopId' => $settings->shop_id,
            'upcomingOrderNotificationDays' => $settings->upcoming_order_notification_days
                ?? $defaults['upcoming_order_notification_days'],
            'billingHour' => $settings->billing_hour ?? $defaults['billing_hour'],
            'billingMinute' => $settings->billing_minute ?? $defaults['billing_minute'],
            'billingTimezone' => $settings->billing_timezone ?? $defaults['billing_timezone'],
            'paymentRetryAttempts' => $settings->payment_retry_attempts
                ?? $defaults['payment_retry_attempts'],
            'paymentRetryDays' => $settings->payment_retry_days ?? $defaults['payment_retry_days'],
            'paymentRetryFailedAction' => $settings->payment_retry_failed_action
                ?? $defaults['payment_retry_failed_action'],
            'checkInventoryBeforeOrders' => $settings->check_inventory_before_orders
                ?? $defaults['check_inventory_before_orders'],
            'inventoryLocationIds' => $this->decodeLocationIds($settings->inventory_location_ids),
            'inventoryPlacePartialOrders' => $settings->inventory_place_partial_orders
                ?? $defaults['inventory_place_partial_orders'],
            'inventoryCheckBuildABox' => $settings->inventory_check_build_a_box
                ?? $defaults['inventory_check_build_a_box'],
            'inventoryRetryOutOfStock' => $settings->inventory_retry_out_of_stock
                ?? $defaults['inventory_retry_out_of_stock'],
            'firstOrderTags' => $this->decodeList(
                $settings->first_order_tags ?? $defaults['first_order_tags']
            ),
            'recurringOrderTags' => $this->decodeList(
                $settings->recurring_order_tags ?? $defaults['recurring_order_tags']
            ),
            'customerActiveSubscriptionTags' => $this->decodeList(
                $settings->customer_active_subscription_tags
                    ?? $defaults['customer_active_subscription_tags']
            ),
            'customerPausedSubscriptionTags' => $this->decodeList(
                $settings->customer_paused_subscription_tags
                    ?? $defaults['customer_paused_subscription_tags']
            ),
            'customerCancelledSubscriptionTags' => $this->decodeList(
                $settings->customer_cancelled_subscription_tags
                    ?? $defaults['customer_cancelled_subscription_tags']
            ),
            'customerPaymentFailureTags' => $this->decodeList(
                $settings->customer_payment_failure_tags
                    ?? $defaults['customer_payment_failure_tags']
            ),
            'updatedAt' => $settings->updated_at?->toIso8601String(),
        ];
    }

    private function encodeList(array $values): ?string
    {
        $filtered = array_values(array_filter(array_map('trim', $values)));

        return $filtered === [] ? null : implode(',', $filtered);
    }

    private function decodeList(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }

    private function encodeLocationIds(array $locationIds): ?string
    {
        return $this->encodeList($locationIds);
    }

    private function decodeLocationIds(?string $value): array
    {
        return $this->decodeList($value);
    }
}
