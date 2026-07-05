<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Osiset\ShopifyApp\Contracts\ShopModel;
use Osiset\ShopifyApp\Util;
use Symfony\Component\HttpFoundation\Response;

class VerifyShopifyScopes
{
    private const CACHE_KEY_SUFFIX = 'currentScopes';

    public function handle(Request $request, Closure $next): Response
    {
        /** @var ShopModel|null $shop */
        $shop = auth()->user();

        if (!$shop) {
            return $next($request);
        }

        $scopesResult = $this->currentScopes($shop);

        if ($scopesResult['hasErrors']) {
            return $next($request);
        }

        $requiredScopes = array_map('trim', explode(',', (string) config('shopify-app.api_scopes')));
        $missingScopes = array_diff($requiredScopes, $scopesResult['result']);

        if (filled($missingScopes)) {
            Cache::forget($this->cacheKey($shop->getDomain()->toNative()));

            return Redirect::route(Util::getShopifyConfig('route_names.authenticate'), [
                'shop' => $shop->getDomain()->toNative(),
                'host' => $request->get('host'),
                'locale' => $request->get('locale'),
            ]);
        }

        return $next($request);
    }

    /**
     * @return array{hasErrors: bool, result: string[]}
     */
    private function currentScopes(ShopModel $shop): array
    {
        $scopes = Cache::remember(
            $this->cacheKey($shop->getDomain()->toNative()),
            now()->addDay(),
            function () use ($shop): ?array {
                $response = $shop->api()->graph('{
                    currentAppInstallation {
                        accessScopes {
                            handle
                        }
                    }
                }');

                if ($response['errors'] !== false) {
                    return null;
                }

                $accessScopes = data_get(
                    $response['body']->toArray(),
                    'data.currentAppInstallation.accessScopes',
                    []
                );

                if (!is_array($accessScopes)) {
                    return [];
                }

                return array_values(array_column($accessScopes, 'handle'));
            }
        );

        if ($scopes === null) {
            Log::error('Failed to fetch current app installation access scopes.');

            return [
                'hasErrors' => true,
                'result' => [],
            ];
        }

        return [
            'hasErrors' => false,
            'result' => $scopes,
        ];
    }

    private function cacheKey(string $shopDomain): string
    {
        return sprintf('%s.%s', $shopDomain, self::CACHE_KEY_SUFFIX);
    }
}
