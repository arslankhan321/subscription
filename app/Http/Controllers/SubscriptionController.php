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

    public function createMeta()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->createMeta(),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function searchCustomers(Request $request)
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:1', 'max:255'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->searchCustomers($validated['query']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function customerPaymentMethodsByCustomer(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->paymentMethodsForCustomer($validated['customer_id']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function customerAddressesByCustomer(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->addressesForCustomer($validated['customer_id']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
            'payment_method_id' => ['required', 'string'],
            'currency_code' => ['nullable', 'string', 'size:3'],
            'next_billing_date' => ['required', 'date'],
            'status' => ['nullable', 'string', 'in:ACTIVE,PAUSED,active,paused'],
            'billing_type' => ['required', 'string', 'in:Pay as you go,Prepaid'],
            'delivery_frequency' => ['required', 'integer', 'min:1'],
            'delivery_interval' => ['required', 'string', 'in:days,weeks,months,years,DAY,WEEK,MONTH,YEAR'],
            'billing_frequency' => ['nullable', 'integer', 'min:1'],
            'billing_interval' => ['nullable', 'string', 'in:days,weeks,months,years,DAY,WEEK,MONTH,YEAR'],
            'billing_min_cycles' => ['nullable', 'integer', 'min:1'],
            'billing_max_cycles' => ['nullable', 'integer', 'min:1'],
            'delivery_price' => ['nullable', 'numeric', 'min:0'],
            'delivery_method_title' => ['nullable', 'string', 'max:255'],
            'digital_product' => ['sometimes', 'boolean'],
            'shipping' => ['nullable', 'array'],
            'shipping.first_name' => ['nullable', 'string', 'max:255'],
            'shipping.last_name' => ['nullable', 'string', 'max:255'],
            'shipping.company' => ['nullable', 'string', 'max:255'],
            'shipping.address1' => ['nullable', 'string', 'max:255'],
            'shipping.address2' => ['nullable', 'string', 'max:255'],
            'shipping.city' => ['nullable', 'string', 'max:255'],
            'shipping.province' => ['nullable', 'string', 'max:255'],
            'shipping.province_code' => ['nullable', 'string', 'max:32'],
            'shipping.country' => ['nullable', 'string', 'max:255'],
            'shipping.country_code' => ['nullable', 'string', 'size:2'],
            'shipping.zip' => ['nullable', 'string', 'max:64'],
            'shipping.phone' => ['nullable', 'string', 'max:64'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'string'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.current_price' => ['required', 'numeric', 'min:0'],
            'lines.*.selling_plan_id' => ['nullable', 'string'],
            'lines.*.selling_plan_name' => ['nullable', 'string'],
        ]);

        $isDigital = (bool) ($validated['digital_product'] ?? false);

        if (! $isDigital) {
            $request->validate([
                'shipping.address1' => ['required', 'string', 'max:255'],
                'shipping.city' => ['required', 'string', 'max:255'],
                'shipping.country_code' => ['required', 'string', 'size:2'],
                'shipping.zip' => ['required', 'string', 'max:64'],
                'shipping.last_name' => ['required', 'string', 'max:255'],
            ]);
        }

        try {
            return response()->json([
                'success' => true,
                'message' => 'Subscription created.',
                'data' => $this->service->create($validated),
            ], 201);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
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

    public function fulfillments(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->fulfillments($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function rescheduleFulfillment(int $id, Request $request)
    {
        $validated = $request->validate([
            'fulfillment_order_id' => ['required', 'string'],
            'fulfill_at' => ['required', 'date'],
        ]);

        try {
            $fulfillAt = \Carbon\Carbon::parse($validated['fulfill_at'])
                ->utc()
                ->format('Y-m-d\TH:i:s\Z');

            return response()->json([
                'success' => true,
                'message' => 'Fulfillment rescheduled.',
                'data' => $this->service->rescheduleFulfillment(
                    $id,
                    $validated['fulfillment_order_id'],
                    $fulfillAt
                ),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function skipFulfillment(int $id, Request $request)
    {
        $validated = $request->validate([
            'fulfillment_order_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Fulfillment skipped.',
                'data' => $this->service->skipFulfillment($id, $validated['fulfillment_order_id']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function refundFulfillment(int $id, Request $request)
    {
        $validated = $request->validate([
            'fulfillment_order_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Fulfillment refunded.',
                'data' => $this->service->refundFulfillment($id, $validated['fulfillment_order_id']),
            ]);
        } catch (ShopifySellingPlanException|\RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function addDiscount(int $id, Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:percentage,fixed'],
            'amount' => ['required', 'numeric', 'min:0'],
            'applies_to_all' => ['sometimes', 'boolean'],
            'line_id' => ['nullable', 'string'],
            'limit_cycles' => ['sometimes', 'boolean'],
            'recurring_cycle_limit' => ['nullable', 'integer', 'min:1'],
        ]);

        if (($validated['type'] ?? '') === 'percentage' && (float) $validated['amount'] > 100) {
            return response()->json([
                'success' => false,
                'message' => 'Percentage discount cannot exceed 100.',
            ], 422);
        }

        if (! ($validated['applies_to_all'] ?? true) && empty($validated['line_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Select a line item for the discount.',
            ], 422);
        }

        try {
            return response()->json([
                'success' => true,
                'message' => 'Discount applied.',
                'data' => $this->service->addDiscount($id, $validated),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function removeDiscount(int $id, Request $request)
    {
        $validated = $request->validate([
            'discount_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Discount removed.',
                'data' => $this->service->removeDiscount($id, $validated['discount_id']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function paymentMethods(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->customerPaymentMethods($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function sendPaymentMethodUpdate(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Update card link emailed to the customer.',
                'data' => $this->service->sendPaymentMethodUpdateEmail($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function swapPaymentMethod(int $id, Request $request)
    {
        $validated = $request->validate([
            'payment_method_id' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Payment method updated.',
                'data' => $this->service->swapPaymentMethod($id, $validated['payment_method_id']),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function customerAddresses(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->customerAddresses($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function updateShippingAddress(int $id, Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'address1' => ['required', 'string', 'max:255'],
            'address2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
            'province_code' => ['nullable', 'string', 'max:32'],
            'country' => ['nullable', 'string', 'max:255'],
            'country_code' => ['required', 'string', 'size:2'],
            'zip' => ['required', 'string', 'max:64'],
            'phone' => ['nullable', 'string', 'max:64'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Shipping address updated.',
                'data' => $this->service->updateShippingAddress($id, $validated),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function syncCustomer(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Customer info synced.',
                'data' => $this->service->syncCustomer($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function pause(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Subscription paused.',
                'data' => $this->service->pause($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function resume(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Subscription resumed.',
                'data' => $this->service->resume($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function cancel(int $id)
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Subscription cancelled.',
                'data' => $this->service->cancel($id),
            ]);
        } catch (ShopifySellingPlanException $exception) {
            return $this->shopifyErrorResponse($exception);
        }
    }

    public function update(int $id, Request $request)
    {
        $validated = $request->validate([
            'billing_type' => ['required', 'string', 'in:Pay as you go,Prepaid'],
            'delivery_frequency' => ['required', 'integer', 'min:1'],
            'delivery_interval' => ['required', 'string', 'in:days,weeks,months,years,DAY,WEEK,MONTH,YEAR'],
            'billing_frequency' => ['nullable', 'integer', 'min:1'],
            'billing_interval' => ['nullable', 'string', 'in:days,weeks,months,years,DAY,WEEK,MONTH,YEAR'],
            'delivery_price' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.id' => ['nullable', 'string'],
            'lines.*.add' => ['sometimes', 'boolean'],
            'lines.*.product_variant_id' => ['nullable', 'string'],
            'lines.*.selling_plan_id' => ['nullable', 'string'],
            'lines.*.selling_plan_name' => ['nullable', 'string'],
            'lines.*.quantity' => ['nullable', 'integer', 'min:1'],
            'lines.*.current_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.remove' => ['sometimes', 'boolean'],
        ]);

        try {
            return response()->json([
                'success' => true,
                'message' => 'Subscription updated.',
                'data' => $this->service->update($id, $validated),
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
