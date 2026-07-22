<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Osiset\ShopifyApp\Messaging\Events\ShopAuthenticatedEvent;

class ShopAuthenticatedListener
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
    public function handle(ShopAuthenticatedEvent $event): void
    {
        //
    }
}
