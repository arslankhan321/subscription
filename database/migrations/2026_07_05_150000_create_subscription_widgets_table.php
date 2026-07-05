<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_widgets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('template')->default('classic');
            $table->enum('status', ['draft', 'active'])->default('draft');
            $table->json('settings')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_widgets');
    }
};
