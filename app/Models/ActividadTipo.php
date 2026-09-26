<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActividadTipo extends Model
{
    protected $connection = 'mysql';
    protected $table = 'actividad_tipos';
    public $timestamps = false;
}
