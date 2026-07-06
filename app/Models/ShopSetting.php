<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopSetting extends Model
{
    protected $fillable = [
        'shop_id',
        'upcoming_order_notification_days',
        'billing_hour',
        'billing_minute',
        'billing_timezone',
        'payment_retry_attempts',
        'payment_retry_days',
        'payment_retry_failed_action',
        'check_inventory_before_orders',
        'inventory_location_ids',
        'inventory_place_partial_orders',
        'inventory_check_build_a_box',
        'inventory_retry_out_of_stock',
        'first_order_tags',
        'recurring_order_tags',
        'customer_active_subscription_tags',
        'customer_paused_subscription_tags',
        'customer_cancelled_subscription_tags',
        'customer_payment_failure_tags',
    ];

    protected $casts = [
        'upcoming_order_notification_days' => 'integer',
        'billing_hour' => 'integer',
        'billing_minute' => 'integer',
        'payment_retry_attempts' => 'integer',
        'payment_retry_days' => 'integer',
        'check_inventory_before_orders' => 'boolean',
        'inventory_place_partial_orders' => 'boolean',
        'inventory_check_build_a_box' => 'boolean',
        'inventory_retry_out_of_stock' => 'boolean',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }
}
