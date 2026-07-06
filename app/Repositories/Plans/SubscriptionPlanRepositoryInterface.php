<?php

namespace App\Repositories\Plans;

interface SubscriptionPlanRepositoryInterface
{
    public function all(int $shopId);

    public function find(int $id, int $shopId);

    public function create(array $data);

    public function update(int $id, int $shopId, array $data);

    public function delete(int $id, int $shopId);
}