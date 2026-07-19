<?php

use App\Console\Commands\ProcessSubscriptionBillingCommand;
use App\Console\Commands\RetryFailedSubscriptionPaymentsCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(ProcessSubscriptionBillingCommand::class)
    ->everyMinute()
    ->withoutOverlapping(5)
    ->name('subscriptions-process-billing');

Schedule::command(RetryFailedSubscriptionPaymentsCommand::class)
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->name('subscriptions-retry-failed-payments');
