<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingProfile extends Model
{
    protected $fillable = [
        'shop_id',
        'name',
        'shopify_delivery_profile_id',
        'location_ids',
        'subscription_plan_ids',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }
}
