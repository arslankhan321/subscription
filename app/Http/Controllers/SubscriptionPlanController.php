<?php

namespace App\Http\Controllers;

use App\Exceptions\ShopifySellingPlanException;
use App\Services\SubscriptionPlanService;
use App\Http\Requests\StoreSubscriptionPlanRequest;

class SubscriptionPlanController extends Controller
{
    public function __construct(
        protected SubscriptionPlanService $service
    ) {}

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->index(),
        ]);
    }

    public function shopifyGroups()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->listShopifyGroups(),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function shopifyScopes()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->getShopifyScopeStatus(),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function store(StoreSubscriptionPlanRequest $request)
    {
        try {
            $plan = $this->service->create($request->validated());

            return response()->json([
                'success' => true,
                'message' => $plan->shopify_group_id
                    ? 'Plan created and synced to Shopify successfully'
                    : 'Plan saved as draft successfully',
                'data' => $plan,
            ], 201);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function show($id)
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->show($id),
        ]);
    }

    public function update(StoreSubscriptionPlanRequest $request, $id)
    {
        try {
            $plan = $this->service->update($id, $request->validated());

            return response()->json([
                'success' => true,
                'message' => $plan->shopify_group_id
                    ? 'Plan updated and synced to Shopify successfully'
                    : 'Plan updated successfully',
                'data' => $plan,
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function destroy($id)
    {
        try {
            $this->service->destroy($id);

            return response()->json([
                'success' => true,
                'message' => 'Plan deleted successfully',
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    private function shopifyErrorResponse(ShopifySellingPlanException $exception)
    {
        $message = $exception->getMessage();

        if (str_contains($message, 'Non-expiring access tokens are no longer accepted')) {
            $message = 'Shopify access token is outdated. Uninstall the app from your store, then reinstall it to continue.';
        }

        if (str_contains($message, 'Access denied for sellingPlanGroupCreate')) {
            $message = 'Shopify subscription scopes are missing. Add read_own_subscription_contracts, write_own_subscription_contracts, and write_purchase_options in Partner Dashboard, update .env, then reinstall the app on your store.';
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
