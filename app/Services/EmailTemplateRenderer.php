<?php

namespace App\Services;

use App\Models\ShopEmailTemplate;
use App\Services\Shopify\ShopifyGraphqlService;
use Illuminate\Support\Arr;

class EmailTemplateRenderer
{
    public function render(array $template, array $sampleData = []): string
    {
        $data = array_merge(config('email_templates.preview_sample', []), $sampleData);
        $settings = $template['settings'] ?? [];

        $html = $this->replaceVariables($template['bodyHtml'] ?? '', $data);

        if (!empty($settings['showBtn'])) {
            $buttonClass = !empty($settings['fullWidth']) ? 'email-btn email-btn--full' : 'email-btn';
            $buttonText = $this->replaceVariables($settings['btnText'] ?? 'Manage Subscription', $data);
            $html .= sprintf(
                '<p style="margin:24px 0;"><a href="%s" class="%s" style="display:inline-block;padding:12px 20px;background:#008060;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">%s</a></p>',
                e($data['manage_subscription_url'] ?? '#'),
                $buttonClass,
                e($buttonText)
            );
        }

        if (!empty($settings['showItems'])) {
            $qtyTitle = e($settings['qtyTitle'] ?? 'Quantity');
            $html .= '<table style="width:100%;border-collapse:collapse;margin:20px 0;">';
            $html .= '<thead><tr><th style="text-align:left;padding:8px 0;border-bottom:1px solid #e3e3e3;">Product</th>';
            $html .= '<th style="text-align:left;padding:8px 0;border-bottom:1px solid #e3e3e3;">'.$qtyTitle.'</th>';
            $html .= '<th style="text-align:right;padding:8px 0;border-bottom:1px solid #e3e3e3;">Price</th></tr></thead><tbody>';

            foreach ($data['line_items'] ?? [] as $item) {
                $html .= '<tr>';
                $html .= '<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">'.e($item['title'] ?? '').'</td>';
                $html .= '<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">'.e((string) ($item['quantity'] ?? 1)).'</td>';
                $html .= '<td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right;">'.e($item['price'] ?? '').'</td>';
                $html .= '</tr>';
            }

            $html .= '</tbody></table>';
        }

        if (!empty($settings['showAddresses'])) {
            $shippingTitle = e($settings['shippingTitle'] ?? 'Shipping Address');
            $billingTitle = e($settings['billingTitle'] ?? 'Billing Address');
            $shippingText = $this->replaceVariables($settings['shippingText'] ?? '', $data);
            $billingText = $this->replaceVariables($settings['billingText'] ?? '', $data);

            $html .= '<table style="width:100%;margin:20px 0;"><tr>';
            $html .= '<td style="width:50%;vertical-align:top;padding-right:12px;">';
            $html .= '<strong>'.$shippingTitle.'</strong><br>'.$shippingText;
            $html .= '</td><td style="width:50%;vertical-align:top;padding-left:12px;">';
            $html .= '<strong>'.$billingTitle.'</strong><br>'.$billingText;
            $html .= '</td></tr></table>';
        }

        if (!empty($settings['showOrderDate'])) {
            $orderDateTitle = e($settings['orderDateTitle'] ?? 'Next Order Date');
            $paymentTitle = e($settings['paymentTitle'] ?? 'Payment Method');
            $html .= '<table style="width:100%;margin:20px 0;"><tr>';
            $html .= '<td style="width:50%;vertical-align:top;padding-right:12px;">';
            $html .= '<strong>'.$orderDateTitle.'</strong><br>'.e($data['next_order_date'] ?? '');
            $html .= '</td><td style="width:50%;vertical-align:top;padding-left:12px;">';
            $html .= '<strong>'.$paymentTitle.'</strong><br>'.e($data['payment_method'] ?? '');
            $html .= '</td></tr></table>';
        }

        if (!empty($settings['footerText'])) {
            $html .= $this->replaceVariables($settings['footerText'], $data);
        }

        return '<div style="font-family:Arial,sans-serif;color:#202223;line-height:1.6;max-width:640px;">'.$html.'</div>';
    }

    private function replaceVariables(string $template, array $data): string
    {
        return (string) preg_replace_callback(
            '/\{\{\s*([\w.]+)\s*\}\}/',
            function (array $matches) use ($data) {
                $value = Arr::get($data, $matches[1]);

                if (is_array($value)) {
                    return '';
                }

                return e((string) ($value ?? ''));
            },
            $template
        );
    }
}
