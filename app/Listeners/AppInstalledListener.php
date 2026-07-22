<?php

namespace App\Listeners;

use App\Jobs\AppInstalledJob;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\Shopify\ShopWebhookRegistrationService;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Messaging\Events\AppInstalledEvent;

class AppInstalledListener
{
    public function __construct(
    protected ShopWebhookRegistrationService $webhookRegistrationService,
    ) {}

    public function handle(AppInstalledEvent $event): void
    {
        $shopId = $event->shopId->toNative();

        $shop = User::find($shopId);

        // $shop->installation_step = 0;
        // $shop->onboarding_step = 0;
        // $shop->onboarding_completed_at = null;

        $response = $shop->api()->graph('
            query {
                shop {
                    name
                    currencyCode
                    email
                    ianaTimezone
                    plan {
                        displayName
                    }
                    billingAddress {
                        phone
                    }
                    primaryDomain {
                        host
                        localization {
                            country
                            defaultLocale
                        }
                    }
                }
            }
        ');

        $shopData = $response['body']['data']['shop'];

        User::where('id', $shop->id)->update([
            'domain' => $shopData['primaryDomain']['host'],
            'country' => $shopData['primaryDomain']['localization']['country'],
            'currency' => $shopData['currencyCode'],
            'language' => $shopData['primaryDomain']['localization']['defaultLocale'],
            'store_name' => $shopData['name'],
            'store_email' => $shopData['email'],
            'plan_display_name' => $shopData['plan']['displayName'],
            'timezone' => $shopData['ianaTimezone'],
            'store_phone' => $shopData['billingAddress']['phone'] ?? null,
        ]);

        // AppInstalledJob::dispatch($shop->id);

        $hasExistingPlans = SubscriptionPlan::query()
            ->where('shop_id', $shop->id)
            ->exists();

        if ($hasExistingPlans) {
            try {
                $this->webhookRegistrationService->registerAfterFirstPlanCreated($shop);
            } catch (\Throwable $exception) {
                Log::error('Failed to register subscription webhooks after app install.', [
                    'shop_id' => $shop->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }
    }
}
