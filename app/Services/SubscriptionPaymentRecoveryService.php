<?php

namespace App\Services;

use App\Mail\SubscriptionNotificationMail;
use App\Models\ShopSetting;
use App\Models\Subscription;
use App\Models\SubscriptionPaymentRecovery;
use App\Models\User;
use App\Services\Shopify\ShopifyGraphqlService;
use App\Services\Shopify\ShopifySubscriptionContractService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SubscriptionPaymentRecoveryService
{
    public function __construct(
        protected ShopSettingsService $shopSettingsService,
        protected SubscriptionBillingSchedulerService $billingSchedulerService,
        protected ShopifySubscriptionContractService $shopifySubscriptionContractService,
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected SubscriptionActivityLogService $activityLogService,
        protected SubscriptionContractSyncService $subscriptionContractSyncService,
        protected EmailTemplateService $emailTemplateService,
        protected EmailTemplateRenderer $emailTemplateRenderer
    ) {}

    /**
     * Handle a failed billing attempt (webhook or local detection).
     */
    public function handleFailure(
        User $shop,
        Subscription $subscription,
        int $cycleIndex,
        ?string $errorCode = null,
        ?string $errorMessage = null,
        ?string $attemptGid = null
    ): SubscriptionPaymentRecovery {
        $settings = $this->settingsForShop($shop);

        $subscription->forceFill([
            'last_payment_status' => 'FAILED',
            'last_billing_attempt_error_type' => $errorCode,
        ])->save();

        $recovery = SubscriptionPaymentRecovery::query()->firstOrNew([
            'subscription_id' => $subscription->id,
            'cycle_index' => $cycleIndex,
        ]);

        if (! $recovery->exists) {
            $recovery->shop_id = $shop->id;
            $recovery->retry_count = 0;
            $recovery->max_retries = (int) ($settings->payment_retry_attempts ?? 3);
            $recovery->retry_days = max(1, (int) ($settings->payment_retry_days ?? 7));
            $recovery->failed_action = $settings->payment_retry_failed_action
                ?? 'pause_subscription_and_notify';
        }

        $recovery->last_error_code = $errorCode;
        $recovery->last_error_message = $errorMessage;
        $recovery->last_attempt_gid = $attemptGid;
        $recovery->last_attempted_at = now();

        $shouldRetry = $this->isRetryableError($errorCode)
            && $recovery->hasRetriesRemaining()
            && (int) $recovery->max_retries > 0;

        if ($shouldRetry) {
            $recovery->status = SubscriptionPaymentRecovery::STATUS_AWAITING_RETRY;
            $recovery->next_retry_at = now()->addDays((int) $recovery->retry_days);
            $recovery->resolved_at = null;
            $recovery->save();

            $this->activityLogService->logSystem(
                $subscription,
                SubscriptionActivityLogService::ACTION_PAYMENT_FAILED,
                "Payment failed for cycle #{$cycleIndex}. Retry {$recovery->retry_count}/{$recovery->max_retries} scheduled.",
                [
                    'cycle_index' => $cycleIndex,
                    'error_code' => $errorCode,
                    'error_message' => $errorMessage,
                    'next_retry_at' => $recovery->next_retry_at?->toIso8601String(),
                ]
            );
        } else {
            $recovery->status = SubscriptionPaymentRecovery::STATUS_EXHAUSTED;
            $recovery->next_retry_at = null;
            $recovery->resolved_at = now();
            $recovery->save();

            $this->executeFailedAction($shop, $subscription, $recovery);
        }

        $this->applyPaymentFailureTags($shop, $subscription, $settings);
        $this->sendPaymentFailureEmail($shop, $subscription);

        return $recovery->fresh();
    }

    /**
     * Handle a successful billing attempt for a cycle under recovery.
     */
    public function handleSuccess(
        User $shop,
        Subscription $subscription,
        ?int $cycleIndex = null,
        ?string $attemptGid = null
    ): void {
        $subscription->forceFill([
            'last_payment_status' => 'SUCCEEDED',
            'last_billing_attempt_error_type' => null,
        ])->save();

        if ($cycleIndex !== null && $subscription->shopify_gid) {
            try {
                $nextDate = $this->shopifySubscriptionContractService->resolveNextBillingDateAfterCycle(
                    $shop,
                    $subscription->shopify_gid,
                    $cycleIndex
                );

                if ($nextDate) {
                    $subscription->forceFill([
                        'next_billing_date' => Carbon::parse($nextDate),
                    ])->save();
                }
            } catch (Throwable $exception) {
                Log::warning('Unable to sync next billing date after success webhook', [
                    'subscription_id' => $subscription->id,
                    'cycle_index' => $cycleIndex,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        $query = SubscriptionPaymentRecovery::query()
            ->where('subscription_id', $subscription->id)
            ->whereIn('status', [
                SubscriptionPaymentRecovery::STATUS_AWAITING_RETRY,
                SubscriptionPaymentRecovery::STATUS_PROCESSING,
                SubscriptionPaymentRecovery::STATUS_EXHAUSTED,
            ]);

        if ($cycleIndex !== null) {
            $query->where('cycle_index', $cycleIndex);
        }

        $recoveries = $query->get();

        foreach ($recoveries as $recovery) {
            $recovery->update([
                'status' => SubscriptionPaymentRecovery::STATUS_SUCCEEDED,
                'last_attempt_gid' => $attemptGid ?? $recovery->last_attempt_gid,
                'next_retry_at' => null,
                'resolved_at' => now(),
            ]);
        }

        if ($recoveries->isNotEmpty()) {
            $this->activityLogService->logSystem(
                $subscription,
                SubscriptionActivityLogService::ACTION_PAYMENT_RECOVERED,
                'Subscription payment recovered successfully.',
                [
                    'cycle_index' => $cycleIndex,
                    'attempt_gid' => $attemptGid,
                ]
            );
        }
    }

    /**
     * Retry due failed payments based on shop payment recovery settings.
     *
     * @return array{retried: int, exhausted: int, failed: int, skipped: int}
     */
    public function processDueRetries(): array
    {
        $stats = ['retried' => 0, 'exhausted' => 0, 'failed' => 0, 'skipped' => 0];

        $recoveries = SubscriptionPaymentRecovery::query()
            ->with(['subscription.products', 'shop.settings'])
            ->where('status', SubscriptionPaymentRecovery::STATUS_AWAITING_RETRY)
            ->whereNotNull('next_retry_at')
            ->where('next_retry_at', '<=', now())
            ->orderBy('next_retry_at')
            ->limit(100)
            ->get();

        foreach ($recoveries as $recovery) {
            $shop = $recovery->shop;
            $subscription = $recovery->subscription;

            if (! $shop || ! $subscription || ! $subscription->shopify_gid) {
                $stats['skipped']++;
                continue;
            }

            if (strtolower((string) $subscription->status) !== 'active') {
                $recovery->update([
                    'status' => SubscriptionPaymentRecovery::STATUS_CANCELLED,
                    'next_retry_at' => null,
                    'resolved_at' => now(),
                ]);
                $stats['skipped']++;
                continue;
            }

            if (! $recovery->hasRetriesRemaining()) {
                $recovery->update([
                    'status' => SubscriptionPaymentRecovery::STATUS_EXHAUSTED,
                    'next_retry_at' => null,
                    'resolved_at' => now(),
                ]);
                $this->executeFailedAction($shop, $subscription, $recovery);
                $stats['exhausted']++;
                continue;
            }

            $recovery->update([
                'status' => SubscriptionPaymentRecovery::STATUS_PROCESSING,
                'last_attempted_at' => now(),
            ]);

            try {
                $this->billingSchedulerService->chargeSubscriptionCycle(
                    $shop,
                    $subscription,
                    (int) $recovery->cycle_index,
                    'payment_retry'
                );

                $recovery->retry_count = (int) $recovery->retry_count + 1;
                $recovery->status = SubscriptionPaymentRecovery::STATUS_PROCESSING;
                $recovery->next_retry_at = null;
                $recovery->save();

                $this->activityLogService->logSystem(
                    $subscription,
                    SubscriptionActivityLogService::ACTION_PAYMENT_RETRY,
                    "Payment retry #{$recovery->retry_count} started for cycle #{$recovery->cycle_index}.",
                    [
                        'cycle_index' => $recovery->cycle_index,
                        'retry_count' => $recovery->retry_count,
                        'max_retries' => $recovery->max_retries,
                    ]
                );

                $stats['retried']++;
            } catch (Throwable $exception) {
                $stats['failed']++;

                Log::error('Payment retry charge failed', [
                    'recovery_id' => $recovery->id,
                    'subscription_id' => $subscription->id,
                    'message' => $exception->getMessage(),
                ]);

                $recovery->retry_count = (int) $recovery->retry_count + 1;
                $recovery->save();

                $this->handleFailure(
                    $shop,
                    $subscription,
                    (int) $recovery->cycle_index,
                    'PROCESSING_ERROR',
                    $exception->getMessage()
                );
            }
        }

        return $stats;
    }

    public function isRetryableError(?string $errorCode): bool
    {
        if ($errorCode === null || $errorCode === '') {
            return true;
        }

        $retryable = config('subscription_billing_attempt_error_codes.retryable', []);
        $blocked = config('subscription_billing_attempt_error_codes.blocked_but_recheckable', []);

        $code = strtoupper($errorCode);

        if (in_array($code, $retryable, true)) {
            return true;
        }

        // Allow recheckable codes to use the configured retry window.
        if (in_array($code, $blocked, true)) {
            return true;
        }

        // Unknown codes: retry per merchant settings rather than failing permanently.
        $known = config('subscription_billing_attempt_error_codes.all', []);

        return ! in_array($code, $known, true);
    }

    private function executeFailedAction(
        User $shop,
        Subscription $subscription,
        SubscriptionPaymentRecovery $recovery
    ): void {
        $action = $recovery->failed_action ?: 'pause_subscription_and_notify';

        $this->activityLogService->logSystem(
            $subscription,
            SubscriptionActivityLogService::ACTION_PAYMENT_EXHAUSTED,
            "All payment retries exhausted for cycle #{$recovery->cycle_index}. Action: {$action}.",
            [
                'cycle_index' => $recovery->cycle_index,
                'failed_action' => $action,
                'error_code' => $recovery->last_error_code,
            ]
        );

        Auth::login($shop);

        try {
            match ($action) {
                'cancel_subscription_and_notify' => $this->cancelSubscription($shop, $subscription),
                'skip_billing_and_notify_only' => $this->skipCycle($shop, $subscription, (int) $recovery->cycle_index),
                default => $this->pauseSubscription($shop, $subscription),
            };
        } catch (Throwable $exception) {
            Log::error('Failed to execute payment recovery action', [
                'subscription_id' => $subscription->id,
                'action' => $action,
                'message' => $exception->getMessage(),
            ]);
        } finally {
            Auth::logout();
        }
    }

    private function pauseSubscription(User $shop, Subscription $subscription): void
    {
        if (strtolower((string) $subscription->status) !== 'active') {
            return;
        }

        $this->shopifySubscriptionContractService->pauseContract($shop, $subscription->shopify_gid);
        $this->subscriptionContractSyncService->syncFromContractGid($shop, $subscription->shopify_gid);
    }

    private function cancelSubscription(User $shop, Subscription $subscription): void
    {
        if (strtolower((string) $subscription->status) === 'cancelled') {
            return;
        }

        $this->shopifySubscriptionContractService->cancelContract($shop, $subscription->shopify_gid);
        $this->subscriptionContractSyncService->syncFromContractGid($shop, $subscription->shopify_gid);
    }

    private function skipCycle(User $shop, Subscription $subscription, int $cycleIndex): void
    {
        $this->shopifySubscriptionContractService->skipCycle($shop, $subscription->shopify_gid, $cycleIndex);
    }

    private function applyPaymentFailureTags(User $shop, Subscription $subscription, ShopSetting $settings): void
    {
        $tags = $this->parseTags($settings->customer_payment_failure_tags ?? '');

        if ($tags === [] || ! $subscription->customer?->shopify_gid) {
            $subscription->loadMissing('customer');
        }

        $customerGid = $subscription->customer?->shopify_gid
            ?? ($subscription->customer?->shopify_customer_id
                ? 'gid://shopify/Customer/'.$subscription->customer->shopify_customer_id
                : null);

        if ($tags === [] || ! $customerGid) {
            return;
        }

        try {
            $mutation = <<<'GQL'
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
                tagsAdd(id: $id, tags: $tags) {
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL;

            $this->shopifyGraphqlService->mutationForShop($shop, 'tagsAdd', $mutation, [
                'id' => $customerGid,
                'tags' => $tags,
            ]);
        } catch (Throwable $exception) {
            Log::warning('Unable to apply payment failure tags', [
                'subscription_id' => $subscription->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    private function sendPaymentFailureEmail(User $shop, Subscription $subscription): void
    {
        try {
            Auth::login($shop);

            $template = $this->emailTemplateService->show('subscription_payment_failure');

            if (! ($template['enabled'] ?? true)) {
                return;
            }

            $subscription->loadMissing(['customer', 'products', 'shipping']);
            $customer = $subscription->customer;
            $email = $customer?->email;

            if (! $email) {
                return;
            }

            $html = $this->emailTemplateRenderer->render($template, [
                'first_name' => $customer->first_name ?? '',
                'last_name' => $customer->last_name ?? '',
                'merchant_support_email' => $shop->email ?? '',
                'next_order_date' => optional($subscription->next_billing_date)->toDayDateTimeString() ?? '',
                'payment_method' => 'On file',
                'manage_subscription_url' => '#',
                'line_items' => $subscription->products->map(fn ($product) => [
                    'title' => $product->title,
                    'quantity' => $product->quantity,
                    'price' => (string) $product->current_price,
                ])->all(),
                'delivery_address' => [
                    'name' => trim(($subscription->shipping->first_name ?? '').' '.($subscription->shipping->last_name ?? '')),
                    'address1' => $subscription->shipping->address1 ?? '',
                    'address2' => $subscription->shipping->address2 ?? '',
                ],
                'billing_address' => [
                    'name' => trim(($customer->first_name ?? '').' '.($customer->last_name ?? '')),
                    'address1' => $subscription->shipping->address1 ?? '',
                    'address2' => $subscription->shipping->address2 ?? '',
                ],
                'shipping_title' => $subscription->shipping->shipping_option_title ?? 'Shipping',
            ]);

            Mail::to($email)->send(new SubscriptionNotificationMail($template['subject'], $html));
        } catch (Throwable $exception) {
            Log::warning('Unable to send payment failure email', [
                'subscription_id' => $subscription->id,
                'message' => $exception->getMessage(),
            ]);
        } finally {
            Auth::logout();
        }
    }

    private function settingsForShop(User $shop): ShopSetting
    {
        $defaults = $this->shopSettingsService->defaults();

        return $shop->settings()->firstOrCreate(
            ['shop_id' => $shop->id],
            $defaults
        );
    }

    /**
     * @return list<string>
     */
    private function parseTags(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return collect(preg_split('/\s*,\s*/', $value) ?: [])
            ->map(fn ($tag) => trim((string) $tag))
            ->filter()
            ->values()
            ->all();
    }
}
