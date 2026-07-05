<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSubscriptionWidgetRequest extends FormRequest
{
    private const TEMPLATES = [
        'purchase_classic',
        'two_cards_compact',
        'classic_dropdown',
        'split_benefits',
        // Legacy IDs kept for existing saved widgets
        'classic',
        'modern',
        'pill',
        'card',
        'minimal',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $widgetId = $this->route('widget');

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('subscription_widgets', 'name')->ignore($widgetId),
            ],
            'template' => ['required', Rule::in(self::TEMPLATES)],
            'status' => ['nullable', Rule::in(['draft', 'active'])],
            'settings' => ['nullable', 'array'],
            'settings.preset' => ['nullable', 'string', 'max:64'],
            'settings.colors' => ['nullable', 'array'],
            'settings.typography' => ['nullable', 'array'],
            'settings.border' => ['nullable', 'array'],
            'settings.labels' => ['nullable', 'array'],
            'settings.display' => ['nullable', 'array'],
            'settings.features' => ['nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Widget name is required.',
            'name.unique' => 'A widget with this name already exists.',
            'template.required' => 'Please select a widget design.',
        ];
    }
}
