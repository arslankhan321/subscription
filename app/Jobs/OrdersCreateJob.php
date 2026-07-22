<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\SubscriptionContractSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use Throwable;

class OrdersCreateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /**
     * Shop's myshopify domain.
     *
     * @var ShopDomain|string
     */
    public $shopDomain;

    /**
     * The webhook data.
     *
     * @var object
     */
    public $data;

    public function __construct($shopDomain, $data)
    {
        $this->shopDomain = $shopDomain;
        $this->data = $data;
    }

    public function handle(SubscriptionContractSyncService $syncService): void
    {
        $this->shopDomain = ShopDomain::fromNative($this->shopDomain);
        $shopDomain = $this->shopDomain->toNative();

        $shop = User::query()->where('name', $shopDomain)->first();

        if ($shop === null) {
            Log::warning('Orders create webhook received for unknown shop', [
                'shop_domain' => $shopDomain,
            ]);

            return;
        }

        $payload = json_decode(json_encode($this->data), true) ?: [];

        try {
            $result = $syncService->syncRecurringOrderFromCreate($shop, $payload);

            if ($result['retry'] && $this->attempts() < $this->tries) {
                $this->release(30);

                return;
            }

            if ($result['recorded']) {
                Log::info('Recorded subscription order from ORDERS_CREATE', [
                    'shop_id' => $shop->id,
                    'order_id' => $payload['id'] ?? null,
                    'subscription_id' => $result['subscription_id'],
                    'plan_type' => $result['plan_type'] ?? null,
                ]);
            }
        } catch (Throwable $exception) {
            Log::error('OrdersCreateJob failed', [
                'shop_id' => $shop->id,
                'order_id' => $payload['id'] ?? null,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }
}
