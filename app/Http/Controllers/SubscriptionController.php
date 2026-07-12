<?php

namespace App\Http\Controllers;

use App\Exceptions\ShopifySellingPlanException;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(
        protected SubscriptionService $service
    ) {}

    public function index(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $this->service->stats(),
                'subscriptions' => $this->service->index($request->only(['search', 'status'])),
            ],
        ]);
    }

    public function show(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->show($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function billingCycles(int $id, Request $request)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->billingCycles($id, $request->only([
                    'page',
                    'per_page',
                    'after',
                ])),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function chargeCycle(int $id, int $cycleIndex)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Billing attempt created.',
                'data' => $this->service->chargeCycle($id, $cycleIndex),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function skipCycle(int $id, int $cycleIndex)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Billing cycle skipped.',
                'data' => $this->service->skipCycle($id, $cycleIndex),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function unskipCycle(int $id, int $cycleIndex)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Billing cycle unskipped.',
                'data' => $this->service->unskipCycle($id, $cycleIndex),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function rescheduleCycle(int $id, int $cycleIndex, Request $request)
    {
        $validated = $request->validate([
            'billing_date' => ['required', 'date'],
        ]);

        try {
            $billingDate = \Carbon\Carbon::parse($validated['billing_date'])
                ->utc()
                ->format('Y-m-d\TH:i:s\Z');

            return response()->json([
                'success' => true,
                'message' => 'Billing cycle rescheduled.',
                'data' => $this->service->rescheduleCycle($id, $cycleIndex, $billingDate),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    private function shopifyErrorResponse(ShopifySellingPlanException $exception)
    {
        return response()->json([
            'success' => false,
            'message' => $exception->getMessage(),
        ], 422);
    }
}
