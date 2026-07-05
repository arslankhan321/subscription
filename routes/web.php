<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SubscriptionPlanController;

Route::get('/', function () {
    return view('welcome');
})->middleware(['verify.shopify', 'verify.shopify.scopes'])->name('home');
// Route::middleware(['verify.shopify'])->group(function () {

//     Route::Resource('plans', SubscriptionPlanController::class);
//     Route::get('/subscriptions', function () {
//         return view('welcome');
//     })->name('subscriptions');

//     Route::get('/bundles', function () {
//         return view('welcome');
//     })->name('bundles');

//     Route::get('/plans', function () {
//         return view('welcome');
//     })->name('plans');

//     Route::get('/analytics', function () {
//         return view('welcome');
//     })->name('analytics');
// });

Route::middleware(['verify.shopify', 'verify.shopify.scopes'])->group(function () {
    // React App
    Route::view('/plans', 'welcome')->name('plans');
    Route::view('/subscriptions', 'welcome')->name('subscriptions');
    Route::view('/bundles', 'welcome')->name('bundles');
    Route::view('/analytics', 'welcome')->name('analytics');

    Route::prefix('selling')->group(function () {
        Route::get('plans/scopes', [SubscriptionPlanController::class, 'shopifyScopes'])
            ->name('selling.plans.scopes');
        Route::get('plans/shopify', [SubscriptionPlanController::class, 'shopifyGroups'])
            ->name('selling.plans.shopify');
        Route::resource('plans', SubscriptionPlanController::class);
    });
});