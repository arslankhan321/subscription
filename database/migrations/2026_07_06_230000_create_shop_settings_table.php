<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->unique()->constrained('users')->cascadeOnDelete();

            $table->unsignedTinyInteger('upcoming_order_notification_days')->default(1);
            $table->unsignedTinyInteger('billing_hour')->default(10);
            $table->unsignedTinyInteger('billing_minute')->default(0);
            $table->string('billing_timezone')->default('America/New_York');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_settings');
    }
};
