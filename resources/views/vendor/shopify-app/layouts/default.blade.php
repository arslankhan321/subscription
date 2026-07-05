<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="shopify-api-key" content="{{ \Osiset\ShopifyApp\Util::getShopifyConfig('api_key', $shopDomain ?? Auth::user()->name ) }}"/>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
        <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
        <link rel="preload" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
        <noscript><link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"></noscript>

        <title>{{ config('shopify-app.app_name') }}</title>
        <style>
            .main-loading-container{background:#f8f9fa;position:fixed;z-index:9999999999999999999;width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;color:#333}.main-loading-container .loading-container{display:flex;gap:15px;flex-direction:column;align-items:center;text-align:center}.main-loading-container .logo-icon{width:70px;height:70px;border-radius:10px}.main-loading-container .logo-text{display:flex;flex-direction:column;align-items:flex-start}.main-loading-container .product-name{font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-.5px}.main-loading-container .loading-message{font-size:16px;color:#666;margin-bottom:25px;font-weight:400}.main-loading-container .spinner{width:40px;height:40px;border:3px solid #e5e7eb;border-top:3px solid #3a93ed;border-radius:50%;animation:1s linear infinite spin}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        </style>
        @yield('styles')
    </head>

    <body>
        <div class="app-wrapper">
            <div class="app-content">
                <main role="main" id="root">
                    @viteReactRefresh
                    @vite('resources/js/app.js')
                    @yield('content')
                </main>
            </div>
        </div>

        @if(\Osiset\ShopifyApp\Util::isMPAApplication())
            @include('shopify-app::partials.token_handler')
        @endif
        <script>
            var shopDomain = "{{ $shopDomain ?? Auth::user()->name }}";
            var storeEmail = "{{ $shopDomain ?? Auth::user()->store_email }}";
            var app_host = "{{ \Request::get('host') }}";
            var shopName="{{$shopDomain ?? Auth::user()->store_name }}";
            var shopData = "{{$shop ?? Auth::user()}}";
        </script>
        @yield('scripts')
    </body>
</html>
