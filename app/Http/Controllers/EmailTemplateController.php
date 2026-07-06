<?php

namespace App\Http\Controllers;

use App\Http\Requests\SendEmailTemplateTestRequest;
use App\Http\Requests\ToggleEmailTemplateRequest;
use App\Http\Requests\UpdateEmailTemplateRequest;
use App\Services\EmailTemplateService;
use InvalidArgumentException;

class EmailTemplateController extends Controller
{
    public function __construct(
        protected EmailTemplateService $service
    ) {}

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->index(),
        ]);
    }

    public function show(string $key)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->show($key),
            ]);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 404);
        }
    }

    public function update(UpdateEmailTemplateRequest $request, string $key)
    {
        try {
            $template = $this->service->update($key, $request->validated());

            return response()->json([
                'success' => true,
                'message' => 'Email template saved successfully',
                'data' => $template,
            ]);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 404);
        }
    }

    public function toggle(ToggleEmailTemplateRequest $request, string $key)
    {
        try {
            $template = $this->service->toggle($key, $request->boolean('enabled'));

            return response()->json([
                'success' => true,
                'message' => $template['enabled']
                    ? 'Email notification enabled'
                    : 'Email notification disabled',
                'data' => $template,
            ]);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 404);
        }
    }

    public function reset(string $key)
    {
        try {
            $template = $this->service->reset($key);

            return response()->json([
                'success' => true,
                'message' => 'Email template reset to default',
                'data' => $template,
            ]);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 404);
        }
    }

    public function sendTest(SendEmailTemplateTestRequest $request, string $key)
    {
        try {
            $this->service->sendTest($key, $request->validated('email'));

            return response()->json([
                'success' => true,
                'message' => 'Test email sent successfully',
            ]);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }
}
