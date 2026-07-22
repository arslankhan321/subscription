<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('domain')->nullable()->after('email');
            $table->string('country')->nullable()->after('domain');
            $table->string('currency', 10)->nullable()->after('country');
            $table->string('language', 20)->nullable()->after('currency');
            $table->string('store_name')->nullable()->after('language');
            $table->string('store_email')->nullable()->after('store_name');
            $table->string('plan_display_name')->nullable()->after('store_email');
            $table->string('timezone')->nullable()->after('plan_display_name');
            $table->string('store_phone')->nullable()->after('timezone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'domain',
                'country',
                'currency',
                'language',
                'store_name',
                'store_email',
                'plan_display_name',
                'timezone',
                'store_phone',
            ]);
        });
    }
};