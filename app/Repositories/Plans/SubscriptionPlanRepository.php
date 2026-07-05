<?php
namespace App\Repositories\Plans;

use App\Models\SubscriptionPlan;
use App\Repositories\Plans\SubscriptionPlanRepositoryInterface;

class SubscriptionPlanRepository implements SubscriptionPlanRepositoryInterface
{
    public function create(array $data)
    {
        return SubscriptionPlan::create($data);
    }

    public function update(int $id, array $data)
    {
        $plan = SubscriptionPlan::findOrFail($id);

        $plan->update($data);

        return $plan;
    }

    public function find(int $id)
    {
        return SubscriptionPlan::with([
            'products',
            'options'
        ])->findOrFail($id);
    }

    public function all()
    {
        return SubscriptionPlan::with([
            'products',
            'options'
        ])->latest()->paginate(10);
    }

    public function delete(int $id)
    {
        return SubscriptionPlan::findOrFail($id)->delete();
    }
}