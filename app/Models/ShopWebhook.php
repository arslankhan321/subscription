<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopWebhook extends Model
{
    protected $fillable = [
        'shop_id',
        'shopify_webhook_id',
        'topic',
        'name',
        'address',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }
}
