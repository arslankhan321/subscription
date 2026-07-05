<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlanOption extends Model
{
    protected $fillable = [

        'shopify_plan_id',

        'plan_id',

        'position',

        'name',

        'billing_type',

        'delivery_frequency',

        'delivery_interval',

        'billing_frequency',

        'billing_interval',

        'min_orders',

        'max_orders',

        'give_discount',

        'discount_amount',

        'discount_type',

        'change_discount_after_orders',

        'later_discount_amount',

        'later_discount_after_orders',

        'later_discount_type',

        'give_shipping_discount',

        'shipping_discount_amount',

        'shipping_discount_after_orders',

        'shipping_discount_type',

    ];

}
