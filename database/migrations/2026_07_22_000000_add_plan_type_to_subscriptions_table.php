<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // shop_id FK currently rides the composite unique; add a dedicated index first.
            $table->index('shop_id', 'subscriptions_shop_id_index');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'shopify_contract_id']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_contract_id')->nullable()->change();

            $table->string('plan_type', 32)
                ->default('auto_charge')
                ->after('customer_id')
                ->index();

            $table->foreignId('subscription_plan_id')
                ->nullable()
                ->after('plan_type')
                ->constrained('subscription_plans')
                ->nullOnDelete();

            $table->unsignedBigInteger('subscription_plan_option_id')
                ->nullable()
                ->after('subscription_plan_id')
                ->index();

            $table->unique(['shop_id', 'shopify_contract_id']);
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'shopify_contract_id']);
            $table->dropConstrainedForeignId('subscription_plan_id');
            $table->dropColumn(['plan_type', 'subscription_plan_option_id']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_contract_id')->nullable(false)->change();
            $table->unique(['shop_id', 'shopify_contract_id']);
            $table->dropIndex('subscriptions_shop_id_index');
        });
    }
};
