<?php

namespace App\Services\Shopify;

use App\Models\ShopWebhook;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class ShopWebhookRegistrationService
{
    /**
     * @return array<int, array{topic: string, name: string, address: string}>
     */
    public function getWebhookDefinitions(): array
    {
        return config('shopify-subscription-webhooks.webhooks', []);
    }

    public function shopHasRegisteredWebhooks(int $shopId): bool
    {
        $expectedTopics = collect($this->getWebhookDefinitions())->pluck('topic');

        if ($expectedTopics->isEmpty()) {
            return true;
        }

        $registeredTopics = ShopWebhook::query()
            ->where('shop_id', $shopId)
            ->pluck('topic');

        return $expectedTopics->diff($registeredTopics)->isEmpty();
    }

    /**
     * @return array{registered: int, skipped: int, failed: int}
     */
    public function registerSubscriptionWebhooks(User $shop): array
    {
        $summary = [
            'registered' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];

        $shopifyWebhooks = $this->fetchShopifyWebhooks($shop);
        $shopifyWebhooksByTopic = $shopifyWebhooks->keyBy('topic');

        foreach ($this->getWebhookDefinitions() as $definition) {
            $topic = $definition['topic'];
            $callbackUrl = $this->buildCallbackUrl($definition['address']);

            $existing = ShopWebhook::query()
                ->where('shop_id', $shop->id)
                ->where('topic', $topic)
                ->first();

            $shopifyWebhook = $shopifyWebhooksByTopic->get($topic);

            if (
                $shopifyWebhook !== null
                && $this->callbackUrlsMatch($shopifyWebhook['callbackUrl'], $callbackUrl)
            ) {
                if ($existing === null) {
                    ShopWebhook::query()->create([
                        'shop_id' => $shop->id,
                        'shopify_webhook_id' => $shopifyWebhook['id'],
                        'topic' => $topic,
                        'name' => $definition['name'] ?? $topic,
                        'address' => $callbackUrl,
                    ]);
                } elseif ($existing->shopify_webhook_id !== $shopifyWebhook['id']) {
                    $existing->update([
                        'shopify_webhook_id' => $shopifyWebhook['id'],
                        'address' => $callbackUrl,
                    ]);
                }

                $summary['skipped']++;

                continue;
            }

            if ($existing !== null) {
                $existing->delete();
            }

            $webhookId = $this->createShopifyWebhook($shop, $topic, $callbackUrl);

            if ($webhookId === null) {
                $summary['failed']++;

                continue;
            }

            ShopWebhook::query()->create([
                'shop_id' => $shop->id,
                'shopify_webhook_id' => $webhookId,
                'topic' => $topic,
                'name' => $definition['name'] ?? $topic,
                'address' => $callbackUrl,
            ]);

            $summary['registered']++;
        }

        return $summary;
    }

    public function registerAfterFirstPlanCreated(User $shop): array
    {
        if ($this->shopHasRegisteredWebhooks($shop->id)) {
            return [
                'registered' => 0,
                'skipped' => count($this->getWebhookDefinitions()),
                'failed' => 0,
            ];
        }

        return $this->registerSubscriptionWebhooks($shop);
    }

    public function clearLocalWebhooksForShop(int $shopId): void
    {
        ShopWebhook::query()
            ->where('shop_id', $shopId)
            ->delete();
    }

    protected function buildCallbackUrl(string $path): string
    {
        return rtrim((string) config('app.url'), '/').'/'.ltrim($path, '/');
    }

    /**
     * @return Collection<int, array{id: string, topic: string, callbackUrl: string}>
     */
    protected function fetchShopifyWebhooks(User $shop): Collection
    {
        $query = <<<'GQL'
            query {
                webhookSubscriptions(first: 50) {
                    edges {
                        node {
                            id
                            topic
                            endpoint {
                                __typename
                                ... on WebhookHttpEndpoint {
                                    callbackUrl
                                }
                            }
                        }
                    }
                }
            }
        GQL;

        try {
            $response = $shop->api()->graph($query);
            $edges = $response['body']['data']['webhookSubscriptions']['edges'] ?? [];
            $edges = json_decode(json_encode($edges), true);

            return collect($edges)->map(function (array $edge): ?array {
                $node = $edge['node'] ?? null;

                if ($node === null) {
                    return null;
                }

                $callbackUrl = $node['endpoint']['callbackUrl'] ?? null;

                if ($callbackUrl === null) {
                    return null;
                }

                return [
                    'id' => $node['id'],
                    'topic' => $node['topic'],
                    'callbackUrl' => $callbackUrl,
                ];
            })->filter()->values();
        } catch (\Throwable $exception) {
            Log::warning('Unable to fetch Shopify webhooks for sync.', [
                'shop_id' => $shop->id,
                'message' => $exception->getMessage(),
            ]);

            return collect();
        }
    }

    protected function callbackUrlsMatch(string $shopifyUrl, string $expectedUrl): bool
    {
        return rtrim($shopifyUrl, '/') === rtrim($expectedUrl, '/');
    }

    protected function createShopifyWebhook(User $shop, string $topic, string $callbackUrl): ?string
    {
        $mutation = <<<'GQL'
            mutation webhookCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
                webhookSubscriptionCreate(
                    topic: $topic
                    webhookSubscription: {
                        callbackUrl: $callbackUrl
                        format: JSON
                    }
                ) {
                    webhookSubscription {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        GQL;

        try {
            $response = $shop->api()->graph($mutation, [
                'topic' => $topic,
                'callbackUrl' => $callbackUrl,
            ]);

            $payload = $response['body']['data']['webhookSubscriptionCreate'] ?? [];
            $payload = json_decode(json_encode($payload), true);
            $userErrors = $payload['userErrors'] ?? [];

            if (! empty($userErrors)) {
                Log::warning('Shopify webhook registration failed.', [
                    'shop_id' => $shop->id,
                    'topic' => $topic,
                    'errors' => $userErrors,
                ]);

                return null;
            }

            return $payload['webhookSubscription']['id'] ?? null;
        } catch (\Throwable $exception) {
            Log::error('Shopify webhook registration exception.', [
                'shop_id' => $shop->id,
                'topic' => $topic,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }
    }
}
