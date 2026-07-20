<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SubscriptionPlanController;
use App\Http\Controllers\SubscriptionWidgetController;
use App\Http\Controllers\EmailTemplateController;
use App\Http\Controllers\ShopSettingsController;
use App\Http\Controllers\ShippingProfileController;
use App\Http\Controllers\SubscriptionController;

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
    Route::view('/subscriptions/create', 'welcome')->name('subscriptions.create');
    Route::view('/subscriptions/{id}/edit', 'welcome')
        ->whereNumber('id')
        ->name('subscriptions.edit');
    Route::view('/subscriptions/{id}', 'welcome')
        ->whereNumber('id')
        ->name('subscriptions.show');
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

        Route::get('subscriptions', [SubscriptionController::class, 'index'])
            ->name('selling.subscriptions.index');
        Route::get('subscriptions/create-meta', [SubscriptionController::class, 'createMeta'])
            ->name('selling.subscriptions.create-meta');
        Route::post('subscriptions', [SubscriptionController::class, 'store'])
            ->name('selling.subscriptions.store');
        Route::get('subscriptions/customers/search', [SubscriptionController::class, 'searchCustomers'])
            ->name('selling.subscriptions.customers.search');
        Route::get('subscriptions/customers/payment-methods', [SubscriptionController::class, 'customerPaymentMethodsByCustomer'])
            ->name('selling.subscriptions.customers.payment-methods');
        Route::get('subscriptions/customers/addresses', [SubscriptionController::class, 'customerAddressesByCustomer'])
            ->name('selling.subscriptions.customers.addresses');
        Route::get('subscriptions/{id}', [SubscriptionController::class, 'show'])
            ->name('selling.subscriptions.show');
        Route::put('subscriptions/{id}', [SubscriptionController::class, 'update'])
            ->name('selling.subscriptions.update');
        Route::post('subscriptions/{id}', [SubscriptionController::class, 'update'])
            ->name('selling.subscriptions.update.post');
        Route::get('subscriptions/{id}/cycles', [SubscriptionController::class, 'billingCycles'])
            ->name('selling.subscriptions.cycles');
        Route::post('subscriptions/{id}/cycles/{cycleIndex}/charge', [SubscriptionController::class, 'chargeCycle'])
            ->name('selling.subscriptions.cycles.charge');
        Route::post('subscriptions/{id}/cycles/{cycleIndex}/skip', [SubscriptionController::class, 'skipCycle'])
            ->name('selling.subscriptions.cycles.skip');
        Route::post('subscriptions/{id}/cycles/{cycleIndex}/unskip', [SubscriptionController::class, 'unskipCycle'])
            ->name('selling.subscriptions.cycles.unskip');
        Route::post('subscriptions/{id}/cycles/{cycleIndex}/reschedule', [SubscriptionController::class, 'rescheduleCycle'])
            ->name('selling.subscriptions.cycles.reschedule');
        Route::get('subscriptions/{id}/fulfillments', [SubscriptionController::class, 'fulfillments'])
            ->name('selling.subscriptions.fulfillments');
        Route::post('subscriptions/{id}/fulfillments/reschedule', [SubscriptionController::class, 'rescheduleFulfillment'])
            ->name('selling.subscriptions.fulfillments.reschedule');
        Route::post('subscriptions/{id}/fulfillments/skip', [SubscriptionController::class, 'skipFulfillment'])
            ->name('selling.subscriptions.fulfillments.skip');
        Route::post('subscriptions/{id}/fulfillments/refund', [SubscriptionController::class, 'refundFulfillment'])
            ->name('selling.subscriptions.fulfillments.refund');
        Route::post('subscriptions/{id}/discounts', [SubscriptionController::class, 'addDiscount'])
            ->name('selling.subscriptions.discounts.store');
        Route::post('subscriptions/{id}/discounts/remove', [SubscriptionController::class, 'removeDiscount'])
            ->name('selling.subscriptions.discounts.remove');
        Route::get('subscriptions/{id}/payment-methods', [SubscriptionController::class, 'paymentMethods'])
            ->name('selling.subscriptions.payment-methods');
        Route::post('subscriptions/{id}/payment-methods/send-update', [SubscriptionController::class, 'sendPaymentMethodUpdate'])
            ->name('selling.subscriptions.payment-methods.send-update');
        Route::post('subscriptions/{id}/payment-methods/swap', [SubscriptionController::class, 'swapPaymentMethod'])
            ->name('selling.subscriptions.payment-methods.swap');
        Route::get('subscriptions/{id}/addresses', [SubscriptionController::class, 'customerAddresses'])
            ->name('selling.subscriptions.addresses');
        Route::post('subscriptions/{id}/shipping-address', [SubscriptionController::class, 'updateShippingAddress'])
            ->name('selling.subscriptions.shipping-address.update');
        Route::post('subscriptions/{id}/customer/sync', [SubscriptionController::class, 'syncCustomer'])
            ->name('selling.subscriptions.customer.sync');
        Route::post('subscriptions/{id}/pause', [SubscriptionController::class, 'pause'])
            ->name('selling.subscriptions.pause');
        Route::post('subscriptions/{id}/resume', [SubscriptionController::class, 'resume'])
            ->name('selling.subscriptions.resume');
        Route::post('subscriptions/{id}/cancel', [SubscriptionController::class, 'cancel'])
            ->name('selling.subscriptions.cancel');
    });
});

Route::get('storefront/widgets/active', [SubscriptionWidgetController::class, 'storefrontActive'])
    ->name('storefront.widgets.active');
Route::get('storefront/widget.css', [SubscriptionWidgetController::class, 'storefrontStyles'])
    ->name('storefront.widget.css');
Route::get('storefront/widgets/{name}', [SubscriptionWidgetController::class, 'storefront'])
    ->name('storefront.widgets.show');
Route::get('storefront/products/{productId}/plan', [SubscriptionWidgetController::class, 'storefrontProductPlan'])
    ->name('storefront.products.plan')
    ->where('productId', '[0-9]+');