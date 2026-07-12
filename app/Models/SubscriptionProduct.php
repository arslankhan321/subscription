<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionProduct extends Model
{
    protected $fillable = [
        'subscription_id',
        'shopify_line_id',
        'shopify_product_id',
        'shopify_variant_id',
        'shopify_selling_plan_id',
        'selling_plan_name',
        'title',
        'variant_title',
        'sku',
        'quantity',
        'current_price',
        'currency_code',
        'image_url',
        'requires_shipping',
    ];

    protected function casts(): array
    {
        return [
            'current_price' => 'decimal:2',
            'requires_shipping' => 'boolean',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
