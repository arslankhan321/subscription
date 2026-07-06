<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopEmailTemplate extends Model
{
    protected $fillable = [
        'shop_id',
        'template_key',
        'enabled',
        'subject',
        'body_html',
        'settings',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'settings' => 'array',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }
}
