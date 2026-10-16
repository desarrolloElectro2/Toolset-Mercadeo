<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Estado parametrizable de actividad; las actividades guardan su `codigo`
class ActividadEstado extends Model
{
    protected $connection = 'mysql';
    protected $table = 'actividad_estados';
    public $timestamps = false;

    protected $casts = [
        'inicial'              => 'boolean',
        'editable'             => 'boolean',
        'requiere_inicio'      => 'boolean',
        'requiere_fin'         => 'boolean',
        'requiere_observacion' => 'boolean',
    ];
}
