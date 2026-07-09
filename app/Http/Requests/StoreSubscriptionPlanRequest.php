<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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

            'name' => ['required', 'string', 'max:255'],
            'planType' => ['nullable', 'in:auto_charge,recurring_invoice'],

            'subscriptionEmailHour' => ['nullable', 'string', 'max:50'],
            'discountDescription' => [
                Rule::requiredIf(fn () => $this->input('planType') === 'recurring_invoice' && $this->boolean('deliveryOptions.0.giveDiscount')),
                'nullable',
                'string',
                'max:1000',
            ],

            'status' => ['nullable', 'in:draft,active,archived'],
            'published' => ['nullable', 'boolean'],
            'merchant_code' => ['nullable', 'string'],

            'products' => ['required', 'array', 'min:1'],
            'products.*.id' => ['required'],
            'products.*.variantId' => ['nullable'],
            'products.*.title' => ['nullable', 'string'],
            'products.*.image' => ['nullable', 'string'],

            'deliveryOptions' => ['required', 'array', 'min:1'],

            'deliveryOptions.*.name' => ['required', 'string', 'max:255'],
            'deliveryOptions.*.billingType' => ['required', 'string'],
            'deliveryOptions.*.deliveryFrequency' => ['required', 'integer', 'min:1'],
            'deliveryOptions.*.deliveryInterval' => ['required', Rule::in(['days', 'weeks', 'months', 'years'])],

            'deliveryOptions.*.billingFrequency' => ['nullable', 'integer', 'min:1'],
            'deliveryOptions.*.billingInterval' => ['nullable', Rule::in(['days', 'weeks', 'months', 'years'])],

            'deliveryOptions.*.minOrders' => ['nullable', 'string'],
            'deliveryOptions.*.maxOrders' => ['nullable', 'string'],

            'deliveryOptions.*.giveDiscount' => ['nullable', 'boolean'],
            'deliveryOptions.*.discountAmount' => ['nullable', 'numeric', 'min:0', 'max:100'],
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

    public function messages(): array
    {
        return [
            'name.required' => 'Plan name is required.',
            'products.required' => 'Select at least one product.',
            'products.min' => 'Select at least one product.',
            'deliveryOptions.required' => 'Add at least one delivery option or interval.',
            'deliveryOptions.min' => 'Add at least one delivery option or interval.',
            'deliveryOptions.*.deliveryFrequency.min' => 'Delivery frequency must be at least 1.',
            'deliveryOptions.*.name.required' => 'Option name is required.',
            'deliveryOptions.*.name.max' => 'Option name must be 255 characters or less.',
            'discountDescription.required' => 'Discount description is required when a discount is enabled.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $options = $this->input('deliveryOptions', []);

            if (! is_array($options)) {
                return;
            }

            $seenNames = [];

            foreach ($options as $index => $option) {
                $name = trim((string) ($option['name'] ?? ''));

                if ($name !== '') {
                    $normalized = strtolower($name);

                    if (isset($seenNames[$normalized])) {
                        $validator->errors()->add(
                            "deliveryOptions.$index.name",
                            'Each delivery option must have a unique name.'
                        );
                    } else {
                        $seenNames[$normalized] = $index;
                    }
                }
            }
        });
    }
}
