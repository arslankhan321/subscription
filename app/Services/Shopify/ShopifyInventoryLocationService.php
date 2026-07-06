<?php

namespace App\Services\Shopify;

class ShopifyInventoryLocationService
{
    public function __construct(
        protected ShopifyGraphqlService $graphql
    ) {}

    public function listLocations(int $first = 50): array
    {
        $data = $this->graphql->execute(<<<'GQL'
        query getInventoryLocations($first: Int!) {
            locations(first: $first, includeInactive: false) {
                edges {
                    node {
                        id
                        name
                        isActive
                    }
                }
            }
        }
        GQL, ['first' => $first]);

        $edges = $data['locations']['edges'] ?? [];

        return collect($edges)
            ->map(function (array $edge) {
                $node = $edge['node'] ?? null;

                if (!$node) {
                    return null;
                }

                return [
                    'id' => $node['id'],
                    'name' => $node['name'],
                    'isActive' => (bool) ($node['isActive'] ?? true),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
