<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_webhooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->string('shopify_webhook_id');
            $table->string('topic');
            $table->string('name');
            $table->string('address');
            $table->timestamps();

            $table->unique(['shop_id', 'topic']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_webhooks');
    }
};
