<?php

namespace App\Services\Shopify;

use App\Exceptions\ShopifySellingPlanException;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Throwable;

class ShopifyGraphqlService
{
    public function shop(): User
    {
        /** @var User|null $shop */
        $shop = Auth::user();

        if (!$shop) {
            throw new ShopifySellingPlanException('Shopify shop is not authenticated.');
        }

        return $shop;
    }

    public function execute(string $query, array $variables = []): array
    {
        $response = $this->shop()->api()->graph($query, $variables);

        if ($response['errors'] !== false) {
            $message = $this->extractErrorMessage($response);

            Log::error('Shopify GraphQL request failed', [
                'message' => $message,
                'status' => $response['status'] ?? null,
                'variables' => $variables,
            ]);

            throw new ShopifySellingPlanException($message);
        }

        return $this->normalizeData($response['body']['data'] ?? []);
    }

    public function getCurrentScopes(): array
    {
        $data = $this->execute(<<<'GQL'
        {
            currentAppInstallation {
                accessScopes {
                    handle
                }
            }
        }
        GQL);

        $scopes = $data['currentAppInstallation']['accessScopes'] ?? [];

        return array_column($scopes, 'handle');
    }

    public function mutation(string $mutationName, string $query, array $variables): array
    {
        $data = $this->execute($query, $variables);
        $result = $data[$mutationName] ?? null;

        if (!$result) {
            throw new ShopifySellingPlanException("Unexpected Shopify response for {$mutationName}.");
        }

        $userErrors = $this->normalizeList($result['userErrors'] ?? []);

        if (!empty($userErrors)) {
            throw new ShopifySellingPlanException(
                $this->formatUserErrors($userErrors),
                $userErrors
            );
        }

        return $result;
    }

    private function extractErrorMessage(array $response): string
    {
        if (is_array($response['errors'])) {
            $first = $response['errors'][0] ?? null;

            if (is_array($first) && !empty($first['message'])) {
                return (string) $first['message'];
            }

            return json_encode($response['errors']);
        }

        if ($response['errors'] === true) {
            $exception = $response['exception'] ?? null;

            if ($exception instanceof Throwable) {
                $exceptionMessage = $exception->getMessage();

                if (str_contains($exceptionMessage, 'Non-expiring access tokens are no longer accepted')) {
                    return 'Shopify access token expired. Uninstall the app from your store, then reinstall it to get a new token.';
                }

                return $exceptionMessage;
            }

            $body = $response['body'] ?? null;

            if (is_array($body) && !empty($body[0]['message'])) {
                return (string) $body[0]['message'];
            }

            $status = $response['status'] ?? 'unknown';

            return "Shopify API request failed (HTTP {$status}). Please retry or reinstall the app.";
        }

        return (string) $response['errors'];
    }

    private function formatUserErrors(array $userErrors): string
    {
        return collect($userErrors)
            ->map(function ($error) {
                $field = $error['field'] ?? null;
                $message = $error['message'] ?? 'Unknown Shopify error';

                if (is_array($field) && !empty($field)) {
                    return implode('.', $field).': '.$message;
                }

                return (string) $message;
            })
            ->filter()
            ->implode(' | ');
    }

    private function normalizeData(mixed $data): array
    {
        if (is_array($data)) {
            return $data;
        }

        if (is_object($data) && method_exists($data, 'toArray')) {
            return $data->toArray();
        }

        return (array) $data;
    }

    private function normalizeList(mixed $list): array
    {
        if (is_array($list)) {
            return $list;
        }

        if (is_object($list) && method_exists($list, 'toArray')) {
            return $list->toArray();
        }

        return [];
    }
}
