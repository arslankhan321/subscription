<?php

namespace App\Services\Shopify;

use App\Exceptions\ShopifySellingPlanException;

class ShopifyDeliveryProfileService
{
    public function __construct(
        protected ShopifyGraphqlService $graphql,
        protected ShopifyInventoryLocationService $inventoryLocationService
    ) {}

    public function createProfile(string $name): array
    {
        $shopData = $this->graphql->execute(<<<'GQL'
        {
            shop {
                currencyCode
                billingAddress {
                    countryCodeV2
                }
            }
        }
        GQL);

        $country = $shopData['shop']['billingAddress']['countryCodeV2'] ?? 'US';
        $currency = $shopData['shop']['currencyCode'] ?? 'USD';
        $locations = $this->inventoryLocationService->listLocations();
        $locationIds = array_column($locations, 'id');

        if ($locationIds === []) {
            throw new ShopifySellingPlanException(
                'No active inventory locations found in your Shopify store.'
            );
        }

        $result = $this->graphql->mutation('deliveryProfileCreate', <<<'GQL'
        mutation deliveryProfileCreate($profile: DeliveryProfileInput!) {
            deliveryProfileCreate(profile: $profile) {
                profile {
                    id
                    name
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL, [
            'profile' => [
                'name' => $name,
                'locationGroupsToCreate' => [
                    [
                        'locationsToAdd' => $locationIds,
                        'zonesToCreate' => [
                            [
                                'name' => 'Default zone',
                                'countries' => [
                                    [
                                        'code' => $country,
                                        'includeAllProvinces' => true,
                                    ],
                                ],
                                'methodDefinitionsToCreate' => [
                                    [
                                        'name' => 'Standard',
                                        'rateDefinition' => [
                                            'price' => [
                                                'amount' => 0,
                                                'currencyCode' => $currency,
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $profile = $result['profile'] ?? null;

        if (!$profile) {
            throw new ShopifySellingPlanException('Shopify did not return the created delivery profile.');
        }

        return [
            'id' => $profile['id'],
            'name' => $profile['name'],
            'locationIds' => $locationIds,
        ];
    }

    public function removeProfile(string $profileGid): void
    {
        $this->graphql->mutation('deliveryProfileRemove', <<<'GQL'
        mutation deliveryProfileRemove($id: ID!) {
            deliveryProfileRemove(id: $id) {
                userErrors {
                    field
                    message
                }
            }
        }
        GQL, ['id' => $profileGid]);
    }

    public function updateSellingPlanAssociations(
        string $profileGid,
        array $associate = [],
        array $dissociate = []
    ): void {
        $profileInput = [];

        if ($associate !== []) {
            $profileInput['sellingPlanGroupsToAssociate'] = array_values($associate);
        }

        if ($dissociate !== []) {
            $profileInput['sellingPlanGroupsToDissociate'] = array_values($dissociate);
        }

        if ($profileInput === []) {
            return;
        }

        $this->graphql->mutation('deliveryProfileUpdate', <<<'GQL'
        mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
            deliveryProfileUpdate(id: $id, profile: $profile) {
                profile {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL, [
            'id' => $profileGid,
            'profile' => $profileInput,
        ]);
    }
}
