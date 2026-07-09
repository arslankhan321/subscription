<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubscriptionWidgetRequest;
use App\Services\SubscriptionWidgetService;
use Illuminate\Http\Request;

class SubscriptionWidgetController extends Controller
{
    public function __construct(
        protected SubscriptionWidgetService $service
    ) {}

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->index(),
        ]);
    }

    public function active()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->active(),
        ]);
    }

    public function defaults()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->defaultSettings(),
        ]);
    }

    public function store(StoreSubscriptionWidgetRequest $request)
    {
        $widget = $this->service->create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Widget created successfully',
            'data' => $widget,
        ], 201);
    }

    public function show($id)
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->find($id),
        ]);
    }

    public function update(StoreSubscriptionWidgetRequest $request, $id)
    {
        $widget = $this->service->update($id, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Widget updated successfully',
            'data' => $widget,
        ]);
    }

    public function destroy($id)
    {
        $this->service->delete($id);

        return response()->json([
            'success' => true,
            'message' => 'Widget deleted successfully',
        ]);
    }

    public function storefrontActive()
    {
        $widget = $this->service->findActive();

        if (! $widget) {
            return response()->json([
                'success' => false,
                'message' => 'No active widget found',
            ], 404);
        }

        return $this->storefrontResponse($widget);
    }

    public function storefront(Request $request, string $name)
    {
        $widget = $this->service->findByName($name);

        if (! $widget || $widget->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Widget not found',
            ], 404);
        }

        return $this->storefrontResponse($widget);
    }

    private function storefrontResponse($widget)
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->storefrontPayload($widget),
        ])->header('Access-Control-Allow-Origin', '*');
    }

    public function storefrontStyles()
    {
        $path = public_path('subscription-widget.css');

        if (! is_file($path)) {
            return response('/* subscription-widget.css not found */', 404, [
                'Content-Type' => 'text/css; charset=UTF-8',
                'Access-Control-Allow-Origin' => '*',
            ]);
        }

        return response(file_get_contents($path), 200, [
            'Content-Type' => 'text/css; charset=UTF-8',
            'Access-Control-Allow-Origin' => '*',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
