<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\SubscriptionActivityLog;

class SubscriptionActivityLogService
{
    public const ACTION_CREATED = 'created';

    public const ACTION_PAUSED = 'paused';

    public const ACTION_RESUMED = 'resumed';

    public const ACTION_CANCELLED = 'cancelled';

    public const ACTION_UPDATED = 'updated';

    public const ACTION_CHARGED = 'charged';

    public const ACTION_SKIPPED = 'skipped';

    public const ACTION_UNSKIPPED = 'unskipped';

    public const ACTION_RESCHEDULED = 'rescheduled';

    public const ACTION_PAYMENT_FAILED = 'payment_failed';

    public const ACTION_PAYMENT_RETRY = 'payment_retry';

    public const ACTION_PAYMENT_RECOVERED = 'payment_recovered';

    public const ACTION_PAYMENT_EXHAUSTED = 'payment_exhausted';

    public function log(
        Subscription $subscription,
        string $action,
        string $message,
        string $actorType = 'merchant',
        ?string $actorLabel = null,
        array $meta = []
    ): SubscriptionActivityLog {
        return SubscriptionActivityLog::query()->create([
            'shop_id' => $subscription->shop_id,
            'subscription_id' => $subscription->id,
            'action' => $action,
            'message' => $message,
            'actor_type' => $actorType,
            'actor_label' => $actorLabel ?? ($actorType === 'merchant' ? 'Merchant' : 'System'),
            'meta' => $meta === [] ? null : $meta,
        ]);
    }

    public function logMerchant(Subscription $subscription, string $action, string $message, array $meta = []): SubscriptionActivityLog
    {
        return $this->log($subscription, $action, $message, 'merchant', 'Merchant', $meta);
    }

    public function logSystem(Subscription $subscription, string $action, string $message, array $meta = []): SubscriptionActivityLog
    {
        return $this->log($subscription, $action, $message, 'system', 'System', $meta);
    }

    /**
     * @return list<array{id: int, action: string, message: string, actor_type: string, actor_label: string|null, meta: array|null, created_at: string|null}>
     */
    public function forSubscription(Subscription $subscription, int $limit = 50): array
    {
        return SubscriptionActivityLog::query()
            ->where('subscription_id', $subscription->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (SubscriptionActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'message' => $log->message,
                'actor_type' => $log->actor_type,
                'actor_label' => $log->actor_label,
                'meta' => $log->meta,
                'created_at' => $log->created_at?->format('Y-m-d H:i'),
            ])
            ->values()
            ->all();
    }
}
