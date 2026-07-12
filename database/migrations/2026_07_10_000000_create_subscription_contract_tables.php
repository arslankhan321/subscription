<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Allow re-running if a previous attempt failed partway through.
        Schema::dropIfExists('subscription_recurring_orders');
        Schema::dropIfExists('subscription_shippings');
        Schema::dropIfExists('subscription_products');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('customers');

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('shopify_customer_id')->index();
            $table->string('shopify_gid')->nullable();
            $table->string('email')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();

            $table->unique(['shop_id', 'shopify_customer_id']);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->unsignedBigInteger('shopify_contract_id')->index();
            $table->string('shopify_gid')->nullable();
            $table->unsignedBigInteger('shopify_origin_order_id')->nullable()->index();
            $table->string('shopify_origin_order_gid')->nullable();
            $table->unsignedBigInteger('shopify_revision_id')->nullable();
            $table->string('status')->index();
            $table->string('currency_code', 3);
            $table->string('billing_interval')->nullable();
            $table->unsignedInteger('billing_interval_count')->nullable();
            $table->unsignedInteger('billing_min_cycles')->nullable();
            $table->unsignedInteger('billing_max_cycles')->nullable();
            $table->string('delivery_interval')->nullable();
            $table->unsignedInteger('delivery_interval_count')->nullable();
            $table->timestamp('next_billing_date')->nullable();
            $table->decimal('delivery_price', 12, 2)->nullable();
            $table->string('delivery_price_currency', 3)->nullable();
            $table->text('note')->nullable();
            $table->string('last_payment_status')->nullable();
            $table->string('last_billing_attempt_error_type')->nullable();
            $table->timestamp('shopify_created_at')->nullable();
            $table->timestamp('shopify_updated_at')->nullable();
            $table->timestamps();

            $table->unique(['shop_id', 'shopify_contract_id']);
        });

        Schema::create('subscription_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->string('shopify_line_id')->index();
            $table->unsignedBigInteger('shopify_product_id')->nullable()->index();
            $table->unsignedBigInteger('shopify_variant_id')->nullable()->index();
            $table->string('shopify_selling_plan_id')->nullable();
            $table->string('selling_plan_name')->nullable();
            $table->string('title');
            $table->string('variant_title')->nullable();
            $table->string('sku')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('current_price', 12, 2)->default(0);
            $table->string('currency_code', 3)->nullable();
            $table->text('image_url')->nullable();
            $table->boolean('requires_shipping')->default(true);
            $table->timestamps();

            $table->unique(['subscription_id', 'shopify_line_id']);
        });

        Schema::create('subscription_shippings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->string('delivery_method_type')->nullable();
            $table->string('shipping_option_title')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('company')->nullable();
            $table->string('address1')->nullable();
            $table->string('address2')->nullable();
            $table->string('city')->nullable();
            $table->string('province')->nullable();
            $table->string('province_code')->nullable();
            $table->string('country')->nullable();
            $table->string('country_code')->nullable();
            $table->string('zip')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();

            $table->unique('subscription_id');
        });

        Schema::create('subscription_recurring_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->unsignedBigInteger('shopify_order_id')->index();
            $table->string('shopify_gid')->nullable();
            $table->string('order_name')->nullable();
            $table->string('financial_status')->nullable();
            $table->string('fulfillment_status')->nullable();
            $table->decimal('total_price', 12, 2)->nullable();
            $table->string('currency_code', 3)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('shopify_created_at')->nullable();
            $table->timestamps();

            $table->unique(['subscription_id', 'shopify_order_id'], 'sub_recurring_orders_sub_order_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_recurring_orders');
        Schema::dropIfExists('subscription_shippings');
        Schema::dropIfExists('subscription_products');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('customers');
    }
};
