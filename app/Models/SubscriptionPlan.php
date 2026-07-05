<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'shopify_group_id',
        'name',
        'widget',
        'status',
        'published',
        'merchant_code',
        'plan_type',
        'subscription_email_hour',
        'discount_description',
    ];

    public function products()
    {
        return $this->hasMany(SubscriptionPlanProduct::class,'plan_id');
    }

    public function options()
    {
        return $this->hasMany(SubscriptionPlanOption::class,'plan_id');
    }
}
