<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SubscriptionPlanController;
use App\Http\Controllers\SubscriptionWidgetController;
use App\Http\Controllers\EmailTemplateController;
use App\Http\Controllers\ShopSettingsController;
use App\Http\Controllers\ShippingProfileController;

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
    Route::view('/widgets', 'welcome')->name('widgets');
    Route::view('/settings', 'welcome')->name('settings');
    Route::view('/subscriptions', 'welcome')->name('subscriptions');
    Route::view('/bundles', 'welcome')->name('bundles');
    Route::view('/analytics', 'welcome')->name('analytics');

    Route::prefix('selling')->group(function () {
        Route::get('plans/scopes', [SubscriptionPlanController::class, 'shopifyScopes'])
            ->name('selling.plans.scopes');
        Route::get('plans/shopify', [SubscriptionPlanController::class, 'shopifyGroups'])
            ->name('selling.plans.shopify');
        Route::resource('plans', SubscriptionPlanController::class);
        Route::get('widgets/active', [SubscriptionWidgetController::class, 'active'])
            ->name('selling.widgets.active');
        Route::get('widgets/defaults', [SubscriptionWidgetController::class, 'defaults'])
            ->name('selling.widgets.defaults');
        Route::resource('widgets', SubscriptionWidgetController::class);

        Route::get('settings', [ShopSettingsController::class, 'show'])
            ->name('selling.settings.show');
        Route::get('settings/inventory-locations', [ShopSettingsController::class, 'inventoryLocations'])
            ->name('selling.settings.inventory-locations');
        Route::put('settings', [ShopSettingsController::class, 'update'])
            ->name('selling.settings.update');

        Route::get('shipping-profiles', [ShippingProfileController::class, 'index'])
            ->name('selling.shipping-profiles.index');
        Route::get('shipping-profiles/shopify-settings-url', [ShippingProfileController::class, 'shopifyShippingSettingsUrl'])
            ->name('selling.shipping-profiles.shopify-settings-url');
        Route::post('shipping-profiles', [ShippingProfileController::class, 'store'])
            ->name('selling.shipping-profiles.store');
        Route::put('shipping-profiles/{id}/plans', [ShippingProfileController::class, 'assignPlans'])
            ->name('selling.shipping-profiles.assign-plans');
        Route::delete('shipping-profiles/{id}', [ShippingProfileController::class, 'destroy'])
            ->name('selling.shipping-profiles.destroy');

        Route::get('email-templates', [EmailTemplateController::class, 'index'])
            ->name('selling.email-templates.index');
        Route::get('email-templates/{key}', [EmailTemplateController::class, 'show'])
            ->name('selling.email-templates.show');
        Route::put('email-templates/{key}', [EmailTemplateController::class, 'update'])
            ->name('selling.email-templates.update');
        Route::post('email-templates/{key}/toggle', [EmailTemplateController::class, 'toggle'])
            ->name('selling.email-templates.toggle');
        Route::post('email-templates/{key}/reset', [EmailTemplateController::class, 'reset'])
            ->name('selling.email-templates.reset');
        Route::post('email-templates/{key}/send-test', [EmailTemplateController::class, 'sendTest'])
            ->name('selling.email-templates.send-test');
    });
});

Route::get('storefront/widgets/active', [SubscriptionWidgetController::class, 'storefrontActive'])
    ->name('storefront.widgets.active');
Route::get('storefront/widget.css', [SubscriptionWidgetController::class, 'storefrontStyles'])
    ->name('storefront.widget.css');
Route::get('storefront/widgets/{name}', [SubscriptionWidgetController::class, 'storefront'])
    ->name('storefront.widgets.show');