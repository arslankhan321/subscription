<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('shopify_delivery_profile_id')->nullable();
            $table->text('location_ids')->nullable();
            $table->text('subscription_plan_ids')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_profiles');
    }
};
