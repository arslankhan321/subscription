<?php

namespace App\Console\Commands;

use App\Services\SubscriptionBillingSchedulerService;
use Illuminate\Console\Command;

class ProcessSubscriptionBillingCommand extends Command
{
    protected $signature = 'subscriptions:process-billing
                            {--shop= : Optional shop id to process}
                            {--force : Ignore billing hour/minute window}';

    protected $description = 'Charge due subscription billing cycles using each shop billing schedule settings';

    public function handle(SubscriptionBillingSchedulerService $scheduler): int
    {
        if ($shopId = $this->option('shop')) {
            $shop = \App\Models\User::query()->with('settings')->find($shopId);

            if (! $shop) {
                $this->error("Shop {$shopId} not found.");

                return self::FAILURE;
            }

            $settings = $shop->settings;

            if (! $this->option('force') && $settings && ! $scheduler->isWithinBillingWindow($settings)) {
                $this->info('Outside billing window for this shop. Use --force to override.');

                return self::SUCCESS;
            }

            $stats = $scheduler->processShop($shop, $settings);
            $this->info(sprintf(
                'Shop %d — charged: %d, skipped: %d, failed: %d',
                $shop->id,
                $stats['charged'],
                $stats['skipped'],
                $stats['failed']
            ));

            return self::SUCCESS;
        }

        $stats = $scheduler->processDueBilling();
        $this->info(sprintf(
            'Billing run complete — shops: %d, charged: %d, skipped: %d, failed: %d',
            $stats['shops'],
            $stats['charged'],
            $stats['skipped'],
            $stats['failed']
        ));

        return self::SUCCESS;
    }
}
