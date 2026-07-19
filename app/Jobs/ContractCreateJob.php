<?php namespace App\Jobs;

use App\Models\User;
use App\Services\SubscriptionContractSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;
use Throwable;

class ContractCreateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Shop's myshopify domain
     *
     * @var ShopDomain|string
     */
    public $shopDomain;

    /**
     * The webhook data
     *
     * @var object
     */
    public $data;

    /**
     * Create a new job instance.
     *
     * @param string   $shopDomain The shop's myshopify domain.
     * @param stdClass $data       The webhook data (JSON decoded).
     *
     * @return void
     */
    public function __construct($shopDomain, $data)
    {
        $this->shopDomain = $shopDomain;
        $this->data = $data;
    }

    /**
     * Execute the job.
     */
    public function handle(SubscriptionContractSyncService $syncService): void
    {
        $this->shopDomain = ShopDomain::fromNative($this->shopDomain);
        $shopDomain = $this->shopDomain->toNative();

        $shop = User::query()->where('name', $shopDomain)->first();

        if ($shop === null) {
            Log::warning('Subscription contract webhook received for unknown shop', [
                'shop_domain' => $shopDomain,
            ]);

            return;
        }

        try {
            $syncService->syncFromWebhook($shop, $this->data);
        } catch (Throwable $exception) {
            Log::error('Failed to sync subscription contract', [
                'shop_id' => $shop->id,
                'shop_domain' => $shopDomain,
                'contract_id' => $this->data->id ?? null,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }
}
