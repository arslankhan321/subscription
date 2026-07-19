<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPaymentRecovery extends Model
{
    public const STATUS_AWAITING_RETRY = 'awaiting_retry';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_EXHAUSTED = 'exhausted';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'shop_id',
        'subscription_id',
        'cycle_index',
        'retry_count',
        'max_retries',
        'retry_days',
        'failed_action',
        'status',
        'last_error_code',
        'last_error_message',
        'last_attempt_gid',
        'next_retry_at',
        'last_attempted_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'cycle_index' => 'integer',
            'retry_count' => 'integer',
            'max_retries' => 'integer',
            'retry_days' => 'integer',
            'next_retry_at' => 'datetime',
            'last_attempted_at' => 'datetime',
            'resolved_at' => 'datetime',
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

    public function hasRetriesRemaining(): bool
    {
        return $this->retry_count < $this->max_retries;
    }
}
