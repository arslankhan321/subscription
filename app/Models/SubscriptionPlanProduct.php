<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlanProduct extends Model
{
    protected $fillable = [
        'plan_id',
        'shopify_product_id',
        'shopify_variant_id',
        'title',
        'image',
    ];

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class);
    }
}
