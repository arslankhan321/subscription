<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Repositories\Plans\SubscriptionPlanRepository;
use App\Repositories\Plans\SubscriptionPlanRepositoryInterface;


class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            SubscriptionPlanRepositoryInterface::class,
            SubscriptionPlanRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
