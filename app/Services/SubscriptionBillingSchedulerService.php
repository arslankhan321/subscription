<?php

namespace App\Services;

use App\Models\ShopSetting;
use App\Models\Subscription;
use App\Models\SubscriptionPaymentRecovery;
use App\Models\User;
use App\Services\Shopify\ShopifySubscriptionContractService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class SubscriptionBillingSchedulerService
{
    public function __construct(
        protected ShopifySubscriptionContractService $shopifySubscriptionContractService,
        protected SubscriptionService $subscriptionService,
        protected ShopSettingsService $shopSettingsService
    ) {}

    /**
     * Process scheduled billing for every shop whose billing window is active now.
     *
     * @return array{shops: int, charged: int, skipped: int, failed: int}
     */
    public function processDueBilling(): array
    {
        $stats = ['shops' => 0, 'charged' => 0, 'skipped' => 0, 'failed' => 0];

        $shops = User::query()
            ->whereHas('settings')
            ->with('settings')
            ->get();

        foreach ($shops as $shop) {
            $settings = $shop->settings;

            if (! $settings || ! $this->isWithinBillingWindow($settings)) {
                continue;
            }

            $lockKey = sprintf(
                'subscription-billing:%d:%s',
                $shop->id,
                now($settings->billing_timezone ?: 'UTC')->format('Y-m-d-H-i')
            );

            if (! Cache::add($lockKey, 1, 300)) {
                continue;
            }

            try {
                $stats['shops']++;
                $result = $this->processShop($shop, $settings);
                $stats['charged'] += $result['charged'];
                $stats['skipped'] += $result['skipped'];
                $stats['failed'] += $result['failed'];
            } finally {
                // keep lock until TTL so overlapping schedule runs skip this window
            }
        }

        return $stats;
    }

    /**
     * @return array{charged: int, skipped: int, failed: int}
     */
    public function processShop(User $shop, ?ShopSetting $settings = null): array
    {
        $settings ??= $shop->settings;
        $stats = ['charged' => 0, 'skipped' => 0, 'failed' => 0];

        if (! $settings) {
            return $stats;
        }

        $timezone = $settings->billing_timezone ?: 'UTC';
        $now = Carbon::now($timezone);

        $subscriptions = Subscription::query()
            ->where('shop_id', $shop->id)
            ->where('status', 'active')
            ->whereNotNull('shopify_gid')
            ->whereNotNull('next_billing_date')
            ->where('next_billing_date', '<=', $now->copy()->utc())
            ->where(function ($query) {
                $query->whereNull('last_payment_status')
                    ->orWhere('last_payment_status', '!=', 'FAILED');
            })
            ->with('products')
            ->orderBy('next_billing_date')
            ->limit(100)
            ->get();

        foreach ($subscriptions as $subscription) {
            if ($this->hasOpenRecovery($subscription)) {
                $stats['skipped']++;
                continue;
            }

            try {
                $cycleIndex = $this->resolveDueCycleIndex($shop, $subscription, $now);

                if ($cycleIndex === null) {
                    $stats['skipped']++;
                    continue;
                }

                $this->chargeSubscriptionCycle($shop, $subscription, $cycleIndex, 'scheduled');
                $stats['charged']++;
            } catch (Throwable $exception) {
                $stats['failed']++;

                Log::error('Scheduled subscription billing failed', [
                    'shop_id' => $shop->id,
                    'subscription_id' => $subscription->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return $stats;
    }

    public function chargeSubscriptionCycle(
        User $shop,
        Subscription $subscription,
        int $cycleIndex,
        string $source = 'scheduled'
    ): array {
        Auth::login($shop);

        try {
            return $this->subscriptionService->chargeCycle($subscription->id, $cycleIndex, true);
        } finally {
            Auth::logout();
        }
    }

    public function isWithinBillingWindow(ShopSetting $settings, ?Carbon $now = null): bool
    {
        $timezone = $settings->billing_timezone ?: 'UTC';

        try {
            $now ??= Carbon::now($timezone);
        } catch (Throwable) {
            $now = Carbon::now('UTC');
        }

        return (int) $now->hour === (int) ($settings->billing_hour ?? 10)
            && (int) $now->minute === (int) ($settings->billing_minute ?? 0);
    }

    private function hasOpenRecovery(Subscription $subscription): bool
    {
        return SubscriptionPaymentRecovery::query()
            ->where('subscription_id', $subscription->id)
            ->whereIn('status', [
                SubscriptionPaymentRecovery::STATUS_AWAITING_RETRY,
                SubscriptionPaymentRecovery::STATUS_PROCESSING,
            ])
            ->exists();
    }

    private function resolveDueCycleIndex(User $shop, Subscription $subscription, Carbon $now): ?int
    {
        $page = 1;

        while ($page <= 5) {
            $result = $this->shopifySubscriptionContractService->fetchBillingCycles(
                $shop,
                $subscription->shopify_gid,
                $page,
                10
            );

            foreach ($result['cycles'] as $cycle) {
                if (! $this->isChargeableCycle($cycle, $now)) {
                    continue;
                }

                return (int) $cycle['cycle_index'];
            }

            if (! ($result['page_info']['has_next_page'] ?? false)) {
                break;
            }

            $page++;
        }

        return null;
    }

    private function isChargeableCycle(array $cycle, Carbon $now): bool
    {
        if (! empty($cycle['skipped'])) {
            return false;
        }

        $status = strtoupper((string) ($cycle['status'] ?? ''));
        if ($status === 'BILLED') {
            return false;
        }

        if (! empty($cycle['billing_attempt']['order_name'])) {
            return false;
        }

        $expected = $cycle['billing_attempt_expected_date'] ?? null;
        if (! $expected) {
            return false;
        }

        try {
            return Carbon::parse($expected)->lte($now->copy()->utc()->endOfDay());
        } catch (Throwable) {
            return false;
        }
    }
}
