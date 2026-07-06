<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShopSettingsRequest extends FormRequest
{
    private const PAYMENT_RETRY_FAILED_ACTIONS = [
        'cancel_subscription_and_notify',
        'pause_subscription_and_notify',
        'skip_billing_and_notify_only',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'upcomingOrderNotificationDays' => ['required', 'integer', 'min:0', 'max:30'],
            'billingHour' => ['required', 'integer', 'min:0', 'max:23'],
            'billingMinute' => ['required', 'integer', 'min:0', 'max:59'],
            'billingTimezone' => ['required', 'string', 'max:128'],
            'paymentRetryAttempts' => ['required', 'integer', 'min:0', 'max:10'],
            'paymentRetryDays' => ['required', 'integer', 'min:1', 'max:14'],
            'paymentRetryFailedAction' => [
                'required',
                'string',
                Rule::in(self::PAYMENT_RETRY_FAILED_ACTIONS),
            ],
            'checkInventoryBeforeOrders' => ['required', 'boolean'],
            'inventoryLocationIds' => ['nullable', 'array'],
            'inventoryLocationIds.*' => ['string', 'max:255'],
            'inventoryPlacePartialOrders' => ['required', 'boolean'],
            'inventoryCheckBuildABox' => ['required', 'boolean'],
            'inventoryRetryOutOfStock' => ['required', 'boolean'],
            'firstOrderTags' => ['nullable', 'array'],
            'firstOrderTags.*' => ['string', 'max:40'],
            'recurringOrderTags' => ['nullable', 'array'],
            'recurringOrderTags.*' => ['string', 'max:40'],
            'customerActiveSubscriptionTags' => ['nullable', 'array'],
            'customerActiveSubscriptionTags.*' => ['string', 'max:40'],
            'customerPausedSubscriptionTags' => ['nullable', 'array'],
            'customerPausedSubscriptionTags.*' => ['string', 'max:40'],
            'customerCancelledSubscriptionTags' => ['nullable', 'array'],
            'customerCancelledSubscriptionTags.*' => ['string', 'max:40'],
            'customerPaymentFailureTags' => ['nullable', 'array'],
            'customerPaymentFailureTags.*' => ['string', 'max:40'],
        ];
    }

    public function messages(): array
    {
        return [
            'upcomingOrderNotificationDays.required' => 'Days before renewal is required.',
            'upcomingOrderNotificationDays.min' => 'Days before renewal cannot be negative.',
            'upcomingOrderNotificationDays.max' => 'Days before renewal cannot exceed 30.',
            'billingHour.required' => 'Billing hour is required.',
            'billingMinute.required' => 'Billing minutes are required.',
            'billingTimezone.required' => 'Timezone is required.',
            'paymentRetryAttempts.min' => 'Retry attempts must be at least 0.',
            'paymentRetryAttempts.max' => 'Retry attempts cannot exceed 10.',
            'paymentRetryDays.min' => 'Days between retries must be at least 1.',
            'paymentRetryDays.max' => 'Days between retries cannot exceed 14.',
            'paymentRetryFailedAction.required' => 'Please select an action when retries fail.',
        ];
    }
}
