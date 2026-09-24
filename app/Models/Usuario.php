<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Usuario extends Authenticatable
{
    use Notifiable;

    public $incrementing = false;
    public $timestamps = false;
    public $remember_token = false;
    protected $connection = 'toolset_perf';
    protected $table = 'usuarios';
    protected $primaryKey = 'coduser';
}
