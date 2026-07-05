<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->enum('plan_type', ['auto_charge', 'recurring_invoice'])
                ->default('auto_charge')
                ->after('merchant_code');

            $table->string('subscription_email_hour')
                ->nullable()
                ->after('plan_type');

            $table->text('discount_description')
                ->nullable()
                ->after('subscription_email_hour');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn([
                'plan_type',
                'subscription_email_hour',
                'discount_description',
            ]);
        });
    }
};
