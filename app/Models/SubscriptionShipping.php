<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionShipping extends Model
{
    protected $fillable = [
        'subscription_id',
        'delivery_method_type',
        'shipping_option_title',
        'first_name',
        'last_name',
        'company',
        'address1',
        'address2',
        'city',
        'province',
        'province_code',
        'country',
        'country_code',
        'zip',
        'phone',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
