<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreSubscriptionPlanRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [

            'name' => ['required','string','max:255'],
            'planType' => ['nullable','in:auto_charge,recurring_invoice'],
            'widget' => ['nullable','string'],

            'subscriptionEmailHour' => ['nullable','string','max:50'],
            'discountDescription' => ['nullable','string','max:1000'],

            'status' => ['nullable','in:draft,active,archived'],
            'published' => ['nullable','boolean'],
            'merchant_code' => ['nullable','string'],

            'products' => ['required','array'],
            'products.*.id' => ['required'],
            'products.*.variantId' => ['nullable'],
            'products.*.title' => ['nullable'],
            'products.*.image' => ['nullable'],

            'deliveryOptions' => ['required','array'],

            'deliveryOptions.*.name' => ['nullable'],
            'deliveryOptions.*.billingType' => ['required', 'string'],
            'deliveryOptions.*.deliveryFrequency' => ['required'],
            'deliveryOptions.*.deliveryInterval' => ['required'],

            'deliveryOptions.*.billingFrequency' => ['nullable', 'integer', 'min:1'],
            'deliveryOptions.*.billingInterval' => ['nullable', 'in:days,weeks,months,years'],

            'deliveryOptions.*.minOrders' => ['nullable', 'string'],
            'deliveryOptions.*.maxOrders' => ['nullable', 'string'],

            'deliveryOptions.*.giveDiscount' => ['nullable', 'boolean'],
            'deliveryOptions.*.discountAmount' => ['nullable', 'numeric', 'min:0'],
            'deliveryOptions.*.discountType' => ['nullable', 'string'],

            'deliveryOptions.*.changeDiscountAfterOrders' => ['nullable', 'boolean'],
            'deliveryOptions.*.laterDiscountAmount' => ['nullable', 'numeric', 'min:0'],
            'deliveryOptions.*.laterDiscountAfterOrders' => ['nullable', 'integer', 'min:1'],
            'deliveryOptions.*.laterDiscountType' => ['nullable', 'string'],

            'deliveryOptions.*.giveShippingDiscount' => ['nullable', 'boolean'],
            'deliveryOptions.*.shippingDiscountAmount' => ['nullable', 'numeric', 'min:0'],
            'deliveryOptions.*.shippingDiscountAfterOrders' => ['nullable', 'integer', 'min:1'],
            'deliveryOptions.*.shippingDiscountType' => ['nullable', 'string'],
        ];
    }
}
