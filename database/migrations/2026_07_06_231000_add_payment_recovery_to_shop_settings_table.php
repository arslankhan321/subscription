<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('payment_retry_attempts')->default(3)->after('billing_timezone');
            $table->unsignedTinyInteger('payment_retry_days')->default(7)->after('payment_retry_attempts');
            $table->string('payment_retry_failed_action')->default('pause_subscription_and_notify')->after('payment_retry_days');
        });
    }

    public function down(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->dropColumn([
                'payment_retry_attempts',
                'payment_retry_days',
                'payment_retry_failed_action',
            ]);
        });
    }
};
