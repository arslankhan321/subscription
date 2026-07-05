<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionWidget extends Model
{
    protected $fillable = [
        'name',
        'template',
        'status',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];
}
