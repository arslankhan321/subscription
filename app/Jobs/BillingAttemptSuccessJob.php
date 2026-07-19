<?php

namespace App\Jobs;

use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionContractSyncService;
use App\Services\SubscriptionPaymentRecoveryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;
use Throwable;

class BillingAttemptSuccessJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $shopDomain;

    public $data;

    public function __construct($shopDomain, $data)
    {
        $this->shopDomain = $shopDomain;
        $this->data = $data;
    }

    public function handle(
        SubscriptionPaymentRecoveryService $recoveryService,
        SubscriptionContractSyncService $syncService
    ): void {
        $this->shopDomain = ShopDomain::fromNative($this->shopDomain);
        $shopDomain = $this->shopDomain->toNative();

        $shop = User::query()->where('name', $shopDomain)->first();

        if ($shop === null) {
            Log::warning('Billing attempt success webhook for unknown shop', [
                'shop_domain' => $shopDomain,
            ]);

            return;
        }

        $payload = $this->normalizePayload($this->data);
        $contractGid = $payload['contract_gid'];

        if (! $contractGid) {
            Log::warning('Billing attempt success webhook missing contract id', [
                'shop_domain' => $shopDomain,
            ]);

            return;
        }

        try {
            $subscription = Subscription::query()
                ->where('shop_id', $shop->id)
                ->where(function ($query) use ($contractGid, $payload) {
                    $query->where('shopify_gid', $contractGid);

                    if (! empty($payload['contract_legacy_id'])) {
                        $query->orWhere('shopify_contract_id', $payload['contract_legacy_id']);
                    }
                })
                ->first();

            if (! $subscription) {
                $subscription = $syncService->syncFromContractGid($shop, $contractGid);
            } else {
                $syncService->syncFromContractGid($shop, $contractGid);
                $subscription = $subscription->fresh();
            }

            if (! $subscription) {
                return;
            }

            $recoveryService->handleSuccess(
                $shop,
                $subscription,
                $payload['cycle_index'],
                $payload['attempt_gid']
            );
        } catch (Throwable $exception) {
            Log::error('BillingAttemptSuccessJob failed', [
                'shop_id' => $shop->id,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    /**
     * @return array{
     *   contract_gid: ?string,
     *   contract_legacy_id: ?string,
     *   attempt_gid: ?string,
     *   cycle_index: ?int
     * }
     */
    private function normalizePayload(mixed $data): array
    {
        $payload = json_decode(json_encode($data), true) ?: [];

        $contractGid = $payload['subscription_contract']['admin_graphql_api_id']
            ?? $payload['subscription_contract_id']
            ?? $payload['admin_graphql_api_subscription_contract_id']
            ?? null;

        $contractLegacyId = $payload['subscription_contract_id']
            ?? $payload['subscription_contract']['id']
            ?? null;

        if (is_numeric($contractGid)) {
            $contractLegacyId = (string) $contractGid;
            $contractGid = 'gid://shopify/SubscriptionContract/'.$contractGid;
        } elseif (is_string($contractGid) && ! str_starts_with($contractGid, 'gid://') && is_numeric($contractLegacyId)) {
            $contractGid = 'gid://shopify/SubscriptionContract/'.$contractLegacyId;
        }

        $attemptGid = $payload['admin_graphql_api_id']
            ?? $payload['id']
            ?? null;

        if (is_numeric($attemptGid)) {
            $attemptGid = 'gid://shopify/SubscriptionBillingAttempt/'.$attemptGid;
        }

        return [
            'contract_gid' => is_string($contractGid) ? $contractGid : null,
            'contract_legacy_id' => $contractLegacyId !== null ? (string) $contractLegacyId : null,
            'attempt_gid' => is_string($attemptGid) ? $attemptGid : null,
            'cycle_index' => isset($payload['billing_cycle_index'])
                ? (int) $payload['billing_cycle_index']
                : (isset($payload['cycle_index']) ? (int) $payload['cycle_index'] : null),
        ];
    }
}
