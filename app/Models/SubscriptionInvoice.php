<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionInvoice extends Model
{
    public const STATUS_UPCOMING = 'upcoming';

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'shop_id',
        'subscription_id',
        'cycle_index',
        'scheduled_at',
        'interval_value',
        'interval_unit',
        'shopify_draft_order_id',
        'invoice_url',
        'payment_status',
        'email_sent_at',
        'paid_at',
        'line_item_properties',
    ];

    protected function casts(): array
    {
        return [
            'cycle_index' => 'integer',
            'interval_value' => 'integer',
            'scheduled_at' => 'datetime',
            'email_sent_at' => 'datetime',
            'paid_at' => 'datetime',
            'line_item_properties' => 'array',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
