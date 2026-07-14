<?php

namespace App\Services\Shopify;

use App\Models\SubscriptionPlan;

class ShopifySellingPlanService
{
    public function __construct(
        protected ShopifyGraphqlService $graphql,
        protected SellingPlanGroupPayloadBuilder $payloadBuilder
    ) {}

    public function getCurrentScopes(): array
    {
        return $this->graphql->getCurrentScopes();
    }

    public function listGroups(int $first = 50, ?string $after = null): array
    {
        $query = <<<'GQL'
        query getSellingPlanGroups($first: Int!, $after: String) {
            sellingPlanGroups(first: $first, after: $after) {
                edges {
                    node {
                        id
                        name
                        merchantCode
                        appId
                        sellingPlans(first: 20) {
                            edges {
                                node {
                                    id
                                    name
                                    position
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
        GQL;

        $data = $this->graphql->execute($query, [
            'first' => $first,
            'after' => $after,
        ]);

        return $data['sellingPlanGroups'] ?? [];
    }

    public function createGroupForPlan(SubscriptionPlan $plan, array $data): array
    {
        $mutation = <<<'GQL'
        mutation createSellingPlanGroup($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) {
            sellingPlanGroupCreate(input: $input, resources: $resources) {
                sellingPlanGroup {
                    id
                    merchantCode
                    sellingPlans(first: 50) {
                        edges {
                            node {
                                id
                                position
                                name
                            }
                        }
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $result = $this->graphql->mutation(
            'sellingPlanGroupCreate',
            $mutation,
            [
                'input' => $this->payloadBuilder->buildGroupInput($plan, $data),
                'resources' => $this->payloadBuilder->buildResources($data['products'] ?? []),
            ]
        );

        return $this->mapGroupResponse($result['sellingPlanGroup']);
    }

    public function replaceGroupForPlan(
        SubscriptionPlan $plan,
        array $data,
        ?string $groupId = null,
        array $sellingPlansToDelete = []
    ): array {
        if ($groupId) {
            return $this->updateGroupForPlan($plan, $data, $groupId, $sellingPlansToDelete);
        }

        return $this->createGroupForPlan($plan, $data);
    }

    public function updateGroupForPlan(
        SubscriptionPlan $plan,
        array $data,
        string $groupId,
        array $sellingPlansToDelete = []
    ): array {
        $mutation = <<<'GQL'
        mutation updateSellingPlanGroup($id: ID!, $input: SellingPlanGroupInput!) {
            sellingPlanGroupUpdate(id: $id, input: $input) {
                sellingPlanGroup {
                    id
                    merchantCode
                    sellingPlans(first: 50) {
                        edges {
                            node {
                                id
                                position
                                name
                            }
                        }
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $input = $this->payloadBuilder->buildUpdateInput($plan, $data);

        $deleteIds = collect($sellingPlansToDelete)
            ->filter()
            ->map(fn ($id) => $this->payloadBuilder->toSellingPlanGid($id))
            ->values()
            ->all();

        if (!empty($deleteIds)) {
            $input['sellingPlansToDelete'] = $deleteIds;
        }

        $result = $this->graphql->mutation(
            'sellingPlanGroupUpdate',
            $mutation,
            [
                'id' => $this->payloadBuilder->toSellingPlanGroupGid($groupId),
                'input' => $input,
            ]
        );

        $this->syncGroupProducts($groupId, $data['products'] ?? []);

        return $this->mapGroupResponse($this->normalizeNode($result['sellingPlanGroup']));
    }

    private function syncGroupProducts(string $groupId, array $products): void
    {
        $resources = $this->payloadBuilder->buildResources($products);
        $groupGid = $this->payloadBuilder->toSellingPlanGroupGid($groupId);

        if (!empty($resources['productIds'])) {
            $mutation = <<<'GQL'
            mutation addProducts($id: ID!, $productIds: [ID!]!) {
                sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
                    userErrors { field message }
                }
            }
            GQL;

            $this->graphql->mutation('sellingPlanGroupAddProducts', $mutation, [
                'id' => $groupGid,
                'productIds' => $resources['productIds'],
            ]);
        }

        if (!empty($resources['productVariantIds'])) {
            $mutation = <<<'GQL'
            mutation addVariants($id: ID!, $productVariantIds: [ID!]!) {
                sellingPlanGroupAddProductVariants(id: $id, productVariantIds: $productVariantIds) {
                    userErrors { field message }
                }
            }
            GQL;

            $this->graphql->mutation('sellingPlanGroupAddProductVariants', $mutation, [
                'id' => $groupGid,
                'productVariantIds' => $resources['productVariantIds'],
            ]);
        }
    }

    private function normalizeNode(mixed $node): array
    {
        if (is_array($node)) {
            return $node;
        }

        if (is_object($node) && method_exists($node, 'toArray')) {
            return $node->toArray();
        }

        return (array) $node;
    }

    public function deleteGroup(string|int $groupId): void
    {
        $mutation = <<<'GQL'
        mutation sellingPlanGroupDelete($id: ID!) {
            sellingPlanGroupDelete(id: $id) {
                deletedSellingPlanGroupId
                userErrors {
                    field
                    message
                }
            }
        }
        GQL;

        $this->graphql->mutation(
            'sellingPlanGroupDelete',
            $mutation,
            [
                'id' => $this->payloadBuilder->toSellingPlanGroupGid($groupId),
            ]
        );
    }

    /**
     * Stamp Liquid-filterable appId on this app's selling plan groups.
     * Prefers local DB group IDs, then paginates Admin API owned groups.
     */
    public function ensureOwnedGroupsHaveAppId(?int $shopId = null): int
    {
        $targetAppId = $this->payloadBuilder->appId();
        $updated = 0;
        $seen = [];

        $mutation = <<<'GQL'
        mutation stampSellingPlanGroupAppId($id: ID!, $input: SellingPlanGroupInput!) {
            sellingPlanGroupUpdate(id: $id, input: $input) {
                sellingPlanGroup { id appId }
                userErrors { field message }
            }
        }
        GQL;

        $stamp = function (string $groupId) use ($mutation, $targetAppId, &$updated, &$seen): void {
            $gid = $this->payloadBuilder->toSellingPlanGroupGid($groupId);
            if (isset($seen[$gid])) {
                return;
            }
            $seen[$gid] = true;

            try {
                $this->graphql->mutation('sellingPlanGroupUpdate', $mutation, [
                    'id' => $gid,
                    'input' => ['appId' => $targetAppId],
                ]);
                $updated++;
            } catch (\Throwable) {
                // Group may already be deleted in Shopify.
            }
        };

        $localQuery = \App\Models\SubscriptionPlan::query()
            ->whereNotNull('shopify_group_id')
            ->where('shopify_group_id', '!=', '');

        if ($shopId) {
            $localQuery->where('shop_id', $shopId);
        }

        foreach ($localQuery->pluck('shopify_group_id') as $groupId) {
            $stamp((string) $groupId);
        }

        $after = null;
        do {
            $page = $this->listGroups(50, $after);
            $edges = $page['edges'] ?? [];

            foreach ($edges as $edge) {
                $node = $edge['node'] ?? null;
                if (is_object($node) && method_exists($node, 'toArray')) {
                    $node = $node->toArray();
                }
                if (! is_array($node) || empty($node['id'])) {
                    continue;
                }

                if (($node['appId'] ?? null) === $targetAppId) {
                    $seen[$node['id']] = true;
                    continue;
                }

                $stamp((string) $node['id']);
            }

            $pageInfo = $page['pageInfo'] ?? [];
            $after = ! empty($pageInfo['hasNextPage']) ? ($pageInfo['endCursor'] ?? null) : null;
        } while ($after);

        return $updated;
    }

    private function mapGroupResponse(array $group): array
    {
        $planIdsByPosition = [];
        $edges = $group['sellingPlans']['edges'] ?? [];

        if (is_object($edges) && method_exists($edges, 'toArray')) {
            $edges = $edges->toArray();
        }

        foreach ($edges as $edge) {
            $node = $edge['node'] ?? null;

            if (is_object($node) && method_exists($node, 'toArray')) {
                $node = $node->toArray();
            }

            if (!$node) {
                continue;
            }

            $planIdsByPosition[(int) ($node['position'] ?? 0)] = $node['id'];
        }

        return [
            'groupId' => $group['id'],
            'merchantCode' => $group['merchantCode'] ?? null,
            'planIdsByPosition' => $planIdsByPosition,
        ];
    }
}
