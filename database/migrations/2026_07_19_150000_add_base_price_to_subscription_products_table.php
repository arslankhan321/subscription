<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_products', function (Blueprint $table) {
            $table->decimal('base_price', 12, 2)->nullable()->after('current_price');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_products', function (Blueprint $table) {
            $table->dropColumn('base_price');
        });
    }
};
