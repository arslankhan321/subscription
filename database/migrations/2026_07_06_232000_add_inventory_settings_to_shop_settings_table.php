<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->boolean('check_inventory_before_orders')->default(true)->after('payment_retry_failed_action');
            $table->text('inventory_location_ids')->nullable()->after('check_inventory_before_orders');
            $table->boolean('inventory_place_partial_orders')->default(false)->after('inventory_location_ids');
            $table->boolean('inventory_check_build_a_box')->default(false)->after('inventory_place_partial_orders');
            $table->boolean('inventory_retry_out_of_stock')->default(false)->after('inventory_check_build_a_box');
        });
    }

    public function down(): void
    {
        Schema::table('shop_settings', function (Blueprint $table) {
            $table->dropColumn([
                'check_inventory_before_orders',
                'inventory_location_ids',
                'inventory_place_partial_orders',
                'inventory_check_build_a_box',
                'inventory_retry_out_of_stock',
            ]);
        });
    }
};
