<?php

namespace App\Exceptions;

use Exception;

class ShopifySellingPlanException extends Exception
{
    public function __construct(
        string $message,
        public readonly array $userErrors = []
    ) {
        parent::__construct($message);
    }
}
