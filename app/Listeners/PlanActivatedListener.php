<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Osiset\ShopifyApp\Messaging\Events\PlanActivatedEvent;

class PlanActivatedListener
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(PlanActivatedEvent $event): void
    {
        //
    }
}
