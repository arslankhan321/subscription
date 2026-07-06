<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateShopSettingsRequest;
use App\Services\ShopSettingsService;
use App\Exceptions\ShopifySellingPlanException;

class ShopSettingsController extends Controller
{
    public function __construct(
        protected ShopSettingsService $service
    ) {}

    public function show()
    {
        $settings = $this->service->forCurrentShop();

        return response()->json([
            'success' => true,
            'data' => $this->service->toPayload($settings),
        ]);
    }

    public function update(UpdateShopSettingsRequest $request)
    {
        $settings = $this->service->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Settings saved successfully',
            'data' => $this->service->toPayload($settings),
        ]);
    }

    public function inventoryLocations()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->inventoryLocations(),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }
}
