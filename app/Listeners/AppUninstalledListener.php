<?php

namespace App\Listeners;

use App\Services\Shopify\ShopWebhookRegistrationService;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Messaging\Events\AppUninstalledEvent;

class AppUninstalledListener
{
    public function __construct(
        protected ShopWebhookRegistrationService $webhookRegistrationService,
    ) {}

    public function handle(AppUninstalledEvent $event): void
    {
        $shopId = $event->shopId->toNative();

        $this->webhookRegistrationService->clearLocalWebhooksForShop($shopId);

        Log::info('App uninstalled — local webhook records cleared.', [
            'shop_id' => $shopId,
        ]);
    }
}
