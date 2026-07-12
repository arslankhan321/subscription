<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Osiset\ShopifyApp\Contracts\ShopModel as IShopModel;
use Osiset\ShopifyApp\Traits\ShopModel;

class User extends Authenticatable implements IShopModel
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, ShopModel;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            // 'password' => 'hashed',
        ];
    }

    public function subscriptionPlans()
    {
        return $this->hasMany(SubscriptionPlan::class, 'shop_id');
    }

    public function settings()
    {
        return $this->hasOne(ShopSetting::class, 'shop_id');
    }

    public function shippingProfiles()
    {
        return $this->hasMany(ShippingProfile::class, 'shop_id');
    }

    public function emailTemplates()
    {
        return $this->hasMany(ShopEmailTemplate::class, 'shop_id');
    }

    public function customers()
    {
        return $this->hasMany(Customer::class, 'shop_id');
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class, 'shop_id');
    }
}
