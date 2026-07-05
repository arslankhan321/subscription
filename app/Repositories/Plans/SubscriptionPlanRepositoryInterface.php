<?php

namespace App\Repositories\Plans;

interface SubscriptionPlanRepositoryInterface
{
    public function all();

    public function find(int $id);

    public function create(array $data);

    public function update(int $id,array $data);

    public function delete(int $id);
}