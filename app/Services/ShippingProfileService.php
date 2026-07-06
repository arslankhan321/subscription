<?php

namespace App\Services;

use App\Models\ShippingProfile;
use App\Models\SubscriptionPlan;
use App\Services\Shopify\ShopifyDeliveryProfileService;
use App\Services\Shopify\ShopifyGraphqlService;

class ShippingProfileService
{
    public function __construct(
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected ShopifyDeliveryProfileService $shopifyDeliveryProfileService
    ) {}

    public function index(): array
    {
        return ShippingProfile::query()
            ->where('shop_id', $this->shopId())
            ->latest()
            ->get()
            ->map(fn (ShippingProfile $profile) => $this->toPayload($profile))
            ->all();
    }

    public function create(string $name): array
    {
        $shopifyProfile = $this->shopifyDeliveryProfileService->createProfile($name);

        $profile = ShippingProfile::query()->create([
            'shop_id' => $this->shopId(),
            'name' => $name,
            'shopify_delivery_profile_id' => $shopifyProfile['id'],
            'location_ids' => $this->encodeList($shopifyProfile['locationIds']),
            'subscription_plan_ids' => null,
        ]);

        return $this->toPayload($profile);
    }

    public function assignPlans(int $profileId, array $planIds): array
    {
        $profile = $this->findForShop($profileId);
        $normalizedPlanIds = $this->normalizePlanIds($planIds);
        $previousPlanIds = $this->decodeList($profile->subscription_plan_ids);

        $this->detachPlansFromOtherProfiles($profile, $normalizedPlanIds);
        $this->syncShopifyPlanAssociations($profile, $previousPlanIds, $normalizedPlanIds);

        $profile->update([
            'subscription_plan_ids' => $this->encodeList($normalizedPlanIds),
        ]);

        return $this->toPayload($profile->fresh());
    }

    public function destroy(int $profileId): void
    {
        $profile = $this->findForShop($profileId);

        if ($profile->shopify_delivery_profile_id) {
            $this->shopifyDeliveryProfileService->removeProfile($profile->shopify_delivery_profile_id);
        }

        $profile->delete();
    }

    public function toPayload(ShippingProfile $profile): array
    {
        $planIds = $this->decodeList($profile->subscription_plan_ids);

        return [
            'id' => $profile->id,
            'shopId' => $profile->shop_id,
            'name' => $profile->name,
            'shopifyDeliveryProfileId' => $profile->shopify_delivery_profile_id,
            'locationIds' => $this->decodeList($profile->location_ids),
            'subscriptionPlanIds' => array_map('intval', $planIds),
            'assignedPlansCount' => count($planIds),
            'shopifyEditUrl' => $this->buildShopifyEditUrl($profile->shopify_delivery_profile_id),
            'createdAt' => $profile->created_at?->toIso8601String(),
            'updatedAt' => $profile->updated_at?->toIso8601String(),
        ];
    }

    public function buildShopifyShippingSettingsUrl(): string
    {
        return $this->buildShopifyAdminUrl('/settings/shipping');
    }

    private function detachPlansFromOtherProfiles(ShippingProfile $profile, array $planIds): void
    {
        if ($planIds === []) {
            return;
        }

        $otherProfiles = ShippingProfile::query()
            ->where('shop_id', $profile->shop_id)
            ->where('id', '!=', $profile->id)
            ->get();

        foreach ($otherProfiles as $otherProfile) {
            $otherPlanIds = $this->decodeList($otherProfile->subscription_plan_ids);
            $remainingPlanIds = array_values(array_diff($otherPlanIds, array_map('strval', $planIds)));

            if (count($remainingPlanIds) === count($otherPlanIds)) {
                continue;
            }

            $removedPlanIds = array_values(array_diff($otherPlanIds, $remainingPlanIds));
            $this->dissociatePlansFromProfile($otherProfile, $removedPlanIds);

            $otherProfile->update([
                'subscription_plan_ids' => $this->encodeList($remainingPlanIds),
            ]);
        }
    }

    private function syncShopifyPlanAssociations(
        ShippingProfile $profile,
        array $previousPlanIds,
        array $nextPlanIds
    ): void {
        if (!$profile->shopify_delivery_profile_id) {
            return;
        }

        $previous = array_map('intval', $previousPlanIds);
        $next = array_map('intval', $nextPlanIds);

        $removedPlanIds = array_values(array_diff($previous, $next));
        $addedPlanIds = array_values(array_diff($next, $previous));

        $dissociate = $this->sellingPlanGroupIdsForPlans($removedPlanIds);
        $associate = $this->sellingPlanGroupIdsForPlans($addedPlanIds);

        $this->shopifyDeliveryProfileService->updateSellingPlanAssociations(
            $profile->shopify_delivery_profile_id,
            $associate,
            $dissociate
        );
    }

    private function dissociatePlansFromProfile(ShippingProfile $profile, array $planIds): void
    {
        if (!$profile->shopify_delivery_profile_id || $planIds === []) {
            return;
        }

        $dissociate = $this->sellingPlanGroupIdsForPlans(array_map('intval', $planIds));

        $this->shopifyDeliveryProfileService->updateSellingPlanAssociations(
            $profile->shopify_delivery_profile_id,
            [],
            $dissociate
        );
    }

    private function sellingPlanGroupIdsForPlans(array $planIds): array
    {
        if ($planIds === []) {
            return [];
        }

        return SubscriptionPlan::query()
            ->where('shop_id', $this->shopId())
            ->whereIn('id', $planIds)
            ->whereNotNull('shopify_group_id')
            ->pluck('shopify_group_id')
            ->filter()
            ->values()
            ->all();
    }

    private function findForShop(int $profileId): ShippingProfile
    {
        return ShippingProfile::query()
            ->where('shop_id', $this->shopId())
            ->findOrFail($profileId);
    }

    private function shopId(): int
    {
        return $this->shopifyGraphqlService->shop()->id;
    }

    private function normalizePlanIds(array $planIds): array
    {
        return collect($planIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function encodeList(array $values): ?string
    {
        $filtered = array_values(array_filter(array_map('strval', $values), fn ($value) => $value !== ''));

        return $filtered === [] ? null : implode(',', $filtered);
    }

    private function decodeList(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }

    private function buildShopifyEditUrl(?string $profileGid): ?string
    {
        if (!$profileGid) {
            return null;
        }

        if (!preg_match('/(\d+)$/', $profileGid, $matches)) {
            return null;
        }

        return $this->buildShopifyAdminUrl('/settings/shipping/profiles/'.$matches[1]);
    }

    private function buildShopifyAdminUrl(string $path): string
    {
        $shop = $this->shopifyGraphqlService->shop()->getDomain()->toNative();

        return 'https://'.$shop.'/admin'.$path;
    }
}
