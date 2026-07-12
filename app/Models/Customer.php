<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'shop_id',
        'shopify_customer_id',
        'shopify_gid',
        'email',
        'first_name',
        'last_name',
        'phone',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
