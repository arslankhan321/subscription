<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Subscription Plans
        |--------------------------------------------------------------------------
        */

        Schema::create('subscription_plans', function (Blueprint $table) {

            $table->id();

            // Shopify
            $table->string('shopify_group_id')->nullable()->index();

            // Basic
            $table->string('name');
            $table->string('widget')->nullable();

            // Status
            $table->enum('status', [
                'draft',
                'active',
                'archived'
            ])->default('draft');

            $table->boolean('published')->default(false);

            // Internal Reference
            $table->string('merchant_code')->nullable();

            $table->timestamps();
        });

        /*
        |--------------------------------------------------------------------------
        | Subscription Plan Products
        |--------------------------------------------------------------------------
        */

        Schema::create('subscription_plan_products', function (Blueprint $table) {

            $table->id();

            $table->foreignId('plan_id')
                ->constrained('subscription_plans')
                ->cascadeOnDelete();

            // Shopify
            $table->string('shopify_product_id')->index();
            $table->string('shopify_variant_id')->nullable()->index();

            // Display
            $table->string('title')->nullable();
            $table->text('image')->nullable();

            $table->timestamps();
        });

        /*
        |--------------------------------------------------------------------------
        | Subscription Plan Options
        |--------------------------------------------------------------------------
        */

        Schema::create('subscription_plan_options', function (Blueprint $table) {

            $table->id();

            // Shopify Selling Plan
            $table->string('shopify_plan_id')->nullable()->index();

            $table->foreignId('plan_id')
                ->constrained('subscription_plans')
                ->cascadeOnDelete();

            $table->unsignedInteger('position')->default(1);

            $table->string('name')->nullable();

            /*
            |--------------------------------------------------------------------------
            | Billing
            |--------------------------------------------------------------------------
            */

            $table->string('billing_type');

            $table->unsignedInteger('delivery_frequency')->default(1);

            $table->enum('delivery_interval', [
                'days',
                'weeks',
                'months',
                'years'
            ]);

            $table->unsignedInteger('billing_frequency')->nullable();

            $table->enum('billing_interval', [
                'days',
                'weeks',
                'months',
                'years'
            ])->nullable();

            /*
            |--------------------------------------------------------------------------
            | Order Limits
            |--------------------------------------------------------------------------
            */

            $table->string('min_orders')->nullable();

            $table->string('max_orders')->nullable();

            /*
            |--------------------------------------------------------------------------
            | Initial Discount
            |--------------------------------------------------------------------------
            */

            $table->boolean('give_discount')->default(false);

            $table->decimal('discount_amount',8,2)->default(0);

            $table->string('discount_type')->nullable();

            /*
            |--------------------------------------------------------------------------
            | Change Discount
            |--------------------------------------------------------------------------
            */

            $table->boolean('change_discount_after_orders')->default(false);

            $table->decimal('later_discount_amount',8,2)->default(0);

            $table->unsignedInteger('later_discount_after_orders')->nullable();

            $table->string('later_discount_type')->nullable();

            /*
            |--------------------------------------------------------------------------
            | Shipping Discount
            |--------------------------------------------------------------------------
            */

            $table->boolean('give_shipping_discount')->default(false);

            $table->decimal('shipping_discount_amount',8,2)->default(0);

            $table->unsignedInteger('shipping_discount_after_orders')->nullable();

            $table->string('shipping_discount_type')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plan_options');
        Schema::dropIfExists('subscription_plan_products');
        Schema::dropIfExists('subscription_plans');
    }
};