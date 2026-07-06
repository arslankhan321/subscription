<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_email_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('users')->cascadeOnDelete();
            $table->string('template_key', 64);
            $table->boolean('enabled')->default(true);
            $table->string('subject')->nullable();
            $table->longText('body_html')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->unique(['shop_id', 'template_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_email_templates');
    }
};
