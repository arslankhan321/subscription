<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'shop_id',
        'shopify_group_id',
        'name',
        'status',
        'published',
        'merchant_code',
        'plan_type',
        'subscription_email_hour',
        'discount_description',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function products()
    {
        return $this->hasMany(SubscriptionPlanProduct::class,'plan_id');
    }

    public function options()
    {
        return $this->hasMany(SubscriptionPlanOption::class,'plan_id');
    }
}
