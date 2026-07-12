<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionRecurringOrder extends Model
{
    protected $fillable = [
        'subscription_id',
        'shopify_order_id',
        'shopify_gid',
        'order_name',
        'financial_status',
        'fulfillment_status',
        'total_price',
        'currency_code',
        'processed_at',
        'shopify_created_at',
    ];

    protected function casts(): array
    {
        return [
            'total_price' => 'decimal:2',
            'processed_at' => 'datetime',
            'shopify_created_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
