<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActividadProducto extends Model
{
    protected $connection = 'mysql';
    protected $table = 'actividad_productos';
    public $timestamps = false;
}
