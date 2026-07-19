<?php

namespace App\Console\Commands;

use App\Services\SubscriptionPaymentRecoveryService;
use Illuminate\Console\Command;

class RetryFailedSubscriptionPaymentsCommand extends Command
{
    protected $signature = 'subscriptions:retry-failed-payments';

    protected $description = 'Retry failed subscription payments using payment recovery settings';

    public function handle(SubscriptionPaymentRecoveryService $recoveryService): int
    {
        $stats = $recoveryService->processDueRetries();

        $this->info(sprintf(
            'Payment retry run complete — retried: %d, exhausted: %d, failed: %d, skipped: %d',
            $stats['retried'],
            $stats['exhausted'],
            $stats['failed'],
            $stats['skipped']
        ));

        return self::SUCCESS;
    }
}
