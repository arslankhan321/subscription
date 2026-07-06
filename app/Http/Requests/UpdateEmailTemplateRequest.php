<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEmailTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'subject' => ['required', 'string', 'max:255'],
            'bodyHtml' => ['required', 'string'],
            'settings' => ['required', 'array'],
            'settings.showBtn' => ['sometimes', 'boolean'],
            'settings.btnText' => ['sometimes', 'string', 'max:120'],
            'settings.fullWidth' => ['sometimes', 'boolean'],
            'settings.showItems' => ['sometimes', 'boolean'],
            'settings.qtyTitle' => ['sometimes', 'string', 'max:120'],
            'settings.showAddresses' => ['sometimes', 'boolean'],
            'settings.shippingTitle' => ['sometimes', 'string', 'max:120'],
            'settings.billingTitle' => ['sometimes', 'string', 'max:120'],
            'settings.shippingText' => ['sometimes', 'string'],
            'settings.billingText' => ['sometimes', 'string'],
            'settings.showOrderDate' => ['sometimes', 'boolean'],
            'settings.orderDateTitle' => ['sometimes', 'string', 'max:120'],
            'settings.paymentTitle' => ['sometimes', 'string', 'max:120'],
            'settings.footerText' => ['sometimes', 'string'],
            'settings.days_before' => ['sometimes', 'integer', 'min:0', 'max:30'],
        ];
    }
}
