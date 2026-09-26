<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActividadHistorial extends Model
{
    protected $connection = 'mysql';
    protected $table = 'actividad_historial';
    public const UPDATED_AT = null;
}
