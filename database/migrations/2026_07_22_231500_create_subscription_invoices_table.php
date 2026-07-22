<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->unsignedInteger('cycle_index');
            $table->timestamp('scheduled_at')->index();
            $table->unsignedInteger('interval_value');
            $table->string('interval_unit', 32);
            $table->string('payment_status', 32)->default('upcoming')->index();
            $table->json('line_item_properties')->nullable();
            $table->timestamps();

            $table->unique(['subscription_id', 'cycle_index'], 'sub_invoices_sub_cycle_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_invoices');
    }
};
