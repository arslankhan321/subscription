<?php

namespace App\Services;

use App\Mail\SubscriptionNotificationMail;
use App\Models\ShopEmailTemplate;
use App\Services\Shopify\ShopifyGraphqlService;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class EmailTemplateService
{
    public function __construct(
        protected ShopifyGraphqlService $shopifyGraphqlService,
        protected EmailTemplateRenderer $renderer
    ) {}

    public function index(): array
    {
        $overrides = $this->overridesByKey();

        return collect($this->definitions())
            ->map(function (array $definition, string $key) use ($overrides) {
                $override = $overrides[$key] ?? null;
                $merged = $this->mergeTemplate($key, $definition, $override);

                return [
                    'key' => $key,
                    'name' => $definition['name'],
                    'type' => $definition['type'],
                    'icon' => $definition['icon'],
                    'description' => $definition['description'],
                    'enabled' => $merged['enabled'],
                    'isCustomized' => $override !== null && $this->hasCustomContent($override),
                ];
            })
            ->values()
            ->all();
    }

    public function show(string $key): array
    {
        $definition = $this->definition($key);
        $override = $this->findOverride($key);

        return $this->toPayload($key, $definition, $override);
    }

    public function update(string $key, array $data): array
    {
        $definition = $this->definition($key);
        $override = ShopEmailTemplate::query()->updateOrCreate(
            [
                'shop_id' => $this->shopId(),
                'template_key' => $key,
            ],
            [
                'enabled' => $data['enabled'],
                'subject' => $data['subject'],
                'body_html' => $data['bodyHtml'],
                'settings' => $data['settings'],
            ]
        );

        return $this->toPayload($key, $definition, $override);
    }

    public function toggle(string $key, bool $enabled): array
    {
        $definition = $this->definition($key);
        $override = ShopEmailTemplate::query()->firstOrCreate(
            [
                'shop_id' => $this->shopId(),
                'template_key' => $key,
            ],
            [
                'enabled' => $definition['enabled'] ?? true,
                'subject' => null,
                'body_html' => null,
                'settings' => null,
            ]
        );

        $override->update(['enabled' => $enabled]);

        return $this->toPayload($key, $definition, $override->fresh());
    }

    public function reset(string $key): array
    {
        $definition = $this->definition($key);

        ShopEmailTemplate::query()
            ->where('shop_id', $this->shopId())
            ->where('template_key', $key)
            ->delete();

        return $this->toPayload($key, $definition, null);
    }

    public function sendTest(string $key, ?string $email = null): void
    {
        $template = $this->show($key);
        $recipient = $email ?: $this->shopifyGraphqlService->shop()->email;

        if (!$recipient) {
            throw new InvalidArgumentException('No email address available to send the test message.');
        }

        $html = $this->renderer->render($template);
        Mail::to($recipient)->send(new SubscriptionNotificationMail($template['subject'], $html));
    }

    private function toPayload(string $key, array $definition, ?ShopEmailTemplate $override): array
    {
        $merged = $this->mergeTemplate($key, $definition, $override);

        return [
            'key' => $key,
            'name' => $definition['name'],
            'type' => $definition['type'],
            'icon' => $definition['icon'],
            'description' => $definition['description'],
            'enabled' => $merged['enabled'],
            'subject' => $merged['subject'],
            'bodyHtml' => $merged['bodyHtml'],
            'settings' => $merged['settings'],
            'isCustomized' => $override !== null && $this->hasCustomContent($override),
            'updatedAt' => $override?->updated_at?->toIso8601String(),
        ];
    }

    private function mergeTemplate(string $key, array $definition, ?ShopEmailTemplate $override): array
    {
        $defaultSettings = $definition['settings'] ?? [];

        return [
            'key' => $key,
            'enabled' => $override?->enabled ?? ($definition['enabled'] ?? true),
            'subject' => $override?->subject ?? $definition['subject'],
            'bodyHtml' => $override?->body_html ?? $definition['body_html'],
            'settings' => array_replace_recursive(
                $defaultSettings,
                is_array($override?->settings) ? $override->settings : []
            ),
        ];
    }

    private function hasCustomContent(ShopEmailTemplate $override): bool
    {
        return $override->subject !== null
            || $override->body_html !== null
            || !empty($override->settings);
    }

    private function definitions(): array
    {
        return config('email_templates.templates', []);
    }

    private function definition(string $key): array
    {
        $definition = $this->definitions()[$key] ?? null;

        if (!$definition) {
            throw new InvalidArgumentException("Unknown email template [{$key}].");
        }

        return $definition;
    }

    private function overridesByKey(): array
    {
        return ShopEmailTemplate::query()
            ->where('shop_id', $this->shopId())
            ->get()
            ->keyBy('template_key')
            ->all();
    }

    private function findOverride(string $key): ?ShopEmailTemplate
    {
        return ShopEmailTemplate::query()
            ->where('shop_id', $this->shopId())
            ->where('template_key', $key)
            ->first();
    }

    private function shopId(): int
    {
        return $this->shopifyGraphqlService->shop()->id;
    }
}
