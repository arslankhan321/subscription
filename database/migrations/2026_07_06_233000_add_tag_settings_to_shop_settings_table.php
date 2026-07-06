<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->text('first_order_tags')->nullable()->after('inventory_retry_out_of_stock');
            $table->text('recurring_order_tags')->nullable()->after('first_order_tags');
            $table->text('customer_active_subscription_tags')->nullable()->after('recurring_order_tags');
            $table->text('customer_paused_subscription_tags')->nullable()->after('customer_active_subscription_tags');
            $table->text('customer_cancelled_subscription_tags')->nullable()->after('customer_paused_subscription_tags');
            $table->text('customer_payment_failure_tags')->nullable()->after('customer_cancelled_subscription_tags');
        });
    }

    public function down(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->dropColumn([
                'first_order_tags',
                'recurring_order_tags',
                'customer_active_subscription_tags',
                'customer_paused_subscription_tags',
                'customer_cancelled_subscription_tags',
                'customer_payment_failure_tags',
            ]);
        });
    }
};
