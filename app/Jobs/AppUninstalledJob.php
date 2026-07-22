<?php

namespace App\Jobs;

use App\Models\ShopWebhook;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Osiset\ShopifyApp\Actions\CancelCurrentPlan;
use Osiset\ShopifyApp\Contracts\Commands\Shop as IShopCommand;
use Osiset\ShopifyApp\Contracts\Queries\Shop as IShopQuery;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;

class AppUninstalledJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * The shop domain.
     *
     * @var ShopDomain|string
     */
    protected $domain;

    /**
     * Create a new job instance.
     *
     * @param  string  $domain  The shop domain.
     * @param  stdClass  $data  The webhook data (JSON decoded).
     * @return void
     */
    public function __construct(string $domain)
    {
        $this->domain = $domain;
    }

    /**
     * Execute the job.
     *
     * @param  IShopCommand  $shopCommand  The commands for shops.
     * @param  IShopQuery  $shopQuery  The querier for shops.
     * @param  CancelCurrentPlan  $cancelCurrentPlanAction  The action for cancelling the current plan.
     */
    public function handle(
        IShopCommand $shopCommand,
        IShopQuery $shopQuery,
        CancelCurrentPlan $cancelCurrentPlanAction
    ): bool {
        // return 200;
        // Convert the domain
        $this->domain = ShopDomain::fromNative($this->domain);

        // Get the shop
        $shop = $shopQuery->getByDomain($this->domain);
        if (! empty($shop)) {
            $shopId = $shop->getId();

            ShopWebhook::query()
                ->where('shop_id', $shopId->toNative())
                ->delete();

            // Purge shop of token, plan, etc.
            $shopCommand->clean($shopId);

            // Soft delete the shop.
            $shopCommand->softDelete($shopId);
        }

        return true;
    }
}
