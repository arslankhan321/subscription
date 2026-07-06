<?php

namespace App\Repositories\Plans;

use App\Models\SubscriptionPlan;

class SubscriptionPlanRepository implements SubscriptionPlanRepositoryInterface
{
    public function create(array $data)
    {
        return SubscriptionPlan::create($data);
    }

    public function update(int $id, int $shopId, array $data)
    {
        $plan = $this->find($id, $shopId);

        $plan->update($data);

        return $plan;
    }

    public function find(int $id, int $shopId)
    {
        return SubscriptionPlan::with([
            'products',
            'options',
        ])
            ->where('shop_id', $shopId)
            ->findOrFail($id);
    }

    public function all(int $shopId)
    {
        return SubscriptionPlan::with([
            'products',
            'options',
        ])
            ->where('shop_id', $shopId)
            ->latest()
            ->paginate(10);
    }

    public function delete(int $id, int $shopId)
    {
        return $this->find($id, $shopId)->delete();
    }
}
