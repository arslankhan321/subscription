<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_invoices', function (Blueprint $table) {
            $table->string('shopify_draft_order_id')->nullable()->after('interval_unit');
            $table->text('invoice_url')->nullable()->after('shopify_draft_order_id');
            $table->timestamp('email_sent_at')->nullable()->after('payment_status');
            $table->timestamp('paid_at')->nullable()->after('email_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_invoices', function (Blueprint $table) {
            $table->dropColumn([
                'shopify_draft_order_id',
                'invoice_url',
                'email_sent_at',
                'paid_at',
            ]);
        });
    }
};
