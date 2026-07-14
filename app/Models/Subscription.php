<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Subscription extends Model
{
    protected $fillable = [
        'shop_id',
        'customer_id',
        'shopify_contract_id',
        'shopify_gid',
        'shopify_origin_order_id',
        'shopify_origin_order_gid',
        'shopify_revision_id',
        'status',
        'currency_code',
        'billing_interval',
        'billing_interval_count',
        'billing_min_cycles',
        'billing_max_cycles',
        'delivery_interval',
        'delivery_interval_count',
        'next_billing_date',
        'delivery_price',
        'delivery_price_currency',
        'note',
        'last_payment_status',
        'last_billing_attempt_error_type',
        'shopify_created_at',
        'shopify_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'next_billing_date' => 'datetime',
            'shopify_created_at' => 'datetime',
            'shopify_updated_at' => 'datetime',
            'delivery_price' => 'decimal:2',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(SubscriptionProduct::class);
    }

    public function shipping(): HasOne
    {
        return $this->hasOne(SubscriptionShipping::class);
    }

    public function recurringOrders(): HasMany
    {
        return $this->hasMany(SubscriptionRecurringOrder::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(SubscriptionActivityLog::class);
    }
}
