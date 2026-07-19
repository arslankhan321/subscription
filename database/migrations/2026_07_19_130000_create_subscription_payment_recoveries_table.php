<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_payment_recoveries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id')->index();
            $table->unsignedBigInteger('subscription_id')->index();
            $table->unsignedInteger('cycle_index');
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->unsignedTinyInteger('max_retries')->default(3);
            $table->unsignedTinyInteger('retry_days')->default(7);
            $table->string('failed_action')->default('pause_subscription_and_notify');
            $table->string('status')->default('awaiting_retry')->index();
            $table->string('last_error_code')->nullable();
            $table->text('last_error_message')->nullable();
            $table->string('last_attempt_gid')->nullable();
            $table->timestamp('next_retry_at')->nullable()->index();
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(['subscription_id', 'cycle_index']);
            $table->foreign('shop_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('subscription_id')->references('id')->on('subscriptions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payment_recoveries');
    }
};
