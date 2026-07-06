<?php

namespace App\Http\Controllers;

use App\Exceptions\ShopifySellingPlanException;
use App\Http\Requests\AssignShippingProfilePlansRequest;
use App\Http\Requests\StoreShippingProfileRequest;
use App\Services\ShippingProfileService;

class ShippingProfileController extends Controller
{
    public function __construct(
        protected ShippingProfileService $service
    ) {}

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->index(),
        ]);
    }

    public function store(StoreShippingProfileRequest $request)
    {
        try {
            $profile = $this->service->create($request->validated('name'));

            return response()->json([
                'success' => true,
                'message' => 'Shipping profile created successfully',
                'data' => $profile,
            ], 201);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function assignPlans(AssignShippingProfilePlansRequest $request, int $id)
    {
        try {
            $profile = $this->service->assignPlans($id, $request->validated('subscriptionPlanIds'));

            return response()->json([
                'success' => true,
                'message' => 'Plans assigned successfully',
                'data' => $profile,
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function destroy(int $id)
    {
        try {
            $this->service->destroy($id);

            return response()->json([
                'success' => true,
                'message' => 'Shipping profile deleted successfully',
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function shopifyShippingSettingsUrl()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'url' => $this->service->buildShopifyShippingSettingsUrl(),
            ],
        ]);
    }

    private function shopifyErrorResponse(ShopifySellingPlanException $exception)
    {
        $message = $exception->getMessage();

        if (str_contains($message, 'Access denied')) {
            $message = 'Shopify shipping scopes are missing. Add read_shipping and write_shipping in Partner Dashboard, update .env, then reinstall the app on your store.';
        }

        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $exception->userErrors,
            'help' => [
                'reinstall_url' => url('/authenticate').'?shop='.request()->get('shop'),
                'scopes_check_url' => url('/selling/plans/scopes'),
            ],
        ], 422);
    }
}
