<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->string('action', 64);
            $table->string('message');
            $table->string('actor_type', 32)->default('merchant');
            $table->string('actor_label')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['subscription_id', 'created_at']);
            $table->index(['shop_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_activity_logs');
    }
};
