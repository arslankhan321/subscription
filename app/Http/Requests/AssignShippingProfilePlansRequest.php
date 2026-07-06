<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignShippingProfilePlansRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subscriptionPlanIds' => ['nullable', 'array'],
            'subscriptionPlanIds.*' => ['integer', 'min:1'],
        ];
    }
}
