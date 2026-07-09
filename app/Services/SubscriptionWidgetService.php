<?php

namespace App\Services;

use App\Models\SubscriptionWidget;

class SubscriptionWidgetService
{
    public function defaultSettings(): array
    {
        return [
            'preset' => 'lavender_classic',
            'colors' => [
                'primary' => '#7c3aed',
                'secondary' => '#f5f3ff',
                'text' => '#1f2937',
                'border' => '#d1d5db',
                'accent' => '#8b5cf6',
                'highlight' => '#111827',
                'background' => '#ffffff',
                'price' => '#111827',
                'badgePayg' => '#4f6df5',
                'badgePrepaid' => '#e8a317',
            ],
            'typography' => [
                'fontFamily' => 'Inter, sans-serif',
                'titleSize' => '12',
                'bodySize' => '14',
                'fontWeight' => '600',
            ],
            'border' => [
                'width' => '2',
                'radius' => '12',
                'style' => 'solid',
            ],
            'labels' => [
                'purchaseOptionsTitle' => 'Purchase options',
                'oneTimePurchase' => 'One time purchase',
                'subscribeAndSave' => 'Subscribe and save',
                'subscriptionDetails' => 'Subscription details',
                'perMonth' => 'per month',
                'deliverEvery' => 'Deliver every',
                'selectFrequency' => 'Select delivery frequency',
                'rewardsTitle' => 'Subscription rewards',
            ],
            'display' => [
                'showDiscount' => true,
                'showBadges' => false,
                'showPrices' => true,
                'currencySymbol' => 'Rs.',
            ],
            'features' => [
                'showBenefits' => true,
                'benefits' => [
                    'Lowest price option',
                    'Easily swap & skip deliveries',
                    'Cancel quickly anytime',
                ],
                'showCardBadge' => true,
                'cardBadgeText' => 'Most Popular',
                'showRewardsBanner' => false,
                'rewardsBannerText' => 'Subscribe today and unlock exclusive member rewards on every order.',
                'showSubscriptionDetails' => true,
            ],
        ];
    }

    public function index()
    {
        return SubscriptionWidget::query()->latest()->get();
    }

    public function active()
    {
        return SubscriptionWidget::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'template', 'settings']);
    }

    public function find(int $id): SubscriptionWidget
    {
        return SubscriptionWidget::query()->findOrFail($id);
    }

    public function findByName(string $name): ?SubscriptionWidget
    {
        return SubscriptionWidget::query()->where('name', $name)->first();
    }

    public function findActive(): ?SubscriptionWidget
    {
        return SubscriptionWidget::query()
            ->where('status', 'active')
            ->latest('updated_at')
            ->first();
    }

    public function create(array $data): SubscriptionWidget
    {
        if (($data['status'] ?? null) === 'active') {
            SubscriptionWidget::query()->where('status', 'active')->update(['status' => 'draft']);
        }

        return SubscriptionWidget::create([
            'name' => $data['name'],
            'template' => $data['template'],
            'status' => $data['status'] ?? 'draft',
            'settings' => $data['settings'] ?? $this->defaultSettings(),
        ]);
    }

    public function update(int $id, array $data): SubscriptionWidget
    {
        $widget = $this->find($id);

        if (($data['status'] ?? null) === 'active') {
            SubscriptionWidget::query()
                ->where('status', 'active')
                ->where('id', '!=', $id)
                ->update(['status' => 'draft']);
        }

        $widget->update([
            'name' => $data['name'] ?? $widget->name,
            'template' => $data['template'] ?? $widget->template,
            'status' => $data['status'] ?? $widget->status,
            'settings' => $data['settings'] ?? $widget->settings,
        ]);

        return $widget->fresh();
    }

    public function delete(int $id): void
    {
        $this->find($id)->delete();
    }

    public function storefrontPayload(SubscriptionWidget $widget): array
    {
        return [
            'id' => $widget->id,
            'name' => $widget->name,
            'template' => $widget->template,
            'settings' => array_replace_recursive($this->defaultSettings(), $widget->settings ?? []),
        ];
    }
}
